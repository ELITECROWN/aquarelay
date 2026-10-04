"""Explicit administrator cleanup with expiring, account-bound previews."""
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete, update, func
from sqlalchemy.orm import Session
from .db import get_db
from .workspace import require_admin
from .models import (User, Membership, LoginSession, Case, Report, Evidence, Event,
    Action, Note, EvidenceRequest, Notification, Subscription, Moderation, Audit, Job, uid, utcnow)

router = APIRouter()

class Options(BaseModel):
    reports: bool = False
    uploads: bool = False
    accounts: bool = False

class Confirmation(BaseModel):
    preview_id: str
    confirmation: str

def snapshot(db, options):
    if not any(options.values()):
        raise HTTPException(422, 'Select at least one cleanup option.')
    if options['accounts'] and not (options['reports'] and options['uploads']):
        raise HTTPException(422, 'Account deletion requires report and upload cleanup too.')
    if options['reports'] and not options['uploads']:
        raise HTTPException(422, 'Report cleanup includes uploads; select both options.')
    users = list(db.scalars(select(User.id).where(User.role == 'citizen', ~User.id.in_(select(Membership.user_id))))) if options['accounts'] else []
    ids = {
        'accounts': sorted(users),
        'reports': sorted(db.scalars(select(Report.id))) if options['reports'] else [],
        'cases': sorted(db.scalars(select(Case.id))) if options['reports'] else [],
        'uploads': sorted(db.scalars(select(Evidence.id))) if options['uploads'] else [],
    }
    digest = sha256(json.dumps(ids, sort_keys=True).encode()).hexdigest()
    return ids, digest

@router.post('/admin/cleanup/preview')
def preview(body: Options, db: Session = Depends(get_db), user=Depends(require_admin)):
    options = body.model_dump()
    ids, digest = snapshot(db, options)
    counts = {key: len(value) for key, value in ids.items()}
    size = db.scalar(select(func.coalesce(func.sum(Evidence.size), 0))) if options['uploads'] else 0
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    row = Audit(id=uid('cleanup'), actor_id=user.id, kind='cleanup_preview', data={
        'options': options, 'digest': digest, 'expires_at': expires, 'counts': counts})
    db.add(row); db.commit()
    return {'preview_id': row.id, 'counts': counts, 'original_bytes': size,
            'expires_at': expires, 'confirmation': 'DELETE PROTOTYPE DATA'}

@router.post('/admin/cleanup/execute')
def execute(body: Confirmation, db: Session = Depends(get_db), user=Depends(require_admin)):
    row = db.scalar(select(Audit).where(Audit.id == body.preview_id).with_for_update())
    if not row or row.actor_id != user.id or row.kind != 'cleanup_preview' or row.data['expires_at'] < utcnow():
        raise HTTPException(409, 'Preview expired or already used. Generate a fresh preview.')
    if body.confirmation != 'DELETE PROTOTYPE DATA':
        raise HTTPException(422, 'Type DELETE PROTOTYPE DATA exactly.')
    options = row.data['options']
    ids, digest = snapshot(db, options)
    if digest != row.data['digest']:
        raise HTTPException(409, 'Records changed since preview. Generate a fresh preview.')
    jobs = list(db.scalars(select(Job).with_for_update()))
    if any(job.state == 'running' for job in jobs):
        raise HTTPException(409, 'A background task is running. Retry cleanup after it finishes.')
    if options['reports'] or options['accounts']:
        # Cancel queued notifications containing soon-to-be-deleted case/account data.
        db.execute(delete(Job).where(Job.kind.in_(['notify','handoff','email','report_tracking_email','notification_email','notification_push'])))
    if options['uploads']:
        db.execute(update(Action).where(Action.evidence_id.in_(ids['uploads'])).values(evidence_id=None))
        for evidence_id in ids['uploads']:
            key = 'media-delete:' + evidence_id
            if not db.scalar(select(Job.id).where(Job.dedup_key == key)):
                db.add(Job(id=uid('job'), kind='media_delete', dedup_key=key, data={'evidence_id': evidence_id}))
        db.execute(delete(Evidence).where(Evidence.id.in_(ids['uploads'])))
    if options['reports']:
        events = select(Event.id).where(Event.case_id.in_(ids['cases']))
        db.execute(delete(Notification).where(Notification.event_id.in_(events) | Notification.case_id.in_(ids['cases'])))
        for model in (Action, Note, EvidenceRequest, Report):
            db.execute(delete(model).where(model.case_id.in_(ids['cases'])))
        db.execute(delete(Event).where(Event.case_id.in_(ids['cases'])))
        db.execute(delete(Moderation).where(Moderation.target_type.in_(['case','report','evidence'])))
        db.execute(delete(Case).where(Case.id.in_(ids['cases'])))
    if options['accounts']:
        users = ids['accounts']
        for model in (LoginSession, Subscription, Notification, Moderation):
            db.execute(delete(model).where(model.user_id.in_(users)))
        db.execute(update(Event).where(Event.actor_id.in_(users)).values(actor_id=None))
        db.execute(update(Audit).where(Audit.actor_id.in_(users)).values(actor_id=None))
        db.execute(delete(User).where(User.id.in_(users)))
    row.kind = 'cleanup_completed'
    row.data = {**row.data, 'completed_at': utcnow()}
    db.commit()
    return {'counts': row.data['counts'], 'message': 'Database cleanup completed. Uploaded-file deletion is queued for retryable background processing.'}

@router.get('/admin/cleanup/storage-status')
def storage_status(db: Session = Depends(get_db), user=Depends(require_admin)):
    rows = db.execute(select(Job.state, func.count()).where(Job.kind == 'media_delete').group_by(Job.state)).all()
    return {'jobs': dict(rows)}

@router.post('/admin/cleanup/retry-storage')
def retry_storage(db: Session = Depends(get_db), user=Depends(require_admin)):
    result = db.execute(update(Job).where(Job.kind == 'media_delete', Job.state == 'failed').values(
        state='pending', attempts=0, error=None, locked_at=None, available_at=utcnow()))
    db.add(Audit(id=uid('audit'), actor_id=user.id, kind='cleanup_storage_retry', data={'count': result.rowcount}))
    db.commit()
    return {'count': result.rowcount}
