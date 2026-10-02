"""Actual persisted API journeys, permissions, replay and receiver delivery."""
import hashlib
import hmac
import json
import time
from sqlalchemy import select, func
from test_foundation import client, login


CSV = b"external_id,site_name,observed_at,water_temp,synthetic\nngo-1,Demo Reedwater Lake,2026-09-30T10:00:00,24.5,true\n"
SETTINGS = {"mapping": {"external_id": "external_id", "site_name": "site_name", "observed_at": "observed_at", "water_temp": "temperature"}, "units": {"temperature": "degC"}, "timezone": "Asia/Kolkata"}


def upload(client, headers, content=CSV, connector_id=None):
    return client.post("/api/v1/imports/preview", files={"file": ("demo-ngo.csv", content, "text/csv")}, data={"synthetic": "true", **({"connector_id": connector_id} if connector_id else {})}, headers=headers)


def test_mapping_requires_preview_then_approval_and_import_replay(client):
    headers = login(client, "manager@demo.aquarelay.local")
    preview = upload(client, headers)
    assert preview.status_code == 201, preview.text
    run_id = preview.json()["id"]
    assert client.post(f"/api/v1/imports/{run_id}/approve", headers=headers).status_code == 409
    missing = client.post(f"/api/v1/imports/{run_id}/transform", json={"mapping": SETTINGS["mapping"]}, headers=headers)
    assert missing.status_code == 200, missing.text
    assert missing.json()["unresolved"] == 1
    mapped = client.post(f"/api/v1/imports/{run_id}/transform", json=SETTINGS, headers=headers)
    assert mapped.json()["counts"]["ready"] == 1
    approved = client.post(f"/api/v1/imports/{run_id}/approve", headers=headers)
    assert approved.status_code == 200, approved.text
    assert approved.json()["imported"] == 1
    passport = client.get("/api/v1/waterbodies/wb-reedwater").json()
    assert any(o["parameter"] == "temperature" and o["value"] == 24.5 for o in passport["observations"])
    second = upload(client, headers).json()["id"]
    client.post(f"/api/v1/imports/{second}/transform", json=SETTINGS, headers=headers)
    replay = client.post(f"/api/v1/imports/{second}/approve", headers=headers)
    assert replay.json()["imported"] == 0
    assert replay.json()["duplicate"] == 1
    from app.db import SessionLocal
    from app.models import Observation, MappingVersion
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Observation).where(Observation.external_id == "ngo-1")) == 1
        assert db.scalar(select(func.count()).select_from(MappingVersion)) >= 2


def test_schema_change_and_source_correction_preserve_prior_observation(client):
    headers = login(client, "manager@demo.aquarelay.local")
    first = upload(client, headers).json()["id"]
    client.post(f"/api/v1/imports/{first}/transform", json=SETTINGS, headers=headers)
    result = client.post(f"/api/v1/imports/{first}/approve", headers=headers).json()
    changed = CSV.replace(b"24.5", b"30.2").replace(b"synthetic\n", b"synthetic,new_column\n").replace(b"true\n", b"true,new\n")
    second = upload(client, headers, changed, result["connector_id"])
    assert second.json()["schema_changed"] is True
    second_id = second.json()["id"]
    client.post(f"/api/v1/imports/{second_id}/transform", json=SETTINGS, headers=headers)
    correction = client.post(f"/api/v1/imports/{second_id}/approve", headers=headers).json()
    assert correction["unresolved"] == 1
    assert correction["imported"] == 0
    assert any(i["code"] == "source_correction" for i in correction["issues"])


def test_connector_permission_and_credentials_redaction(client):
    citizen = login(client)
    assert client.get("/api/v1/connectors").status_code == 403
    client.post("/api/v1/auth/logout", headers=citizen)
    headers = login(client, "manager@demo.aquarelay.local")
    connector = client.post("/api/v1/connectors", json={"name": "Demo HTTP connector", "kind": "http_json"}, headers=headers)
    connector_id = connector.json()["id"]
    config = client.post(f"/api/v1/connectors/{connector_id}/configure", json={"headers": {"Authorization": "Bearer SECRET-KEY"}, "webhook_secret": "WEBHOOK-SECRET"}, headers=headers)
    assert config.status_code == 200
    assert "SECRET-KEY" not in config.text and "WEBHOOK-SECRET" not in config.text
    tested = client.post(f"/api/v1/connectors/{connector_id}/test", headers=headers)
    assert tested.json()["ok"] is False
    assert tested.json()["connector"]["state"] == "error"
    assert tested.json()["connector"]["retry_history"]
    client.post("/api/v1/auth/logout", headers=headers)
    login(client, "other@demo.aquarelay.local")
    assert client.get(f"/api/v1/connectors/{connector_id}").status_code == 403


def test_downloadable_sample_xlsx_imports_real_rows(client):
    headers = login(client, "manager@demo.aquarelay.local")
    downloaded = client.get("/api/v1/imports/sample/xlsx")
    assert downloaded.status_code == 200
    preview = client.post("/api/v1/imports/preview", files={"file": ("synthetic.xlsx", downloaded.content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}, headers=headers)
    assert preview.status_code == 201, preview.text
    assert len(preview.json()["rows"]) == 3
    assert preview.json()["synthetic"] is True


def test_stale_connector_and_failure_recovery_retain_observations(client, monkeypatch):
    from app import integrations
    from app.db import SessionLocal
    from app.models import Connector
    headers = login(client, "manager@demo.aquarelay.local")
    preview = upload(client, headers).json()["id"]
    client.post(f"/api/v1/imports/{preview}/transform", json=SETTINGS, headers=headers)
    approved = client.post(f"/api/v1/imports/{preview}/approve", headers=headers).json()
    connector_id = approved["connector_id"]
    with SessionLocal() as db:
        connector = db.get(Connector, connector_id)
        connector.kind = "http_json"
        connector.config = {**connector.config, "url": "https://example.org/records"}
        connector.last_observed_at = "2020-01-01T00:00:00+00:00"
        db.commit()
    assert client.get(f"/api/v1/connectors/{connector_id}").json()["connector"]["state"] == "stale"
    # The remote network is the only fake: real routes, runs, database and replay are exercised.
    def failed_fetch(*args):
        raise OSError("Source unreachable")
    monkeypatch.setattr(integrations, "safe_fetch_json", failed_fetch)
    failed = client.post(f"/api/v1/connectors/{connector_id}/sync", headers=headers)
    assert failed.json()["ok"] is False
    assert failed.json()["connector"]["state"] == "error"
    assert client.post(f"/api/v1/connectors/{connector_id}/sync", headers=headers).status_code == 429
    with SessionLocal() as db:
        connector = db.get(Connector, connector_id)
        connector.data = {**connector.data, "next_retry_at": "2000-01-01T00:00:00+00:00"}
        db.commit()
    rows = [{"external_id": "ngo-1", "site_name": "Demo Reedwater Lake", "observed_at": "2026-09-30T10:00:00", "water_temp": "24.5", "synthetic": "true"}]
    monkeypatch.setattr(integrations, "safe_fetch_json", lambda *args: rows)
    recovered = client.post(f"/api/v1/connectors/{connector_id}/sync", headers=headers)
    assert recovered.json()["ok"] is True, recovered.text
    assert recovered.json()["duplicate"] == 1
    assert recovered.json()["connector"]["error"] is None


def test_signed_webhook_replay_persists_one_preview(client):
    headers = login(client, "manager@demo.aquarelay.local")
    connector_id = client.post("/api/v1/connectors", json={"name": "Demo signed source"}, headers=headers).json()["id"]
    client.post(f"/api/v1/connectors/{connector_id}/configure", json={"webhook_secret": "webhook-secret"}, headers=headers)
    payload = json.dumps({"event_id": "event-001", "records": [{"site_name": "Demo Reedwater Lake", "value": 20}]}, separators=(",", ":")).encode()
    stamp = str(int(time.time()))
    signature = hmac.new(b"webhook-secret", stamp.encode() + b"." + payload, hashlib.sha256).hexdigest()
    signed = {"Content-Type": "application/json", "X-AquaRelay-Timestamp": stamp, "X-AquaRelay-Signature": "sha256=" + signature}
    first = client.post(f"/api/v1/webhooks/{connector_id}", content=payload, headers=signed)
    assert first.status_code == 200, first.text
    second = client.post(f"/api/v1/webhooks/{connector_id}", content=payload, headers=signed)
    assert second.json()["replay"] is True
    assert second.json()["receipt_id"] == first.json()["receipt_id"]
    assert second.json()["run_id"] == first.json()["run_id"]
    assert client.post(f"/api/v1/webhooks/{connector_id}", content=payload + b" ", headers=signed).status_code == 401


def test_standards_receiver_and_durable_handoff_distinguish_acknowledgement(client):
    headers = login(client, "manager@demo.aquarelay.local")
    exported = client.get("/api/v1/standards/wb-reedwater/fhir")
    assert exported.status_code == 200
    assert exported.json()["resourceType"] == "Bundle"
    direct = client.post("/api/v1/demo/receiver", json=exported.json(), headers=headers)
    assert direct.status_code == 201, direct.text
    assert direct.json()["validation"]["full_validation"] is False
    assert direct.json()["acknowledged"] is False
    queued = client.post("/api/v1/handoffs/wb-reedwater", json={"client_id": "handoff-test-1", "format": "fhir"}, headers=headers)
    assert queued.status_code == 202, queued.text
    assert queued.json()["state"] == "queued"
    from app.worker import process_jobs
    from app.db import SessionLocal
    with SessionLocal() as db:
        process_jobs(db)
        process_jobs(db)
    delivered = client.get("/api/v1/receipts/" + queued.json()["id"])
    assert delivered.json()["state"] == "delivered"
    assert delivered.json()["acknowledged"] is False
    assert delivered.json()["received_receipt_id"]
    replay = client.post("/api/v1/handoffs/wb-reedwater", json={"client_id": "handoff-test-1", "format": "fhir"}, headers=headers)
    assert replay.json()["id"] == queued.json()["id"]


def test_durable_demo_polling_failure_recovery_is_explicit_and_replay_safe(client):
    headers = login(client, "manager@demo.aquarelay.local")
    created = client.post("/api/v1/connectors", json={"name": "Demo scenario source", "kind": "demo_fixture"}, headers=headers)
    assert created.status_code == 201, created.text
    connector_id = created.json()["id"]
    tested = client.post(f"/api/v1/connectors/{connector_id}/test", headers=headers)
    assert tested.json()["ok"] is True, tested.text
    run_id = tested.json()["run_id"]
    mapping = {"mapping": {"external_id": "external_id", "site_name": "site_name", "observed_at": "observed_at", "parameter": "parameter", "value": "value", "unit": "unit"}}
    client.post(f"/api/v1/imports/{run_id}/transform", json=mapping, headers=headers)
    approved = client.post(f"/api/v1/imports/{run_id}/approve", headers=headers)
    assert approved.json()["imported"] == 2
    scheduled = client.post(f"/api/v1/connectors/{connector_id}/configure", json={"poll_interval_minutes": 1}, headers=headers)
    assert scheduled.status_code == 200
    from app.db import SessionLocal
    from app.models import Job
    from app.integrations import schedule_due_connectors
    from app.worker import process_jobs
    with SessionLocal() as db:
        schedule_due_connectors(db)
        schedule_due_connectors(db)
        assert db.scalar(select(func.count()).select_from(Job).where(Job.kind == "connector_sync", Job.dedup_key.like("connector_sync:" + connector_id + ":%"))) == 1
        process_jobs(db)
    history = client.get(f"/api/v1/connectors/{connector_id}").json()
    assert any(run["counts"].get("duplicate") == 2 for run in history["runs"])
    broken = client.post(f"/api/v1/connectors/{connector_id}/scenario", json={"state": "failure"}, headers=headers)
    assert broken.status_code == 200
    failed = client.post(f"/api/v1/connectors/{connector_id}/sync", headers=headers)
    assert failed.json()["ok"] is False
    assert "Demo scenario" in failed.json()["error"]
    restored = client.post(f"/api/v1/connectors/{connector_id}/scenario", json={"state": "recovered"}, headers=headers)
    assert restored.status_code == 200
    recovered = client.post(f"/api/v1/connectors/{connector_id}/sync", headers=headers)
    assert recovered.json()["ok"] is True
    assert recovered.json()["duplicate"] == 2
    assert recovered.json()["connector"]["synthetic"] is True
