import io
import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from conftest import TEST_ROOT


@pytest.fixture
def client():
    from app.main import app
    from app.main import traffic,auth_traffic
    from app.db import Base, engine, SessionLocal
    from app.seed import seed
    assert "aquarelay-tests-" in str(engine.url),"Refuse to reset a non-test database"
    traffic.clear()
    auth_traffic.clear()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    with TestClient(app) as c:
        yield c


def login(client, email="citizen@demo.aquarelay.local"):
    csrf = client.get("/api/v1/auth/session").json()["csrf_token"]
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "DemoPass123!"}, headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200, response.text
    token = response.json()["user"]["csrf_token"]
    return {"X-CSRF-Token": token}


def report_payload(client_id="offline-test-001", **kwargs):
    return {"client_id": client_id, "waterbody_id": "wb-reedwater", "observation_type": "fish_mortality", "observed_at": "2026-09-29T10:00:00+05:30", "latitude": 12.979, "longitude": 77.587, "description": "Demo fish mortality observation; cause unknown.", "count_estimate": 4, "language": "en", "evidence_ids": [], "synthetic": True, **kwargs}


def test_registry_has_provenance_and_source_backed_relationships(client):
    response = client.get("/api/v1/waterbodies").json()
    assert response["total"] == 7
    lake = client.get("/api/v1/waterbodies/wb-reedwater").json()
    assert lake["waterbody"]["synthetic"] is True
    assert lake["sources"] and all(s["synthetic"] for s in lake["sources"])
    assert lake["relationships"] and all(r["source_id"] for r in lake["relationships"])
    assert lake["actions"] and lake["nearby"]


def test_submission_requires_csrf_and_replays_client_id(client):
    headers = login(client)
    assert client.post("/api/v1/reports", json=report_payload()).status_code == 403
    first = client.post("/api/v1/reports", json=report_payload(), headers=headers)
    assert first.status_code == 201, first.text
    replay = client.post("/api/v1/reports", json=report_payload(), headers=headers)
    assert replay.status_code == 200
    assert replay.json()["report"]["id"] == first.json()["report"]["id"]
    assert replay.json()["case_id"] == first.json()["case_id"]
    assert client.post("/api/v1/reports", json=report_payload(observed_at="2026-09-29T10:00:00"), headers=headers).status_code == 422


def test_citizens_cannot_manage_cases_and_other_org_cannot_manage(client):
    headers = login(client)
    assert client.post("/api/v1/cases/case-current/transition", json={"state": "acknowledged", "reason": "Test"}, headers=headers).status_code == 403
    client.post("/api/v1/auth/logout", headers=headers)
    headers = login(client, "other@demo.aquarelay.local")
    assert client.post("/api/v1/cases/case-current/transition", json={"state": "acknowledged", "reason": "Test"}, headers=headers).status_code == 403


def test_closure_requires_outcome_date_and_supporting_record(client):
    headers = login(client, "manager@demo.aquarelay.local")
    for state in ["acknowledged", "investigating", "action_in_progress"]:
        r = client.post("/api/v1/cases/case-current/transition", json={"state": state, "reason": "Demo scenario: recorded response"}, headers=headers)
        assert r.status_code == 200, r.text
    assert client.post("/api/v1/cases/case-current/transition", json={"state": "closed", "reason": "Done"}, headers=headers).status_code == 422
    action = client.post("/api/v1/cases/case-current/actions", json={"title": "Demo follow-up", "description": "Follow-up visit recorded, no environmental conclusion.", "completed_at": "2026-09-30T12:00:00Z"}, headers=headers)
    assert action.status_code == 201, action.text
    closed = client.post("/api/v1/cases/case-current/transition", json={"state": "closed", "reason": "Documentation complete", "outcome_category":"closed_without_confirmed_cause", "outcome": "Response documented; cause and condition not assessed.", "completed_at": "2026-09-30T12:00:00Z", "supporting_record": action.json()["id"]}, headers=headers)
    assert closed.status_code == 200, closed.text


def test_private_notes_and_reporter_contacts_do_not_leak(client):
    headers = login(client, "manager@demo.aquarelay.local")
    assert client.post("/api/v1/cases/case-current/notes", json={"text": "PRIVATE-MATERIAL", "private": True}, headers=headers).status_code == 201
    private = client.get("/api/v1/workspace").text
    assert "PRIVATE-MATERIAL" in private
    client.post("/api/v1/auth/logout", headers=headers)
    for path in ["/api/v1/cases/case-current", "/api/v1/cases/case-current/export", "/api/v1/waterbodies/wb-reedwater", "/api/v1/embed/wb-reedwater"]:
        body = client.get(path).text
        assert "PRIVATE-MATERIAL" not in body
        assert "citizen@demo.aquarelay.local" not in body


def test_notification_worker_is_durable_and_deduplicated(client):
    headers = login(client)
    assert client.post("/api/v1/following/wb-reedwater", headers=headers).status_code == 200
    new = client.post("/api/v1/reports", json=report_payload(), headers=headers)
    assert new.status_code == 201
    from app.worker import process_jobs
    from app.db import SessionLocal
    with SessionLocal() as db:
        process_jobs(db)
        process_jobs(db)
    notifications = client.get("/api/v1/notifications").json()["items"]
    matching = [n for n in notifications if n["case_id"] == new.json()["case_id"]]
    assert len(matching) == 1
    assert matching[0]["read"] is False


def test_image_upload_creates_persistent_exif_free_derivative(client):
    headers = login(client)
    pic = Image.new("RGB", (80, 60), "blue")
    exif = Image.Exif()
    exif[270] = "private camera description"
    buf = io.BytesIO()
    pic.save(buf, "JPEG", exif=exif)
    uploaded = client.post("/api/v1/evidence", files={"file": ("evidence.jpg", buf.getvalue(), "image/jpeg")}, data={"synthetic": "true", "caption": "Demo illustration"}, headers=headers)
    assert uploaded.status_code == 201, uploaded.text
    obj = uploaded.json()
    public_before = client.get(obj["url"])
    assert public_before.status_code == 403
    report = client.post("/api/v1/reports", json=report_payload(evidence_ids=[obj["id"]]), headers=headers)
    assert report.status_code == 201, report.text
    derivative = client.get(obj["url"])
    assert derivative.status_code == 200
    assert not Image.open(io.BytesIO(derivative.content)).getexif()
    from app.db import SessionLocal
    from app.models import Evidence
    with SessionLocal() as db:
        row = db.get(Evidence, obj["id"])
        assert Path(row.original_path).exists()
        assert Path(row.public_path).exists()


def test_historical_passport_excludes_later_records(client):
    history = client.get("/api/v1/waterbodies/wb-reedwater?as_of=2026-06-01T00:00:00Z").json()
    assert all(e["created_at"] <= "2026-06-01T00:00:00+00:00" for e in history["events"])
    assert not any(c["id"] == "case-current" for c in history["cases"])


def test_historical_snapshot_reconstructs_workflow_and_date_bounds(client):
    from app.db import SessionLocal
    from app.models import Case
    with SessionLocal() as db:
        later=db.get(Case,"case-historical")
        later.data={**later.data,"outcome_category":"action_documented_completed"}
        db.commit()
    april=client.get("/api/v1/waterbodies/wb-reedwater?as_of=2026-04-15").json()
    assert april["waterbody"]["case_count"]==1
    assert april["waterbody"]["case_state"]=="new"
    assert april["cases"][0]["state"]=="new"
    assert not april["cases"][0]["outcome"]
    assert april["cases"][0]["outcome_category"] is None
    assert not april["actions"]
    assert not april["observations"]
    may=client.get("/api/v1/waterbodies/wb-reedwater?as_of=2026-05-20").json()
    assert may["waterbody"]["case_count"]==0
    assert may["waterbody"]["case_state"]=="No open cases — condition not assessed"
    filtered=client.get("/api/v1/waterbodies?start=2026-04-12&end=2026-04-12").json()
    assert [w["id"] for w in filtered["items"]]==["wb-reedwater"]


def test_video_upload_persists_a_decodable_public_derivative_without_private_tags(client):
    import av
    headers=login(client)
    video=io.BytesIO()
    with av.open(video,mode="w",format="mp4") as output:
        output.metadata["comment"]="PRIVATE-CAMERA-LOCATION"
        stream=output.add_stream("libx264",rate=12)
        stream.width=160; stream.height=120; stream.pix_fmt="yuv420p"
        for _ in range(12):
            frame=av.VideoFrame.from_image(Image.new("RGB",(160,120),"blue"))
            for packet in stream.encode(frame): output.mux(packet)
        for packet in stream.encode(): output.mux(packet)
    uploaded=client.post("/api/v1/evidence",files={"file":("demo.mp4",video.getvalue(),"video/mp4")},data={"synthetic":"true","caption":"Synthetic video illustration"},headers=headers)
    assert uploaded.status_code==201,uploaded.text
    obj=uploaded.json()
    assert obj["mime_type"]=="video/mp4"
    assert "silent" in obj["derivative_notice"].lower()
    created=client.post("/api/v1/reports",json=report_payload(evidence_ids=[obj["id"]]),headers=headers)
    assert created.status_code==201,created.text
    derivative=client.get(obj["url"])
    assert derivative.status_code==200
    with av.open(io.BytesIO(derivative.content),format="mp4") as public:
        assert "PRIVATE-CAMERA-LOCATION" not in str(public.metadata)
        assert not public.streams.audio
        assert len(list(public.decode(video=0)))==12


def test_reviewed_merge_preserves_report_origin_and_can_be_corrected(client):
    citizen=login(client)
    created=client.post("/api/v1/reports",json=report_payload(),headers=citizen).json()
    source=created["case_id"]
    client.post("/api/v1/auth/logout",headers=citizen)
    headers=login(client,"manager@demo.aquarelay.local")
    merged=client.post(f"/api/v1/cases/{source}/merge",json={"target_case_id":"case-current","reason":"Reviewer confirmed this report relates to the same recorded event."},headers=headers)
    assert merged.status_code==200,merged.text
    combined=client.get("/api/v1/cases/case-current").json()
    assert any(r["id"]==created["report"]["id"] and r["case_id"]==source for r in combined["reports"])
    assert source in [c["id"] for c in combined["merged_cases"]]
    corrected=client.post(f"/api/v1/cases/{source}/unmerge",json={"reason":"Corrected review: separate observations require separate handling."},headers=headers)
    assert corrected.status_code==200
    assert not client.get(f"/api/v1/cases/{source}").json()["case"]["merged_into"]
    combined=client.get("/api/v1/cases/case-current").json()
    assert not any(r["id"]==created["report"]["id"] for r in combined["reports"])
    assert any(e["kind"]=="merge_correction" for e in combined["events"])


def test_citizen_can_request_reopening_without_changing_case_state(client):
    headers=login(client)
    requested=client.post("/api/v1/cases/case-historical/reopen-request",json={"reason":"A new relevant observation needs an authorised follow-up review."},headers=headers)
    assert requested.status_code==201,requested.text
    assert client.get("/api/v1/cases/case-historical").json()["case"]["state"]=="closed"
    assert client.post("/api/v1/cases/case-historical/transition",json={"state":"reopened","reason":"Request"},headers=headers).status_code==403


@pytest.mark.parametrize("path",["/cases","/actions","/sources"])
def test_public_pagination_rejects_invalid_bounds(client,path):
    assert client.get("/api/v1"+path+"?page=-1").status_code==422
    assert client.get("/api/v1"+path+"?page_size=0").status_code==422
    assert client.get("/api/v1"+path+"?page_size=101").status_code==422


def test_report_review_is_separate_from_case_workflow(client):
    headers=login(client,"manager@demo.aquarelay.local")
    response=client.post("/api/v1/reports/report-current/review",json={"review_state":"needs_information","reason":"Observation time and a clearer viewpoint are needed."},headers=headers)
    assert response.status_code==200,response.text
    case=client.get("/api/v1/cases/case-current").json()
    assert case["case"]["state"]=="new"
    assert case["case"]["review_state"]=="unreviewed"
    assert case["reports"][0]["review_state"]=="needs_information"
    assert len(case["reports"][0]["review_history"])==1


def test_daily_preferences_batch_updates_in_persisted_digest(client):
    headers=login(client)
    client.post("/api/v1/following/wb-reedwater",headers=headers)
    assert client.put("/api/v1/preferences",json={"digest":"daily","timezone":"Asia/Kolkata"},headers=headers).status_code==200
    client.post("/api/v1/reports",json=report_payload(),headers=headers)
    client.post("/api/v1/reports",json=report_payload("second-digest-client"),headers=headers)
    from app.worker import process_jobs
    from app.db import SessionLocal
    from app.models import Notification
    from sqlalchemy import select
    with SessionLocal() as db:
        process_jobs(db)
        rows=list(db.scalars(select(Notification).where(Notification.user_id=="user-citizen")))
        assert len(rows)==1
        assert len(rows[0].data["event_ids"])==2
        assert rows[0].available_at>rows[0].created_at
    assert client.get("/api/v1/notifications").json()["items"]==[]


def test_governed_evidence_deletion_removes_original_and_derivative(client):
    headers=login(client)
    image=io.BytesIO();Image.new("RGB",(20,20),"blue").save(image,"PNG")
    evidence=client.post("/api/v1/evidence",files={"file":("demo.png",image.getvalue(),"image/png")},data={"synthetic":"true"},headers=headers).json()
    from app.db import SessionLocal
    from app.models import Evidence
    with SessionLocal() as db:
        row=db.get(Evidence,evidence["id"])
        paths=[Path(row.original_path),Path(row.public_path)]
    removed=client.request("DELETE","/api/v1/evidence/"+evidence["id"],json={"reason":"Uploader requests removal of sensitive evidence media."},headers=headers)
    assert removed.status_code==200,removed.text
    assert not any(p.exists() for p in paths)
    assert client.get(evidence["url"]).status_code==403


def test_candidate_rules_explain_time_type_and_location_without_mutating(client):
    params={"waterbody_id":"wb-reedwater","observed_at":"2026-09-29T10:00:00Z","type":"fish_mortality","latitude":12.979,"longitude":77.587}
    candidates=client.get("/api/v1/reports/candidates",params=params)
    assert candidates.status_code==200,candidates.text
    assert [item["case"]["id"] for item in candidates.json()["items"]]==["case-current"]
    assert len(candidates.json()["items"][0]["reasons"])>=3
    assert client.get("/api/v1/reports/candidates",params={**params,"type":"oil_film"}).json()["items"]==[]
    assert client.get("/api/v1/reports/candidates",params={**params,"observed_at":"2026-08-01T10:00:00Z"}).json()["items"]==[]
    assert client.get("/api/v1/cases").json()["total"]==3


def test_legacy_historical_closure_never_uses_later_case_outcome(client):
    from app.db import SessionLocal
    from app.models import Case,Event
    with SessionLocal() as db:
        old=db.get(Event,"event-closure")
        old.data={"state":"closed"}
        case=db.get(Case,"case-historical")
        case.data={**case.data,"outcome":"FUTURE-RECLOSURE-OUTCOME","completed_at":"2026-09-30T12:00:00+00:00"}
        db.commit()
    history=client.get("/api/v1/waterbodies/wb-reedwater?as_of=2026-05-20").json()
    item=history["cases"][0]
    assert item["outcome"] is None
    assert item["completed_at"] is None


def test_malformed_image_is_a_validation_error(client):
    headers=login(client)
    malformed=b'\x89PNG\r\n\x1a\n'+b'\x00'*100
    response=client.post("/api/v1/evidence",files={"file":("bad.png",malformed,"image/png")},headers=headers)
    assert response.status_code==422
