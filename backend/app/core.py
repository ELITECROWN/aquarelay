"""Public registry and organisation-scoped workflow API."""
import asyncio
import hashlib
import html
import io
import json
import math
import os
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit,parse_qsl,urlencode
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, or_,text,cast,String
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm import object_session
from starlette.concurrency import run_in_threadpool
from .auth import current_user, require_user, require_manager
from .db import get_db, SessionLocal
from .models import *
from .storage import storage,sanitise_video
from .push import configured as push_configured

router = APIRouter()
STORAGE_PATH = Path(os.getenv("STORAGE_PATH", "./data/files")).resolve()
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
STATES = {"new": {"under_review", "acknowledged"}, "under_review": {"acknowledged", "investigating"}, "acknowledged": {"investigating"}, "investigating": {"action_in_progress", "closed"}, "action_in_progress": {"investigating", "closed"}, "closed": {"reopened"}, "reopened": {"investigating", "acknowledged"}}

def iso(value, end_of_day=False):
    if isinstance(value, str):
        if len(value)==10:
            try:
                date=datetime.strptime(value,"%Y-%m-%d").replace(tzinfo=timezone.utc)
                return (date+timedelta(days=1,microseconds=-1) if end_of_day else date).isoformat()
            except ValueError:
                raise HTTPException(422,"Invalid calendar date.")
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(422, "Timestamp must be an ISO date and time with timezone.")
    if not value.tzinfo:
        raise HTTPException(422, "A timezone is required; it will not be guessed.")
    return value.astimezone(timezone.utc).isoformat()

def get_record(db, cls, record_id):
    row = db.get(cls, record_id)
    if not row or (not DEMO_MODE and getattr(row, 'synthetic', False)):
        raise HTTPException(404, "Record not found.")
    return row

def organisation_case(db, case_id, user):
    case = get_record(db, Case, case_id)
    if case.organisation_id != user.organisation_id:
        raise HTTPException(403, "This case is assigned to a different organisation.")
    return case

def emit_event(db, waterbody_id, case_id, kind, title, description, actor_id, source_id=None):
    wb = db.get(WaterBody, waterbody_id)
    if db.bind.dialect.name=="postgresql":
        # Hold allocation order until transaction commit so SSE cannot skip a late commit.
        db.execute(text("SELECT pg_advisory_xact_lock(61782615390001)"))
    cursor=db.scalar(text("SELECT nextval('public_event_cursor_seq')")) if db.bind.dialect.name=="postgresql" else max(time.time_ns()//1000,(db.scalar(select(func.max(Event.sequence))) or 0)+1)
    event = Event(id=uid("event"), sequence=cursor, waterbody_id=waterbody_id, case_id=case_id, kind=kind, title=title, description=description, actor_id=actor_id, source_id=source_id, synthetic=bool(wb and wb.synthetic))
    db.add(event)
    db.flush()
    db.add(Job(id=uid("job"), kind="notify", dedup_key="notify:" + event.id, data={"event_id": event.id}))
    return event

def event_json(row):
    result={k: getattr(row, k) for k in ("id", "waterbody_id", "case_id", "kind", "title", "description", "created_at", "source_id", "synthetic", "sequence")}
    db=object_session(row)
    actor=db.get(User,row.actor_id) if db and row.actor_id and row.kind!="report" else None
    membership=db.scalar(select(Membership).where(Membership.user_id==actor.id,Membership.organisation_id==actor.organisation_id,Membership.role.in_(["manager","admin","reviewer"]))) if actor and actor.organisation_id and row.kind!="reopening_request" else None
    org=db.get(Organisation,actor.organisation_id) if membership else None
    if org:
        result.update(actor_organisation_id=org.id,actor_organisation_name=org.name)
    return result

def source_json(row):
    result={k: getattr(row, k) for k in ("id", "waterbody_id", "organisation_id", "connector_id", "name", "kind", "url", "license", "attribution", "observed_at", "received_at", "source_updated_at", "state", "synthetic", "created_at")}
    db=object_session(row)
    if db and row.connector_id:
        connector=db.get(Connector,row.connector_id)
        if connector:
            from .integrations import connector_dict
            result["state"]=connector_dict(connector)["state"]
    if result["url"]:
        parsed=urlsplit(result["url"])
        if parsed.scheme not in {"http","https"}: result["url"]=""
        else:
            hidden={"key","api_key","apikey","token","access_token","password","secret","signature"}
            query=urlencode([(k,"REDACTED" if k.lower() in hidden else v) for k,v in parse_qsl(parsed.query)])
            result["url"]=urlunsplit((parsed.scheme,parsed.netloc.rsplit("@",1)[-1],parsed.path,query,""))
    return result

def observation_json(row):
    return {k: getattr(row, k) for k in ("id", "waterbody_id", "source_id", "external_id", "parameter", "value", "unit", "observed_at", "received_at", "source_updated_at", "synthetic", "created_at")}

def case_json(db, row):
    wb = db.get(WaterBody, row.waterbody_id)
    result = {k: getattr(row, k) for k in ("id", "waterbody_id", "organisation_id", "title", "description", "state", "review_state", "delivery_state", "observed_at", "created_at", "synthetic")}
    result["waterbody_name"] = wb.name if wb else "Unknown water body"
    result["outcome"] = row.data.get("outcome")
    result["outcome_category"] = row.data.get("outcome_category")
    result["completed_at"] = row.data.get("completed_at")
    result["supporting_record"] = row.data.get("supporting_record")
    result["merged_into"] = row.data.get("merged_into")
    result["merge_status"] = "merged" if row.data.get("merged_into") else "separate"
    result["merge_history"] = row.data.get("merge_history",[])
    result["reopening_requests"] = row.data.get("reopening_requests",[])
    return result

def case_snapshot(db,row,cutoff):
    item=case_json(db,row)
    history=list(db.scalars(select(Event).where(Event.case_id==row.id,Event.created_at<=cutoff).order_by(Event.sequence.desc())))
    transitions=[e for e in history if e.data.get("state")]
    reviews=[e for e in history if e.kind=="review" and e.data.get("review_state")]
    item["state"]=transitions[0].data["state"] if transitions else "new"
    item["review_state"]=reviews[0].data["review_state"] if reviews else "unreviewed"
    item["delivery_state"]="historical_status_unavailable"
    merge_history=[h for h in row.data.get("merge_history",[]) if h["created_at"]<=cutoff]
    item["merge_history"]=merge_history
    item["merged_into"]=merge_history[-1]["target_case_id"] if merge_history and merge_history[-1]["kind"]=="approved_merge" else None
    item["merge_status"]="merged" if item["merged_into"] else "separate"
    item["reopening_requests"]=[r for r in row.data.get("reopening_requests",[]) if r["created_at"]<=cutoff]
    if item["state"]!="closed":
        item.update(outcome=None,outcome_category=None,completed_at=None,supporting_record=None)
    else:
        closure=next((e for e in history if e.kind=="closure"),None)
        item.update({k:closure.data.get(k) if closure else None for k in ("outcome","outcome_category","completed_at","supporting_record")})
        if not item["outcome"]: item["closure_history_notice"]="The original closure explanation was not recorded in this historical event. Later conclusions are excluded."
    return item

def action_json(row):
    result={k: getattr(row, k) for k in ("id", "case_id", "waterbody_id", "organisation_id", "title", "description", "completed_at", "evidence_id", "synthetic", "created_at")}
    db=object_session(row)
    org=db.get(Organisation,row.organisation_id) if db else None
    result["organisation_name"]=org.name if org else None
    return result

def evidence_json(row):
    return {"id": row.id, "name": row.name, "caption": row.caption, "url": "/api/v1/evidence/" + row.id + "/file", "created_at": row.created_at, "synthetic": row.synthetic, "sha256": row.sha256, "integrity_notice": "File hash confirms integrity, not the truth of its content.", "visibility": row.visibility, "mime_type": row.mime_type,"derivative_notice":row.data.get("derivative_notice","Public image has metadata removed; original remains private.")}

def distance(a, b, c, d):
    lat1, lat2 = math.radians(a), math.radians(c)
    dx = math.radians(c-a)
    dy = math.radians(d-b)
    h = math.sin(dx/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dy/2)**2
    return 6371000 * 2 * math.atan2(math.sqrt(h), math.sqrt(max(0,1-h)))

def waterbody_json(db, row, as_of=None):
    cases = list(db.scalars(select(Case).where(Case.waterbody_id == row.id)))
    observations = list(db.scalars(select(Observation).where(Observation.waterbody_id == row.id)))
    source_ids={o.source_id for o in observations} | set(db.scalars(select(Event.source_id).where(Event.waterbody_id==row.id,Event.source_id!=None)))
    sources = list(db.scalars(select(Source).where(or_(Source.waterbody_id == row.id,Source.id.in_(source_ids)))))
    if as_of:
        cases = [c for c in cases if c.created_at <= as_of]
        sources = [s for s in sources if s.created_at <= as_of]
        observations = [o for o in observations if o.created_at <= as_of and o.observed_at <= as_of]
    snapshots=[case_snapshot(db,c,as_of) for c in cases] if as_of else [case_json(db,c) for c in cases]
    open_cases = [c for c in snapshots if c["state"] != "closed" and not c.get("merged_into")]
    states = [c["state"] for c in open_cases]
    stale = any(source_json(s)["state"] in {"stale", "error", "disabled"} for s in sources)
    if stale and not as_of:
        data_state = "Data unavailable or outdated"
    elif observations:
        data_state = "Recorded observations available"
    else:
        data_state = "No measurements recorded"
    result = {k: getattr(row, k) for k in ("id", "name", "aliases", "type", "locality", "latitude", "longitude", "geometry", "summary", "synthetic", "created_at")}
    result.update(case_count=len(open_cases), total_case_count=len(cases), source_count=len(sources), latest_observed_at=max([o.observed_at for o in observations], default=None), case_state=states[0] if states else "No open cases — condition not assessed", data_state=data_state)
    return result

@router.get("/config")
def config():
    from .mail import configured
    return {"demo_mode": DEMO_MODE, "capabilities": {"database": "sqlite_local_fallback" if os.getenv("DATABASE_URL", "sqlite").startswith("sqlite") else "postgresql_postgis", "ai": "gemini_opt_in" if os.getenv('GEMINI_API_KEY') and os.getenv('GEMINI_MODEL') else "rules_based", "email": "account_email_configured" if configured() else "unavailable", "push": "available" if push_configured() else "unavailable", "storage":os.getenv('STORAGE_BACKEND','local'), "external_delivery": "configuration_required", "uploads": "jpeg_png_webp_mp4", "standards_validation": "structural_subset_checks", "map_style_url": os.getenv("MAP_STYLE_URL", ""), "public_url": os.getenv("PUBLIC_URL", "http://localhost:5173")}, "district": {"name": "Demo Reedwater District" if DEMO_MODE else "Bengaluru", "synthetic": DEMO_MODE, "center": [77.592,12.977]}}

@router.get("/waterbodies")
def waterbodies(q: str = "", type: str = "", state: str = "", availability: str = "", start: str = "", end: str = "", lat: float | None = Query(None,ge=-90,le=90), lon: float | None = Query(None,ge=-180,le=180), radius: float | None = Query(None,gt=0,le=500000), page: int = 1, page_size: int = 50, db: Session = Depends(get_db)):
    if page < 1 or page_size < 1 or page_size > 100:
        raise HTTPException(422, "Page must be positive; page size must be 1–100.")
    start_iso, end_iso = iso(start) if start else None, iso(end,end_of_day=True) if end else None
    items=[]
    statement=select(WaterBody).order_by(WaterBody.name)
    if not DEMO_MODE: statement=statement.where(WaterBody.synthetic.is_(False))
    if type: statement=statement.where(WaterBody.type==type)
    if q:
        needle=q.lower()
        statement=statement.where(or_(func.lower(WaterBody.name).contains(needle,autoescape=True),func.lower(WaterBody.locality).contains(needle,autoescape=True),func.lower(cast(WaterBody.aliases,String)).contains(needle,autoescape=True)))
    if not any((state,availability,start_iso,end_iso)) and lat is None and lon is None and radius is None:
        total=db.scalar(select(func.count()).select_from(statement.subquery()))
        rows=db.scalars(statement.offset((page-1)*page_size).limit(page_size))
        return {"items":[waterbody_json(db,wb) for wb in rows],"total":total,"page":page,"page_size":page_size}
    if radius is not None and (lat is None or lon is None): raise HTTPException(422,"Radius search requires latitude and longitude.")
    if db.bind.dialect.name=="postgresql" and lat is not None and lon is not None and radius is not None:
        statement=statement.where(text("ST_DWithin(geog,ST_SetSRID(ST_MakePoint(:search_lon,:search_lat),4326)::geography,:search_radius)")).params(search_lon=lon,search_lat=lat,search_radius=radius)
    for wb in db.scalars(statement):
        if q and q.lower() not in " ".join([wb.name, wb.locality, *wb.aliases]).lower():
            continue
        if type and wb.type != type:
            continue
        item=waterbody_json(db,wb)
        if state and state not in {"all",item["case_state"]} and not db.scalar(select(Case.id).where(Case.waterbody_id==wb.id,Case.state==state)):
            continue
        if availability in {"available","observations"} and not item["latest_observed_at"]:
            continue
        if availability in {"outdated","stale"} and item["data_state"] != "Data unavailable or outdated":
            continue
        if start_iso or end_iso:
            dates=[e.created_at for e in db.scalars(select(Event).where(Event.waterbody_id==wb.id))]+list(db.scalars(select(Observation.observed_at).where(Observation.waterbody_id==wb.id)))
            if not any((not start_iso or t>=start_iso) and (not end_iso or t<=end_iso) for t in dates):
                continue
        if lat is not None and lon is not None:
            if not -90<=lat<=90 or not -180<=lon<=180:
                raise HTTPException(422,"Coordinates out of range.")
            item["distance_m"]=round(distance(lat,lon,wb.latitude,wb.longitude))
            if db.bind.dialect.name!="postgresql" and radius is not None and item["distance_m"]>radius:
                continue
        items.append(item)
    if lat is not None and lon is not None:
        items.sort(key=lambda i:i["distance_m"])
    return {"items":items[(page-1)*page_size:page*page_size],"total":len(items),"page":page,"page_size":page_size}

@router.get('/waterbodies/map')
def registry_map(q:str='',type:str='',db:Session=Depends(get_db)):
    statement=select(WaterBody).order_by(WaterBody.name,WaterBody.id)
    if not DEMO_MODE:statement=statement.where(WaterBody.synthetic.is_(False))
    if type:statement=statement.where(WaterBody.type==type)
    if q:
        needle=q.lower()
        statement=statement.where(or_(func.lower(WaterBody.name).contains(needle,autoescape=True),func.lower(WaterBody.locality).contains(needle,autoescape=True),func.lower(cast(WaterBody.aliases,String)).contains(needle,autoescape=True)))
    total=db.scalar(select(func.count()).select_from(statement.subquery()))
    rows=list(db.scalars(statement.limit(5000)))
    counts=dict(db.execute(select(Case.waterbody_id,func.count()).where(Case.waterbody_id.in_([w.id for w in rows]),Case.state!='closed',or_(Case.data['merged_into'].as_string().is_(None),Case.data['merged_into'].as_string()=='')).group_by(Case.waterbody_id)).all()) if rows else {}
    keys=('id','name','type','latitude','longitude','geometry','synthetic')
    return {'items':[{**{k:getattr(w,k) for k in keys},'case_count':counts.get(w.id,0)} for w in rows],'total':total,'truncated':total>len(rows)}

@router.get("/waterbodies/{waterbody_id}")
def passport(waterbody_id: str, as_of: str = "", since: str = "", db: Session = Depends(get_db)):
    from .authority_directory import regional_contacts
    wb=get_record(db,WaterBody,waterbody_id)
    cutoff=iso(as_of,end_of_day=True) if as_of else None
    since_time=iso(since) if since else (datetime.now(timezone.utc)-timedelta(days=30)).isoformat()
    def visible(rows, date="created_at"):
        return [r for r in rows if not cutoff or (r.created_at<=cutoff and getattr(r,date)<=cutoff)]
    events=visible(list(db.scalars(select(Event).where(Event.waterbody_id==wb.id).order_by(Event.sequence.desc()))))
    observations=visible(list(db.scalars(select(Observation).where(Observation.waterbody_id==wb.id).order_by(Observation.observed_at.desc()))),"observed_at")
    source_ids={o.source_id for o in observations} | {e.source_id for e in events if e.source_id}
    source_ids |= set(db.scalars(select(Biodiversity.source_id).where(Biodiversity.waterbody_id==wb.id)))
    sources=visible(list(db.scalars(select(Source).where(or_(Source.waterbody_id==wb.id,Source.id.in_(source_ids))))))
    cases=visible(list(db.scalars(select(Case).where(Case.waterbody_id==wb.id).order_by(Case.created_at.desc()))))
    action_rows=visible(list(db.scalars(select(Action).where(Action.waterbody_id==wb.id))),"completed_at")
    biodiversity=visible(list(db.scalars(select(Biodiversity).where(Biodiversity.waterbody_id==wb.id))),"observed_at")
    relations=visible(list(db.scalars(select(Relationship).where(Relationship.waterbody_id==wb.id))))
    nearby=[]
    near_statement=select(WaterBody).where(WaterBody.id!=wb.id)
    if not DEMO_MODE: near_statement=near_statement.where(WaterBody.synthetic.is_(False))
    if db.bind.dialect.name=="postgresql":
        near_statement=near_statement.where(text("ST_DWithin(geog,ST_SetSRID(ST_MakePoint(:near_lon,:near_lat),4326)::geography,5000)")).params(near_lon=wb.longitude,near_lat=wb.latitude)
    for other in db.scalars(near_statement):
        if cutoff and other.created_at>cutoff:
            continue
        d=distance(wb.latitude,wb.longitude,other.latitude,other.longitude)
        if d<=5000:
            nearby.append({**waterbody_json(db,other,cutoff),"distance_m":round(d),"connection_notice":"Nearby distance does not establish a hydrological connection."})
    org_ids={s.organisation_id for s in sources if s.organisation_id} | {c.organisation_id for c in cases if c.organisation_id}
    changes=[{"record_id":e.id,"title":e.title,"created_at":e.created_at,"href":f"/incidents/{e.case_id}" if e.case_id else f"/waterbodies/{wb.id}","description":e.description} for e in events if e.created_at>=since_time]
    case_items=[case_snapshot(db,c,cutoff) if cutoff else case_json(db,c) for c in cases]
    return {"waterbody":waterbody_json(db,wb,cutoff),"events":[event_json(e) for e in events],"observations":[observation_json(o) for o in observations],"biodiversity":[{"id":b.id,"common_name":b.common_name,"scientific_name":b.scientific_name,"source_id":b.source_id,"observed_at":b.observed_at,"synthetic":b.synthetic,"location_notice":"Precise location withheld" if b.restricted else "Water-body level only"} for b in biodiversity],"cases":case_items,"actions":[action_json(a) for a in action_rows],"sources":[source_json(s) for s in sources],"relationships":[{k:getattr(r,k) for k in ("id","waterbody_id","target_type","target_id","kind","description","source_id","synthetic","created_at")} for r in relations],"nearby":sorted(nearby,key=lambda n:n["distance_m"]),"organisations":[organisation_json(db.get(Organisation,i)) for i in org_ids],"authorities":regional_contacts(db,wb),"changes":changes,"summary_notice":"Rules-based summary cites stored records and does not assess water safety."}

@router.get("/cases")
def cases(waterbody_id: str="", state: str="", page:int=Query(1,ge=1),page_size:int=Query(50,ge=1,le=100),db:Session=Depends(get_db)):
    stmt=select(Case).order_by(Case.created_at.desc())
    if not DEMO_MODE: stmt=stmt.where(Case.synthetic.is_(False))
    if waterbody_id: stmt=stmt.where(Case.waterbody_id==waterbody_id)
    if state: stmt=stmt.where(Case.state==state)
    rows=list(db.scalars(stmt))
    return {"items":[case_json(db,c) for c in rows[max(0,page-1)*min(page_size,100):page*min(page_size,100)]],"total":len(rows)}

@router.get("/reports/candidates")
def related_candidates(waterbody_id:str,observed_at:str,type:str,latitude:float|None=Query(None,ge=-90,le=90),longitude:float|None=Query(None,ge=-180,le=180),db:Session=Depends(get_db)):
    wb=get_record(db,WaterBody,waterbody_id)
    observed=datetime.fromisoformat(iso(observed_at))
    rows=[]
    for case in db.scalars(select(Case).where(Case.waterbody_id==wb.id).order_by(Case.observed_at.desc()).limit(100)):
        if case.data.get("merged_into"): continue
        reports=list(db.scalars(select(Report).where(Report.case_id==case.id,Report.observation_type==type)))
        if not reports: continue
        matching=[]
        for report in reports:
            delta=abs((datetime.fromisoformat(report.observed_at)-observed).total_seconds())
            if delta>7*86400: continue
            reasons=["Same registered water body",f"Same reported observation type: {type.replace('_',' ')}",f"Recorded times are within 7 days ({delta/86400:.1f} days apart)"]
            if latitude is not None and longitude is not None and report.latitude is not None and report.longitude is not None:
                apart=distance(latitude,longitude,report.latitude,report.longitude)
                if apart>1000: continue
                reasons.append(f"Approximate report positions are within 1 km ({round(apart)} m apart)")
            else:
                reasons.append("Precise position comparison unavailable; location basis is the registered water-body identity")
            matching.append((delta,reasons))
        if matching:
            delta,reasons=min(matching,key=lambda item:item[0])
            rows.append({"case":case_json(db,case),"reasons":reasons,"time_difference_seconds":int(delta)})
    rows.sort(key=lambda item:item["time_difference_seconds"])
    return {"items":rows[:10],"assistance":"Rules-based candidates — a reviewer must confirm related records; no automatic merge.","rules":{"same_waterbody":True,"same_observation_type":True,"maximum_days":7,"maximum_distance_m":1000,"limit":10}}

@router.get("/cases/{case_id}")
def case_detail(case_id:str,db:Session=Depends(get_db)):
    case=get_record(db,Case,case_id)
    merged_cases=[c for c in db.scalars(select(Case).where(Case.waterbody_id==case.waterbody_id)) if c.data.get("merged_into")==case.id]
    origin_ids=[case.id,*[c.id for c in merged_cases]]
    reports=list(db.scalars(select(Report).where(Report.case_id.in_(origin_ids))))
    evidence=list(db.scalars(select(Evidence).where(Evidence.case_id.in_(origin_ids),Evidence.visibility=="public")))
    notes=list(db.scalars(select(Note).where(Note.case_id==case.id,Note.private==False)))
    receipts=list(db.scalars(select(Receipt).where(Receipt.waterbody_id==case.waterbody_id)))
    return {"case":case_json(db,case),"merged_cases":[case_json(db,c) for c in merged_cases],"reports":[{k:getattr(r,k) for k in ("id","case_id","waterbody_id","observation_type","description","observed_at","received_at","count_estimate","language","synthetic","created_at")} | {"review_state":r.data.get("review_state","submitted"),"review_history":r.data.get("review_history",[])} for r in reports],"evidence":[evidence_json(e) for e in evidence],"events":[event_json(e) for e in db.scalars(select(Event).where(Event.case_id.in_(origin_ids)).order_by(Event.sequence.desc()))],"actions":[action_json(a) for a in db.scalars(select(Action).where(Action.case_id.in_(origin_ids)))],"evidence_requests":[{k:getattr(r,k) for k in ("id","description","state","created_at","synthetic")} for r in db.scalars(select(EvidenceRequest).where(EvidenceRequest.case_id.in_(origin_ids)))],"notes":[{"id":n.id,"text":n.text,"private":False,"created_at":n.created_at} for n in notes],"delivery":{"state":case.delivery_state,"receipts":[{"id":r.id,"state":r.state,"kind":r.kind,"created_at":r.created_at,"synthetic":bool(r.data.get("synthetic",DEMO_MODE))} for r in receipts],"notice":"Delivery and recipient acknowledgement are separate records. The local receiver is a demo endpoint."}}

@router.get("/cases/{case_id}/export")
def export_case(case_id:str, db:Session=Depends(get_db)):
    return {"product":"AquaRelay","exported_at":utcnow(),"synthetic_notice":"DEMO — SYNTHETIC RECORDS" if get_record(db,Case,case_id).synthetic else None,"privacy":"Reporter contacts, private notes and original media excluded.",**case_detail(case_id,db)}

class ReportInput(BaseModel):
    client_id:str=Field(min_length=8,max_length=100)
    waterbody_id:str
    observation_type:str=Field(min_length=2,max_length=80)
    observed_at:datetime
    latitude:float|None=Field(default=None,ge=-90,le=90)
    longitude:float|None=Field(default=None,ge=-180,le=180)
    description:str=Field(min_length=8,max_length=12000)
    count_estimate:int|str|None=None
    language:str=Field(default="en",max_length=80)
    evidence_ids:list[str]=Field(default_factory=list,max_length=10)
    related_case_id:str|None=None
    synthetic:bool=False
    @field_validator("observed_at")
    @classmethod
    def timezone_required(cls,v):
        if not v.tzinfo: raise ValueError("Explicit timezone required.")
        return v

@router.post("/reports", status_code=201)
def submit_report(body:ReportInput,response:Response,db:Session=Depends(get_db),user:User=Depends(require_user)):
    existing=db.scalar(select(Report).where(Report.user_id==user.id,Report.client_id==body.client_id))
    if existing:
        response.status_code=200
        return {"report":{"id":existing.id,"client_id":existing.client_id,"created_at":existing.created_at,"synthetic":existing.synthetic},"case_id":existing.case_id,"replayed":True}
    wb=get_record(db,WaterBody,body.waterbody_id)
    db.refresh(wb,with_for_update={'key_share':True})
    if body.synthetic and not DEMO_MODE:
        raise HTTPException(422,"Synthetic submissions are disabled outside demo mode.")
    if wb.synthetic and not body.synthetic:
        raise HTTPException(422,"Mark this report as synthetic because the selected water body is a demonstration fixture.")
    recent=(datetime.now(timezone.utc)-timedelta(hours=1)).isoformat()
    if db.scalar(select(func.count()).select_from(Report).where(Report.user_id==user.id,Report.created_at>=recent))>=20:
        raise HTTPException(429,"Report limit reached. Please try again in an hour.")
    attached=[]
    for eid in body.evidence_ids:
        evidence=get_record(db,Evidence,eid)
        if evidence.user_id!=user.id or evidence.report_id:
            raise HTTPException(403,"Only your unsubmitted uploads can be attached.")
        if body.synthetic and not evidence.synthetic:
            raise HTTPException(422,"Demo evidence must be labelled synthetic.")
        attached.append(evidence)
    if body.related_case_id:
        case=get_record(db,Case,body.related_case_id)
        if case.waterbody_id!=wb.id:
            raise HTTPException(422,"The related case belongs to another water body.")
        if case.data.get("merged_into"):
            case=get_record(db,Case,case.data["merged_into"])
    else:
        assigned=wb.data.get("responsible_organisation_id")
        case=Case(id=uid("case"),waterbody_id=wb.id,organisation_id=assigned,title=body.observation_type.replace("_"," ").title()+" reported",description=body.description,observed_at=iso(body.observed_at),synthetic=body.synthetic)
        db.add(case)
        db.flush()
    report=Report(id=uid("report"),user_id=user.id,client_id=body.client_id,waterbody_id=wb.id,case_id=case.id,observation_type=body.observation_type,description=body.description,observed_at=iso(body.observed_at),latitude=body.latitude,longitude=body.longitude,count_estimate=body.count_estimate,language=body.language,synthetic=body.synthetic,data={"original_text":body.description})
    db.add(report)
    db.flush()
    for e in attached:
        e.report_id=report.id
        e.case_id=case.id
        e.visibility="public"
    event=emit_event(db,wb.id,case.id,"report", "Community report — not yet reviewed",body.description,user.id)
    event.data={"report_id":report.id,"state":case.state}
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="report_created",target_id=report.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing=db.scalar(select(Report).where(Report.user_id==user.id,Report.client_id==body.client_id))
        if existing:
            response.status_code=200
            return {"report":{"id":existing.id,"client_id":existing.client_id,"synthetic":existing.synthetic},"case_id":existing.case_id,"replayed":True}
        raise
    return {"report":{"id":report.id,"client_id":report.client_id,"created_at":report.created_at,"synthetic":report.synthetic},"case_id":case.id}

@router.post("/evidence",status_code=201)
async def upload_evidence(file:UploadFile=File(...),synthetic:bool=Form(False),caption:str=Form(""),db:Session=Depends(get_db),user:User=Depends(require_user)):
    if file.content_type not in {"image/jpeg","image/png","image/webp","video/mp4"}:
        raise HTTPException(415,"Supported evidence: JPEG, PNG, WebP or MP4.")
    is_video=file.content_type=="video/mp4"
    max_bytes=(20 if is_video else 10)*1024*1024
    content=await file.read(max_bytes+1)
    if len(content)>max_bytes:
        raise HTTPException(413,"Evidence exceeds the size limit (images 10 MB; MP4 20 MB).")
    if len(caption)>2000:
        raise HTTPException(422,"Caption is too long.")
    try:
        if is_video:
            public_bytes=await run_in_threadpool(sanitise_video,content)
        else:
            public_bytes=sanitise_image(content)
    except (UnidentifiedImageError,OSError,SyntaxError,ValueError,Image.DecompressionBombError,Image.DecompressionBombWarning):
        raise HTTPException(422,"The uploaded content is not a supported valid image.")
    eid=uid("evidence")
    original,public=storage.save(eid,content,public_bytes,".mp4" if is_video else ".jpg")
    evidence=Evidence(id=eid,user_id=user.id,name=Path(file.filename or "Evidence").name[:200],caption=caption,original_path=original,public_path=public,sha256=hashlib.sha256(content).hexdigest(),mime_type="video/mp4" if is_video else "image/jpeg",size=len(content),synthetic=synthetic,data={"derivative_notice":"Silent public video derivative; audio and camera metadata removed. Original remains private." if is_video else "Public image has metadata removed; original remains private."})
    db.add(evidence)
    db.commit()
    return evidence_json(evidence)

def sanitise_image(content):
        Image.MAX_IMAGE_PIXELS=20_000_000
        with Image.open(io.BytesIO(content)) as probe:
            probe.verify()
        with Image.open(io.BytesIO(content)) as decoded:
            if decoded.width*decoded.height>20_000_000:
                raise HTTPException(413,"Image exceeds 20 megapixels.")
            pixels=decoded.convert("RGB")
            pixels.thumbnail((2000,2000))
            clean=Image.new("RGB",pixels.size)
            clean.paste(pixels)
            derivative=io.BytesIO()
            clean.save(derivative,"JPEG",quality=88)
        return derivative.getvalue()

@router.get("/evidence/{evidence_id}/file")
def evidence_file(evidence_id:str,db:Session=Depends(get_db)):
    evidence=get_record(db,Evidence,evidence_id)
    if evidence.visibility!="public" or not evidence.report_id:
        raise HTTPException(403,"This evidence has not been approved for public display.")
    if evidence.public_path.startswith('supabase://'):
        return Response(storage.read(evidence.public_path),media_type=evidence.mime_type,headers={"X-Content-Type-Options":"nosniff","Cache-Control":"private,max-age=300"})
    if not Path(evidence.public_path).exists():
        raise HTTPException(404,"Stored media file unavailable.")
    return FileResponse(evidence.public_path,media_type=evidence.mime_type,headers={"X-Content-Type-Options":"nosniff","Cache-Control":"private,max-age=300"})

@router.get("/evidence/{evidence_id}/original")
def evidence_original(evidence_id:str,db:Session=Depends(get_db),user:User=Depends(require_user)):
    evidence=get_record(db,Evidence,evidence_id)
    membership=db.scalar(select(Membership).where(Membership.user_id==user.id,Membership.organisation_id==user.organisation_id,Membership.role.in_(["manager","admin"])))
    case=db.get(Case,evidence.case_id) if evidence.case_id else None
    if evidence.user_id!=user.id and not (membership and case and case.organisation_id==user.organisation_id):
        raise HTTPException(403,"Private original access denied.")
    if evidence.visibility=="deleted": raise HTTPException(410,"Evidence was removed through the governed deletion workflow.")
    if evidence.original_path.startswith('supabase://'):
        return Response(storage.read(evidence.original_path),media_type="application/octet-stream",headers={"Cache-Control":"no-store","Content-Disposition":"attachment"})
    return FileResponse(evidence.original_path,media_type="application/octet-stream",filename=evidence.name,headers={"Cache-Control":"no-store"})

class TransitionInput(BaseModel):
    state:str
    reason:str=Field(min_length=2,max_length=4000)
    outcome:str|None=Field(default=None,max_length=4000)
    outcome_category:str|None=None
    completed_at:datetime|None=None
    evidence_id:str|None=None
    supporting_record:str|None=None

@router.post("/cases/{case_id}/transition")
def transition(case_id:str,body:TransitionInput,db:Session=Depends(get_db),user:User=Depends(require_manager)):
    case=organisation_case(db,case_id,user)
    if body.state not in STATES.get(case.state,set()):
        raise HTTPException(422,"This workflow transition is not permitted from the current state.")
    if body.state=="closed":
        allowed_categories={"action_documented_completed","closed_without_confirmed_cause","duplicate_case","no_further_action_recorded"}
        if body.outcome_category not in allowed_categories or not body.outcome or len(body.outcome.strip())<8 or not body.completed_at or not (body.evidence_id or body.supporting_record):
            raise HTTPException(422,"Closure requires a supported outcome category, explanation, completion time, and evidence or an action record.")
        support=None
        if body.supporting_record:
            support=db.get(Action,body.supporting_record)
        if body.evidence_id:
            support=db.get(Evidence,body.evidence_id)
        if not support or support.case_id!=case.id:
            raise HTTPException(422,"The supporting record must exist and belong to this case.")
        case.data={**case.data,"outcome":body.outcome,"outcome_category":body.outcome_category,"completed_at":iso(body.completed_at),"supporting_record":body.supporting_record or body.evidence_id}
    old=case.state
    case.state=body.state
    event=emit_event(db,case.waterbody_id,case.id,"reopening" if body.state=="reopened" else "closure" if body.state=="closed" else "case_update",body.state.replace("_"," ").title()+" recorded",body.reason,user.id)
    event.data={"state":body.state,"previous_state":old,"outcome":body.outcome,"outcome_category":body.outcome_category,"completed_at":iso(body.completed_at) if body.completed_at else None,"supporting_record":body.supporting_record or body.evidence_id}
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="case_transition",target_id=case.id,data={"from":old,"to":body.state,"reason":body.reason}))
    db.commit()
    return case_json(db,case)

class ActionInput(BaseModel):
    title:str=Field(min_length=3,max_length=200)
    description:str=Field(min_length=8,max_length=6000)
    completed_at:datetime
    evidence_id:str|None=None

@router.post("/cases/{case_id}/actions",status_code=201)
def record_action(case_id:str,body:ActionInput,db:Session=Depends(get_db),user:User=Depends(require_manager)):
    case=organisation_case(db,case_id,user)
    if body.evidence_id:
        evidence=get_record(db,Evidence,body.evidence_id)
        if evidence.case_id!=case.id: raise HTTPException(422,"Evidence belongs to another case.")
    action=Action(id=uid("action"),case_id=case.id,waterbody_id=case.waterbody_id,organisation_id=user.organisation_id,title=body.title,description=body.description,completed_at=iso(body.completed_at),evidence_id=body.evidence_id,synthetic=case.synthetic)
    db.add(action)
    db.flush()
    emit_event(db,case.waterbody_id,case.id,"action",body.title,body.description,user.id)
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="action_recorded",target_id=action.id))
    db.commit()
    return action_json(action)

class NoteInput(BaseModel):
    text:str=Field(min_length=2,max_length=6000)
    private:bool=True

@router.post("/cases/{case_id}/notes",status_code=201)
def add_note(case_id:str,body:NoteInput,db:Session=Depends(get_db),user:User=Depends(require_manager)):
    case=organisation_case(db,case_id,user)
    note=Note(id=uid("note"),case_id=case.id,organisation_id=user.organisation_id,user_id=user.id,text=body.text,private=body.private)
    db.add(note)
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="private_note" if body.private else "public_note",target_id=note.id))
    if not body.private:
        emit_event(db,case.waterbody_id,case.id,"case_update","Public note recorded",body.text,user.id)
    db.commit()
    return {"id":note.id,"text":note.text,"private":note.private,"created_at":note.created_at}

class EvidenceRequestInput(BaseModel):
    description:str=Field(min_length=8,max_length=4000)

@router.post("/cases/{case_id}/requests",status_code=201)
def request_evidence(case_id:str,body:EvidenceRequestInput,db:Session=Depends(get_db),user:User=Depends(require_manager)):
    case=organisation_case(db,case_id,user)
    request=EvidenceRequest(id=uid("request"),case_id=case.id,organisation_id=user.organisation_id,description=body.description,synthetic=case.synthetic)
    db.add(request)
    emit_event(db,case.waterbody_id,case.id,"evidence_request","Additional evidence requested",body.description,user.id)
    db.commit()
    return {"id":request.id,"description":request.description,"state":request.state,"created_at":request.created_at,"synthetic":request.synthetic}

class ReviewInput(BaseModel):
    review_state:str
    reason:str=Field(min_length=3,max_length=4000)

@router.post("/reports/{report_id}/review")
def review_report(report_id:str,body:ReviewInput,db:Session=Depends(get_db),user:User=Depends(require_manager)):
    report=get_record(db,Report,report_id)
    case=organisation_case(db,report.case_id,user)
    allowed={"submitted","needs_information","accepted_for_investigation","duplicate","rejected"}
    if body.review_state not in allowed: raise HTTPException(422,"Unsupported report review state.")
    old=report.data.get("review_state","submitted")
    history=[*report.data.get("review_history",[]),{"from":old,"to":body.review_state,"reason":body.reason,"created_at":utcnow(),"organisation_id":user.organisation_id}]
    report.data={**report.data,"review_state":body.review_state,"review_history":history}
    event=emit_event(db,case.waterbody_id,case.id,"report_review","Report review recorded",body.reason,user.id)
    event.data={"report_id":report.id,"report_review_state":body.review_state}
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="report_review",target_id=report.id,data={"from":old,"to":body.review_state,"reason":body.reason}))
    db.commit()
    return {"id":report.id,"review_state":body.review_state,"review_history":history}

class MergeInput(BaseModel):
    target_case_id:str
    reason:str=Field(min_length=8,max_length=4000)

class ReviewReasonInput(BaseModel):
    reason:str=Field(min_length=8,max_length=4000)

@router.post("/cases/{case_id}/merge")
def merge_case(case_id:str,body:MergeInput,db:Session=Depends(get_db),user:User=Depends(require_manager)):
    source=organisation_case(db,case_id,user)
    target=organisation_case(db,body.target_case_id,user)
    if source.id==target.id or source.waterbody_id!=target.waterbody_id:
        raise HTTPException(422,"Select another case for the same water body.")
    if source.data.get("merged_into") or target.data.get("merged_into"):
        raise HTTPException(409,"Already merged cases require correction before another merge.")
    if any(c.data.get("merged_into")==source.id for c in db.scalars(select(Case))):
        raise HTTPException(409,"Correct dependent merges before merging this case.")
    entry={"kind":"approved_merge","target_case_id":target.id,"reason":body.reason,"organisation_id":user.organisation_id,"created_at":utcnow()}
    source.data={**source.data,"merged_into":target.id,"merge_history":[*source.data.get("merge_history",[]),entry]}
    event=emit_event(db,target.waterbody_id,target.id,"merge","Reviewed duplicate linked",f"Case {source.id} linked after organisation review: {body.reason}",user.id)
    event.data={"source_case_id":source.id,"target_case_id":target.id,"record_ids":[source.id,target.id]}
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="case_merge",target_id=source.id,data=entry))
    db.commit()
    return case_json(db,source)

@router.post("/cases/{case_id}/unmerge")
def unmerge_case(case_id:str,body:ReviewReasonInput,db:Session=Depends(get_db),user:User=Depends(require_manager)):
    source=organisation_case(db,case_id,user)
    target_id=source.data.get("merged_into")
    if not target_id: raise HTTPException(409,"This case has no merge to correct.")
    target=organisation_case(db,target_id,user)
    entry={"kind":"merge_correction","target_case_id":target.id,"reason":body.reason,"organisation_id":user.organisation_id,"created_at":utcnow()}
    source.data={**source.data,"merged_into":None,"merge_history":[*source.data.get("merge_history",[]),entry]}
    for c in (source,target):
        event=emit_event(db,c.waterbody_id,c.id,"merge_correction","Duplicate link corrected",body.reason,user.id)
        event.data={"source_case_id":source.id,"target_case_id":target.id,"record_ids":[source.id,target.id]}
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="merge_correction",target_id=source.id,data=entry))
    db.commit()
    return case_json(db,source)

@router.post("/cases/{case_id}/reopen-request",status_code=201)
def reopen_request(case_id:str,body:ReviewReasonInput,db:Session=Depends(get_db),user:User=Depends(require_user)):
    case=get_record(db,Case,case_id)
    if case.state!="closed": raise HTTPException(422,"Reopening requests apply to closed cases.")
    entry={"id":uid("reopen-request"),"reason":body.reason,"state":"awaiting_review","created_at":utcnow(),"synthetic":case.synthetic}
    case.data={**case.data,"reopening_requests":[*case.data.get("reopening_requests",[]),entry]}
    emit_event(db,case.waterbody_id,case.id,"reopening_request","Case reopening review requested",body.reason,user.id)
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="reopening_request",target_id=case.id,data=entry))
    db.commit()
    return entry

@router.post("/cases/{case_id}/review")
def review(case_id:str,body:ReviewInput,db:Session=Depends(get_db),user:User=Depends(require_manager)):
    case=organisation_case(db,case_id,user)
    if body.review_state not in {"unreviewed","reviewed","needs_evidence","rejected"}:
        raise HTTPException(422,"Unsupported review state.")
    previous=case.review_state
    case.review_state=body.review_state
    review_event=emit_event(db,case.waterbody_id,case.id,"review","Review status updated",body.reason,user.id)
    review_event.data={"review_state":case.review_state,"previous_review_state":previous}
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="case_review",target_id=case.id,data={"from":previous,"to":case.review_state,"reason":body.reason}))
    db.commit()
    return case_json(db,case)

@router.get("/workspace")
def workspace(db:Session=Depends(get_db),user:User=Depends(require_manager)):
    return {"cases":[case_json(db,c) for c in db.scalars(select(Case).where(Case.organisation_id==user.organisation_id).order_by(Case.created_at.desc()))],"notes":[{"id":n.id,"case_id":n.case_id,"text":n.text,"private":n.private,"created_at":n.created_at} for n in db.scalars(select(Note).where(Note.organisation_id==user.organisation_id))],"organisation":organisation_json(db.get(Organisation,user.organisation_id))}

@router.get("/following")
def following(db:Session=Depends(get_db),user:User=Depends(require_user)):
    subscriptions=list(db.scalars(select(Subscription).where(Subscription.user_id==user.id)))
    visible_waterbodies=[]
    for subscription in subscriptions:
        if subscription.waterbody_id:
            wb=db.get(WaterBody,subscription.waterbody_id)
            if wb:visible_waterbodies.append(waterbody_json(db,wb))
    return {"waterbodies":visible_waterbodies,"areas":[{"id":s.id,"name":s.name,"latitude":s.latitude,"longitude":s.longitude,"radius_m":s.radius_m,"created_at":s.created_at} for s in subscriptions if not s.waterbody_id]}

@router.post("/following/{waterbody_id}")
def follow(waterbody_id:str,db:Session=Depends(get_db),user:User=Depends(require_user)):
    get_record(db,WaterBody,waterbody_id)
    if not db.scalar(select(Subscription).where(Subscription.user_id==user.id,Subscription.waterbody_id==waterbody_id)):
        db.add(Subscription(id=uid("subscription"),user_id=user.id,waterbody_id=waterbody_id))
        try: db.commit()
        except IntegrityError: db.rollback()
    return {"following":True,"waterbody_id":waterbody_id}

@router.delete("/following/{waterbody_id}")
def unfollow(waterbody_id:str,db:Session=Depends(get_db),user:User=Depends(require_user)):
    row=db.scalar(select(Subscription).where(Subscription.user_id==user.id,Subscription.waterbody_id==waterbody_id))
    if row: db.delete(row)
    db.commit()
    return {"following":False}

class AreaInput(BaseModel):
    name:str=Field(min_length=2,max_length=160)
    latitude:float=Field(ge=-90,le=90)
    longitude:float=Field(ge=-180,le=180)
    radius_m:float=Field(ge=100,le=50000)

@router.post("/areas",status_code=201)
def save_area(body:AreaInput,db:Session=Depends(get_db),user:User=Depends(require_user)):
    area=Subscription(id=uid("area"),user_id=user.id,**body.model_dump())
    db.add(area)
    db.commit()
    return {"id":area.id,**body.model_dump()}

@router.delete("/areas/{area_id}")
def delete_area(area_id:str,db:Session=Depends(get_db),user:User=Depends(require_user)):
    area=get_record(db,Subscription,area_id)
    if area.user_id!=user.id or area.waterbody_id:
        raise HTTPException(403,"This saved area is not yours.")
    db.delete(area)
    db.commit()
    return {"ok":True}

@router.get("/notifications")
def notifications(db:Session=Depends(get_db),user:User=Depends(require_user)):
    rows=list(db.scalars(select(Notification).where(Notification.user_id==user.id,Notification.available_at<=utcnow()).order_by(Notification.created_at.desc()).limit(200)))
    scheduled=db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id==user.id,Notification.available_at>utcnow()))
    return {"items":[{k:getattr(n,k) for k in ("id","event_id","waterbody_id","case_id","title","description","read","created_at")} | {"href":f"/incidents/{n.case_id}" if n.case_id else f"/waterbodies/{n.waterbody_id}","synthetic":bool(db.get(WaterBody,n.waterbody_id).synthetic),"event_ids":n.data.get("event_ids",[n.event_id])} for n in rows],"unread":sum(not n.read for n in rows),"scheduled":scheduled,"delivery":"in_app_only"}

@router.post("/notifications/{notification_id}/read")
def read_notification(notification_id:str,db:Session=Depends(get_db),user:User=Depends(require_user)):
    row=get_record(db,Notification,notification_id)
    if row.user_id!=user.id: raise HTTPException(403,"Notification access denied.")
    row.read=True
    db.commit()
    return {"read":True}

DEFAULT_PREFERENCES={"reports":True,"case_updates":True,"actions":True,"evidence_requests":True,"biodiversity":True,"digest":"immediate","quiet_start":"","quiet_end":"","timezone":"Asia/Kolkata","email":False,"push":False}
@router.get("/preferences")
def preferences(user:User=Depends(require_user)):
    from .mail import configured
    from .push import configured as push_configured
    return {**DEFAULT_PREFERENCES,**user.preferences,"capabilities":{"email":"available" if configured() and user.data.get('email_verified_at') else "verify_email" if configured() else "unavailable","push":"available" if push_configured() else "unavailable"}}

class PreferencesInput(BaseModel):
    reports:bool=True
    case_updates:bool=True
    actions:bool=True
    evidence_requests:bool=True
    biodiversity:bool=True
    digest:str="immediate"
    quiet_start:str=""
    quiet_end:str=""
    timezone:str="Asia/Kolkata"
    email:bool=False
    push:bool=False

@router.put("/preferences")
def put_preferences(body:PreferencesInput,db:Session=Depends(get_db),user:User=Depends(require_user)):
    if body.digest not in {"immediate","daily","off"}: raise HTTPException(422,"Choose immediate, daily, or off.")
    from .mail import configured
    from .push import configured as push_configured
    if body.push and (not push_configured() or not user.data.get('push_subscriptions')): raise HTTPException(422,"Register this browser for push before enabling the preference.")
    if body.email and (not configured() or not user.data.get('email_verified_at')):raise HTTPException(422,'Configure transactional email and verify your account email before enabling email updates.')
    from zoneinfo import ZoneInfo,ZoneInfoNotFoundError
    try: ZoneInfo(body.timezone)
    except ZoneInfoNotFoundError: raise HTTPException(422,"Timezone is not recognised.")
    for value in (body.quiet_start,body.quiet_end):
        if value:
            try: datetime.strptime(value,"%H:%M")
            except ValueError: raise HTTPException(422,"Quiet hours use HH:MM.")
    user.preferences={**user.preferences,**body.model_dump()}
    db.commit()
    return preferences(user)

def organisation_json(org):
    if not org: return None
    return {"id":org.id,"name":org.name,"description":org.description,"contact":org.contact,"synthetic":org.synthetic,"verification":org.data.get("verification","No verification claim"),"responsibility_source":org.data.get("responsibility_source"),"created_at":org.created_at,**{key:org.data.get(key) for key in ("address","email","phone","kind","service_regions","places","checked_at","contact_sources","contact_note","directory_contact")}}

@router.get("/organisations")
def organisations(q:str=Query('',max_length=120),db:Session=Depends(get_db)):
    items=[organisation_json(o) for o in db.scalars(select(Organisation).order_by(Organisation.name))]
    if q:
        needle=q.strip().casefold()
        items=[o for o in items if needle in ' '.join(str(o.get(key) or '') for key in ('name','description','address','places')).casefold()]
    return {'items':items,'total':len(items)}

@router.get("/organisations/{organisation_id}")
def organisation_profile(organisation_id:str,db:Session=Depends(get_db)):
    org=get_record(db,Organisation,organisation_id)
    return {"organisation":organisation_json(org),"sources":[source_json(s) for s in db.scalars(select(Source).where(Source.organisation_id==org.id))],"actions":[action_json(a) for a in db.scalars(select(Action).where(Action.organisation_id==org.id))],"relationships":[{"id":r.id,"kind":r.kind,"description":r.description,"source_id":r.source_id,"waterbody_id":r.waterbody_id} for r in db.scalars(select(Relationship).where(Relationship.target_type=="organisation",Relationship.target_id==org.id))]}

@router.get("/actions")
def public_actions(page:int=Query(1,ge=1),page_size:int=Query(50,ge=1,le=100),db:Session=Depends(get_db)):
    rows=list(db.scalars(select(Action).order_by(Action.created_at.desc())))
    return {"items":[action_json(a) for a in rows[max(0,page-1)*min(page_size,100):page*min(page_size,100)]],"total":len(rows)}

@router.get("/sources")
def public_sources(page:int=Query(1,ge=1),page_size:int=Query(50,ge=1,le=100),db:Session=Depends(get_db)):
    rows=list(db.scalars(select(Source).order_by(Source.name)))
    return {"items":[source_json(s) for s in rows[max(0,page-1)*min(page_size,100):page*min(page_size,100)]],"total":len(rows)}

@router.get("/sources/{source_id}")
def source_detail(source_id:str,db:Session=Depends(get_db)):
    return source_json(get_record(db,Source,source_id))

@router.get("/events/stream")
async def stream(request:Request,after:int=0):
    header=request.headers.get("last-event-id","")
    try: cursor=max(after,int(header or 0))
    except ValueError: raise HTTPException(422,"Invalid event cursor.")
    async def generate():
        nonlocal cursor
        yield "retry: 4000\n\n"
        for _ in range(30):
            if await request.is_disconnected(): break
            with SessionLocal() as db:
                rows=list(db.scalars(select(Event).where(Event.sequence>cursor).order_by(Event.sequence).limit(100)))
                for e in rows:
                    cursor=e.sequence
                    yield f"id: {cursor}\nevent: update\ndata: {json.dumps(event_json(e))}\n\n"
            yield ": heartbeat\n\n"
            await asyncio.sleep(2)
    return StreamingResponse(generate(),media_type="text/event-stream",headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})

@router.get("/events")
def poll_events(after:int=0,db:Session=Depends(get_db)):
    rows=list(db.scalars(select(Event).where(Event.sequence>after).order_by(Event.sequence).limit(100)))
    return {"items":[event_json(e) for e in rows],"cursor":rows[-1].sequence if rows else after}

@router.get("/embed/{waterbody_id}",response_class=HTMLResponse)
def embed(waterbody_id:str,db:Session=Depends(get_db)):
    wb=get_record(db,WaterBody,waterbody_id)
    info=waterbody_json(db,wb)
    public_url=os.getenv("PUBLIC_URL","http://localhost:5173").rstrip("/")
    return HTMLResponse(f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{html.escape(wb.name)} · AquaRelay</title><style>body{{font:16px system-ui;margin:0;padding:24px;background:#F6F7F2;color:#183B30}}article{{max-width:420px;background:white;border:1px solid #d9dfd7;border-radius:14px;padding:24px}}h1{{font-size:24px}}a{{color:#183B30}}small{{display:block;margin-top:14px}}</style><article><b>AquaRelay</b><h1>{html.escape(wb.name)}</h1><p>{html.escape(wb.summary)}</p><p>{info["case_count"]} open cases · Condition not assessed</p><a target="_blank" rel="noopener" href="{html.escape(public_url)}/waterbodies/{html.escape(wb.id)}">Open public history →</a><small>{"DEMO — SYNTHETIC RECORDS · " if wb.synthetic else ""}Dated snapshot: {html.escape(utcnow())}</small></article></html>''',headers={"Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors *","X-Content-Type-Options":"nosniff"})

class AbuseInput(BaseModel):
    target_type:str
    target_id:str
    reason:str=Field(min_length=8,max_length=4000)

@router.post("/moderation",status_code=201)
def report_abuse(body:AbuseInput,db:Session=Depends(get_db),user:User=Depends(require_user)):
    cls={"case":Case,"report":Report,"evidence":Evidence}.get(body.target_type)
    if not cls: raise HTTPException(422,"Unsupported moderation target.")
    get_record(db,cls,body.target_id)
    row=Moderation(id=uid("moderation"),user_id=user.id,**body.model_dump())
    db.add(row)
    db.commit()
    return {"id":row.id,"state":row.state}

class RedactionInput(BaseModel):
    reason:str=Field(min_length=8,max_length=4000)

@router.post("/evidence/{evidence_id}/redact")
def redact_evidence(evidence_id:str,body:RedactionInput,db:Session=Depends(get_db),user:User=Depends(require_manager)):
    evidence=get_record(db,Evidence,evidence_id)
    organisation_case(db,evidence.case_id,user)
    evidence.visibility="redacted"
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="evidence_redacted",target_id=evidence.id,data={"reason":body.reason}))
    db.commit()
    return {"id":evidence.id,"visibility":evidence.visibility}

@router.delete("/evidence/{evidence_id}")
def delete_evidence(evidence_id:str,body:RedactionInput,db:Session=Depends(get_db),user:User=Depends(require_user)):
    evidence=get_record(db,Evidence,evidence_id)
    membership=db.scalar(select(Membership).where(Membership.user_id==user.id,Membership.organisation_id==user.organisation_id,Membership.role.in_(["manager","admin"])))
    case=db.get(Case,evidence.case_id) if evidence.case_id else None
    if evidence.user_id!=user.id and not (membership and case and case.organisation_id==user.organisation_id):
        raise HTTPException(403,"Evidence deletion permission denied.")
    job=db.scalar(select(Job).where(Job.dedup_key=="media-delete:"+evidence.id))
    if not job:
        job=Job(id=uid("job"),kind="media_delete",dedup_key="media-delete:"+evidence.id,data={"evidence_id":evidence.id})
        db.add(job)
    evidence.visibility="deleted"
    evidence.name="Removed evidence"; evidence.caption=""
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="evidence_deleted",target_id=evidence.id,data={"reason":body.reason}))
    db.commit()
    try:
        storage.delete(evidence.id)
        job.state="done";job.completed_at=utcnow();db.commit()
        return {"id":evidence.id,"visibility":"deleted","files":"removed"}
    except OSError:
        return {"id":evidence.id,"visibility":"deleted","files":"deletion_pending","notice":"Public access removed. Durable file removal will retry."}
