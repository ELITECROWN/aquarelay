"""SQL-backed outbox consumer. Restart/replay safely resumes unfinished jobs."""
import argparse
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import or_, select,update
from .db import SessionLocal
from .models import Event, Job, Notification, Subscription, User, WaterBody, uid, utcnow

def notification_time(preferences, now):
    local=now.astimezone(ZoneInfo(preferences.get("timezone","Asia/Kolkata")))
    if preferences.get("digest")=="daily":
        local=(local+timedelta(days=1)).replace(hour=8,minute=0,second=0,microsecond=0)
    start,end=preferences.get("quiet_start"),preferences.get("quiet_end")
    if start and end:
        clock=local.strftime("%H:%M")
        quiet=start<=clock<end if start<end else clock>=start or clock<end
        if quiet:
            hour,minute=map(int,end.split(":"))
            wake=local.replace(hour=hour,minute=minute,second=0,microsecond=0)
            if wake<=local: wake+=timedelta(days=1)
            local=wake
    return local.astimezone(timezone.utc).isoformat()

def deliver_notifications(db,job):
    from .core import distance
    event=db.get(Event,job.data["event_id"])
    if not event: return
    wb=db.get(WaterBody,event.waterbody_id)
    users={}
    for sub in db.scalars(select(Subscription)):
        if sub.created_at>event.created_at: continue
        matches=sub.waterbody_id==wb.id or (not sub.waterbody_id and distance(sub.latitude,sub.longitude,wb.latitude,wb.longitude)<=sub.radius_m)
        if matches: users[sub.user_id]=db.get(User,sub.user_id)
    key={"report":"reports","action":"actions","evidence_request":"evidence_requests","biodiversity":"biodiversity"}.get(event.kind,"case_updates")
    now=datetime.now(timezone.utc)
    for user in users.values():
        prefs=user.preferences or {}
        if prefs.get("digest")=="off" or prefs.get(key) is False: continue
        existing=list(db.scalars(select(Notification).where(Notification.user_id==user.id,Notification.waterbody_id==wb.id)))
        if any(n.event_id==event.id or event.id in n.data.get("event_ids",[]) for n in existing): continue
        available_at=notification_time(prefs,now)
        group=None
        if prefs.get("digest")=="daily":
            group=next((n for n in existing if n.data.get("digest_day")==available_at[:10] and not n.read),None)
        if group:
            event_ids=[*group.data.get("event_ids",[group.event_id]),event.id]
            group.data={**group.data,"event_ids":event_ids}
            group.description=f"{len(event_ids)} recorded updates. Open the dated history to inspect the records."
        else:
            db.add(Notification(id=uid("notification"),user_id=user.id,event_id=event.id,waterbody_id=wb.id,case_id=event.case_id,title=f"Daily updates · {wb.name}" if prefs.get("digest")=="daily" else event.title,description=event.description,available_at=available_at,data={"event_ids":[event.id],"digest_day":available_at[:10] if prefs.get("digest")=="daily" else None}))

def process_jobs(db,limit=50):
    from .integrations import schedule_due_connectors
    schedule_due_connectors(db)
    now=utcnow()
    expired=(datetime.now(timezone.utc)-timedelta(minutes=5)).isoformat()
    processed=0
    for _ in range(limit):
        claimable=or_(Job.state=="pending",(Job.state=="running") & (Job.locked_at<expired))
        stmt=select(Job).where(claimable,Job.available_at<=now).order_by(Job.created_at).limit(1)
        if db.bind.dialect.name=="postgresql": stmt=stmt.with_for_update(skip_locked=True)
        job=db.scalar(stmt)
        if not job: break
        claimed=db.execute(update(Job).where(Job.id==job.id,claimable).values(state="running",locked_at=utcnow(),attempts=Job.attempts+1))
        if not claimed.rowcount:
            db.rollback(); continue
        db.commit()
        db.refresh(job)
        try:
            if job.kind=="notify": deliver_notifications(db,job)
            elif job.kind=="handoff":
                from .integrations import process_handoff_job
                process_handoff_job(db,job)
            elif job.kind=="connector_sync":
                from .integrations import process_connector_job
                process_connector_job(db,job)
            elif job.kind=="media_delete":
                from .storage import storage
                storage.delete(job.data["evidence_id"])
            else: raise ValueError("Unsupported durable job kind")
            job.state="done"; job.completed_at=utcnow(); job.error=None
            db.commit(); processed+=1
        except Exception as exc:
            db.rollback()
            job=db.get(Job,job.id)
            job.state="failed" if job.attempts>=5 else "pending"
            job.available_at=(datetime.now(timezone.utc)+timedelta(seconds=min(3600,2**job.attempts*5))).isoformat()
            job.error=type(exc).__name__+": delivery attempt failed; inspect integration history."
            db.commit()
    return processed

def run_worker(stop=None):
    while stop is None or not stop.is_set():
        with SessionLocal() as db: process_jobs(db)
        if stop: stop.wait(1)
        else: time.sleep(1)

if __name__=="__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("--once",action="store_true"); args=parser.parse_args()
    if args.once:
        with SessionLocal() as db: print(f"Processed {process_jobs(db)} durable jobs.")
    else: run_worker()
