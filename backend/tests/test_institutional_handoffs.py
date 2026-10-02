"""Configured outgoing delivery: actual SQL jobs, replay and acknowledgement boundaries."""
import json
from sqlalchemy import select, func
from test_foundation import client, login


def configure(monkeypatch, url="https://recipient.example/fhir"):
    monkeypatch.setenv("HANDOFF_RECIPIENTS_JSON", json.dumps({"org-reedwatch": {"name": "Configured test recipient", "url": url,
        "headers": {"Authorization": "Bearer SERVER-SECRET"}, "contract": "aquarelay-handoff-v1", "idempotency_supported": True}}))


def test_missing_institutional_recipient_is_unavailable_while_export_works(client, monkeypatch):
    monkeypatch.delenv("HANDOFF_RECIPIENTS_JSON", raising=False)
    headers = login(client, "manager@demo.aquarelay.local")
    response = client.post("/api/v1/handoffs/wb-reedwater", json={"recipient": "institutional", "client_id": "missing-recipient"}, headers=headers)
    assert response.status_code == 503
    assert client.get("/api/v1/standards/wb-reedwater/fhir").status_code == 200
    capabilities = client.get("/api/v1/handoff-capabilities")
    assert capabilities.status_code == 200
    assert capabilities.json()["institutional"]["available"] is False


def test_institutional_job_delivers_once_with_stable_remote_receipt_and_no_implicit_ack(client, monkeypatch):
    from app import integrations
    configure(monkeypatch)
    # Only the external DNS/network boundary is replaced; app, payload and durable jobs remain real.
    monkeypatch.setattr(integrations, "validate_public_url", lambda url: (None, ["8.8.8.8"]))
    calls = []
    def remote_post(url, payload, headers, idempotency_key):
        calls.append((url, payload, idempotency_key))
        return {"status_code": 202, "receipt_id": "remote-delivery-001", "acknowledged": False}
    monkeypatch.setattr(integrations, "safe_post_fhir", remote_post)
    headers = login(client, "manager@demo.aquarelay.local")
    capabilities = client.get("/api/v1/handoff-capabilities")
    assert capabilities.json()["institutional"]["available"] is True
    assert "SERVER-SECRET" not in capabilities.text and "recipient.example" not in capabilities.text
    queued = client.post("/api/v1/handoffs/wb-reedwater", json={"recipient": "institutional", "client_id": "external-handoff-1"}, headers=headers)
    assert queued.status_code == 202, queued.text
    receipt_id = queued.json()["id"]
    from app.worker import process_jobs
    from app.db import SessionLocal
    from app.models import Receipt
    with SessionLocal() as db:
        process_jobs(db)
        process_jobs(db)
        assert db.scalar(select(func.count()).select_from(Receipt).where(Receipt.kind == "institutional_delivery")) == 1
    result = client.get("/api/v1/receipts/" + receipt_id)
    assert result.json()["state"] == "delivered"
    assert result.json()["external_receipt_id"] == "remote-delivery-001"
    assert result.json()["acknowledged"] is False
    assert "SERVER-SECRET" not in result.text
    replay = client.post("/api/v1/handoffs/wb-reedwater", json={"recipient": "institutional", "client_id": "external-handoff-1"}, headers=headers)
    assert replay.json()["id"] == receipt_id
    assert len(calls) == 1
    assert calls[0][1]["resourceType"] == "Bundle"
    assert calls[0][2] == receipt_id


def test_institutional_durable_failure_preserves_retry_and_can_recover(client, monkeypatch):
    from app import integrations
    from app.db import SessionLocal
    from app.models import Job
    from app.worker import process_jobs
    configure(monkeypatch)
    monkeypatch.setattr(integrations, "validate_public_url", lambda url: (None, ["8.8.8.8"]))
    def failed(*args):
        raise OSError("upstream timeout")
    monkeypatch.setattr(integrations, "safe_post_fhir", failed)
    headers = login(client, "manager@demo.aquarelay.local")
    queued = client.post("/api/v1/handoffs/wb-reedwater", json={"recipient": "institutional", "client_id": "retry-handoff"}, headers=headers).json()
    with SessionLocal() as db:
        process_jobs(db)
        job = db.scalar(select(Job).where(Job.dedup_key == "handoff:" + queued["id"]))
        assert job.state == "pending" and job.attempts == 1
        job.available_at = "2000-01-01T00:00:00+00:00"
        db.commit()
    failed_receipt = client.get("/api/v1/receipts/" + queued["id"]).json()
    assert failed_receipt["state"] == "retrying"
    assert failed_receipt["acknowledged"] is False
    assert failed_receipt["retry_history"]
    monkeypatch.setattr(integrations, "safe_post_fhir", lambda *args: {"status_code": 200, "receipt_id": "remote-after-retry", "acknowledged": False})
    with SessionLocal() as db:
        process_jobs(db)
    recovered = client.get("/api/v1/receipts/" + queued["id"]).json()
    assert recovered["state"] == "delivered" and recovered["external_receipt_id"] == "remote-after-retry"


def test_private_recipient_configuration_is_rejected_without_queuing(client, monkeypatch):
    configure(monkeypatch, "https://127.0.0.1/fhir")
    headers = login(client, "manager@demo.aquarelay.local")
    response = client.post("/api/v1/handoffs/wb-reedwater", json={"recipient": "institutional"}, headers=headers)
    assert response.status_code == 503


def test_plain_http_acceptance_never_counts_as_acknowledgement(monkeypatch):
    from app.integrations import parse_recipient_response
    assert parse_recipient_response(202, {"acknowledged": True}, "request-1")["acknowledged"] is False
    explicit = {"contract": "aquarelay-handoff-v1", "idempotency_key": "request-1", "receipt_id": "delivery-1",
        "acknowledgement": {"status": "acknowledged", "receipt_id": "ack-1", "received_at": "2026-10-02T06:30:00Z"}}
    result = parse_recipient_response(202, explicit, "request-1")
    assert result["acknowledged"] is True
    assert result["acknowledgement"]["receipt_id"] == "ack-1"
    explicit["idempotency_key"] = "another-request"
    assert parse_recipient_response(202, explicit, "request-1")["acknowledged"] is False


def test_outgoing_post_revalidates_private_redirect_before_delivery(monkeypatch):
    import pytest
    from app import integrations
    real_resolve = integrations.socket.getaddrinfo
    monkeypatch.setattr(integrations.socket, "getaddrinfo", lambda host, *args, **kwargs: [(2, 1, 6, "", ("8.8.8.8", 443))] if host == "public.example" else real_resolve(host, *args, **kwargs))
    class Redirect:
        status = 307
        def getheader(self, name):
            return "https://127.0.0.1/private"
    class Connection:
        def __init__(self, host, address):
            pass
        def request(self, *args, **kwargs):
            pass
        def getresponse(self):
            return Redirect()
        def close(self):
            pass
    monkeypatch.setattr(integrations, "PinnedHTTPSConnection", Connection)
    with pytest.raises(ValueError, match="nonpublic"):
        integrations.safe_post_fhir("https://public.example/fhir", {"resourceType": "Bundle"}, {"Authorization": "secret"}, "request-1")


def test_outgoing_post_preserves_fhir_and_idempotency_and_bounds_response(monkeypatch):
    import pytest
    from urllib.parse import urlsplit
    from app import integrations
    monkeypatch.setattr(integrations, "validate_public_url", lambda url: (urlsplit(url), ["8.8.8.8"]))
    captured = []
    class Response:
        status = 202
        def getheader(self, name):
            return None
        def read(self, limit):
            return b'{"receipt_id":"remote-1","acknowledged":true}'
    class Connection:
        def __init__(self, host, address):
            pass
        def request(self, method, target, body, headers):
            captured.append({"method": method, "payload": json.loads(body), "headers": headers})
        def getresponse(self):
            return Response()
        def close(self):
            pass
    monkeypatch.setattr(integrations, "PinnedHTTPSConnection", Connection)
    result = integrations.safe_post_fhir("https://public.example/fhir", {"resourceType": "Bundle"}, {}, "request-1")
    assert result["receipt_id"] == "remote-1" and result["acknowledged"] is False
    assert captured[0]["method"] == "POST" and captured[0]["payload"]["resourceType"] == "Bundle"
    assert captured[0]["headers"]["Idempotency-Key"] == "request-1"
    assert captured[0]["headers"]["Content-Type"] == "application/fhir+json"
    monkeypatch.setattr(Response, "read", lambda self, limit: b"x" * (integrations.MAX_BYTES + 1))
    with pytest.raises(ValueError, match="exceeds"):
        integrations.safe_post_fhir("https://public.example/fhir", {}, {}, "request-1")
