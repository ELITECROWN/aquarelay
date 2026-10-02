"""Regression checks for source interpretation and transport boundaries."""
from types import SimpleNamespace
import json
import pytest

from app.integrations import parse_upload, transform_rows, validate_public_url, csv_safe, verify_webhook, safe_fetch_json, PinnedHTTPSConnection
from app.standards import build_fhir, check_fhir, build_sensorthings, sensorthings_rows


SITES = [SimpleNamespace(id="wb_reed", name="Demo Reedwater Lake", aliases=["Reedwater"],
                         latitude=22.58, longitude=88.42, synthetic=True)]
MAPPING = {"site_name": "site_name", "observed_at": "observed_at", "water_temp": "temperature"}
ROW = {"site_name": "Demo Reedwater Lake", "observed_at": "2026-01-03T10:00:00", "water_temp": "68"}


def test_missing_unit_and_timezone_quarantine_instead_of_guessing():
    result = transform_rows([ROW], MAPPING, {}, None, SITES)
    assert result[0]["status"] == "unresolved"
    assert {issue["code"] for issue in result[0]["issues"]} >= {"missing_unit", "missing_timezone"}


def test_explicit_mapping_converts_fahrenheit_and_preserves_source():
    result = transform_rows([ROW], MAPPING, {"temperature": "degF"}, "Asia/Kolkata", SITES)
    assert result[0]["status"] == "ready"
    observation = result[0]["observations"][0]
    assert observation["value"] == pytest.approx(20)
    assert observation["unit"] == "Cel"
    assert observation["observed_at"] == "2026-01-03T04:30:00+00:00"
    assert result[0]["raw"] == ROW
    assert "Fahrenheit" in observation["conversion"]


def test_ambiguous_site_is_not_silently_chosen():
    sites = SITES + [SimpleNamespace(id="wb_other", name="Demo Other Lake", aliases=["Reedwater"])]
    row = dict(ROW, site_name="Reedwater", observed_at="2026-01-03T10:00:00Z")
    result = transform_rows([row], MAPPING, {"temperature": "degC"}, None, sites)
    assert result[0]["status"] == "unresolved"
    assert any(x["code"] == "ambiguous_site" for x in result[0]["issues"])


def test_nonfinite_measurements_rejected():
    row = dict(ROW, water_temp="NaN", observed_at="2026-01-03T10:00:00Z")
    result = transform_rows([row], MAPPING, {"temperature": "degC"}, None, SITES)
    assert result[0]["status"] == "rejected"


def test_source_updated_at_requires_a_valid_explicit_time():
    row = dict(ROW, observed_at="2026-01-03T10:00:00Z", source_updated_at="not-a-date")
    result = transform_rows([row], {**MAPPING, "source_updated_at": "source_updated_at"}, {"temperature": "degC"}, None, SITES)
    assert result[0]["status"] == "rejected"


def test_xlsx_formulas_are_rejected_without_execution():
    import io
    from openpyxl import Workbook
    book = Workbook()
    book.active.append(["site_name", "water_temp"])
    book.active.append(["Demo Reedwater Lake", "=1+1"])
    buffer = io.BytesIO()
    book.save(buffer)
    with pytest.raises(ValueError, match="Formulas"):
        parse_upload("formulas.xlsx", buffer.getvalue())


def test_json_is_data_not_executable_code():
    rows = parse_upload("demo.json", json.dumps([ROW]).encode())
    assert rows == [ROW]
    with pytest.raises(ValueError):
        parse_upload("demo.xlsm", b"macro")
    assert csv_safe("=WEBSERVICE(\"bad\")").startswith("'")


def test_duplicate_csv_headers_are_rejected_without_losing_source_values():
    with pytest.raises(ValueError, match="unique"):
        parse_upload("duplicates.csv", b"site_name,water_temp,water_temp\nDemo Reedwater Lake,20,22\n")


@pytest.mark.parametrize("url", ["http://example.com", "https://127.0.0.1", "https://[::1]", "https://169.254.169.254", "https://user:password@example.com", "https://example.com:8443"])
def test_private_and_unsafe_connector_targets_rejected(url):
    with pytest.raises(ValueError):
        validate_public_url(url)


def test_credential_query_parameters_are_rejected_before_dns():
    with pytest.raises(ValueError, match="Credential"):
        validate_public_url("https://unresolvable.invalid/data?api_key=SECRET")


def test_webhook_signature_binds_timestamp_and_body():
    import hmac, hashlib
    body = b'{"event_id":"sample-1"}'
    signature = hmac.new(b"secret", b"1000." + body, hashlib.sha256).hexdigest()
    assert verify_webhook("secret", body, "1000", "sha256=" + signature, now=1000)
    assert not verify_webhook("secret", body + b" ", "1000", signature, now=1000)
    assert not verify_webhook("secret", body, "1000", signature, now=1400)


def test_redirect_to_private_address_is_rejected(monkeypatch):
    from app import integrations
    real_resolve = integrations.socket.getaddrinfo
    monkeypatch.setattr(integrations.socket, "getaddrinfo", lambda host, *args, **kwargs: [(2, 1, 6, "", ("8.8.8.8", 443))] if host == "public.example" else real_resolve(host, *args, **kwargs))
    class Redirect:
        status = 302
        def getheader(self, name):
            return "https://127.0.0.1/private"
    class PublicConnection:
        def __init__(self, host, address):
            pass
        def request(self, *args, **kwargs):
            pass
        def getresponse(self):
            return Redirect()
        def close(self):
            pass
    monkeypatch.setattr(integrations, "PinnedHTTPSConnection", PublicConnection)
    with pytest.raises(ValueError, match="nonpublic"):
        safe_fetch_json("https://public.example/data", {"Authorization": "secret"})


def test_connection_uses_validated_address_with_original_tls_hostname(monkeypatch):
    from app import integrations
    peers, hostnames = [], []
    def connect(peer, timeout):
        peers.append(peer)
        return object()
    class Context:
        def wrap_socket(self, sock, server_hostname):
            hostnames.append(server_hostname)
            return sock
    monkeypatch.setattr(integrations.socket, "create_connection", connect)
    monkeypatch.setattr(integrations.ssl, "create_default_context", lambda: Context())
    connection = PinnedHTTPSConnection("public.example", "8.8.8.8")
    connection.connect()
    assert peers == [("8.8.8.8", 443)]
    assert hostnames == ["public.example"]


def observations():
    return [SimpleNamespace(id="obs-1", waterbody_id="wb_reed", source_id="src-1", external_id="source-event-1", parameter="temperature", value=20,
            unit="Cel", observed_at="2026-01-03T04:30:00+00:00", received_at="2026-01-03T04:31:00+00:00", synthetic=True, data={})]


def test_fhir_real_resources_and_synthetic_tag_without_clinical_claims():
    bundle = build_fhir(SITES[0], observations())
    assert bundle["resourceType"] == "Bundle"
    assert {x["resource"]["resourceType"] for x in bundle["entry"]} == {"Location", "Observation", "Provenance"}
    assert check_fhir(bundle)["valid"] is True
    observation = next(x["resource"] for x in bundle["entry"] if x["resource"]["resourceType"] == "Observation")
    assert observation["status"] == "final"
    assert observation["subject"]["reference"].startswith("urn:uuid:")
    assert observation["valueQuantity"]["value"] == 20
    assert "loinc" not in json.dumps(bundle).lower()
    assert "synthetic" in json.dumps(bundle).lower()
    observation["subject"]["reference"] = "urn:uuid:missing"
    assert check_fhir(bundle)["valid"] is False


@pytest.mark.parametrize("entries", [None, "invalid", [None], [{"resource": []}]])
def test_fhir_malformed_structures_rejected_without_crashing(entries):
    result = check_fhir({"resourceType": "Bundle", "type": "collection", "entry": entries})
    assert result["valid"] is False


def test_sensorthings_malformed_relationships_raise_validation_error():
    with pytest.raises(ValueError):
        sensorthings_rows({"Datastreams": [None]})


def test_sensorthings_entities_relationships_and_adapter_roundtrip():
    payload = build_sensorthings(SITES[0], observations())
    assert payload["Datastreams"][0]["unitOfMeasurement"]["symbol"] == "°C"
    assert payload["Datastreams"][0]["Thing"]["@iot.id"] == "wb_reed"
    assert payload["Datastreams"][0]["Party"]["role"] == "institutional"
    assert payload["Datastreams"][0]["License"]["definition"].startswith("https://")
    rows = sensorthings_rows(payload)
    assert rows[0]["external_id"] == "source-event-1"
    assert rows[0]["waterbody_id"] == "wb_reed"
    assert rows[0]["parameter"] == "temperature"
    assert rows[0]["unit"] == "Cel"
    assert rows[0]["value"] == 20


def test_staplus_explicit_owner_role_and_license_are_preserved():
    records = observations()
    records[0].synthetic = False
    records[0].data = {"staplus_party": {"role": "individual", "displayName": "Consenting source contributor"},
                       "staplus_license": {"name": "CC BY source", "definition": "https://creativecommons.org/licenses/by/4.0/", "attributionText": "Source contributor"}}
    payload = build_sensorthings(SITES[0], records)
    stream = payload["Datastreams"][0]
    assert stream["Party"]["role"] == "individual"
    assert stream["License"]["definition"] == "https://creativecommons.org/licenses/by/4.0/"
    assert stream["License"]["attributionText"] == "Source contributor"
