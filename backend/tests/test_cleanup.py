import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select, event
from sqlalchemy.orm import Session
from app.db import Base
from app.models import User, WaterBody, Organisation, Case, Report, Evidence, Job
from app.cleanup import preview, execute, retry_storage, Options, Confirmation
from app.workspace import require_admin

@pytest.fixture
def db():
    engine = create_engine('sqlite://')
    @event.listens_for(engine, 'connect')
    def enable_fk(conn, _): conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add_all([User(id='admin', email='admin@test.local', name='Admin', password_hash='x', role='admin'), User(id='citizen', email='citizen@test.local', name='Citizen', password_hash='x', role='citizen'), Organisation(id='org', name='Authority'), WaterBody(id='lake', name='Lake', type='lake', locality='Bengaluru', latitude=12, longitude=77)])
        session.commit()
        session.add(Case(id='case', waterbody_id='lake', title='Observation', description='Test', observed_at='2026-10-04'))
        session.commit()
        session.add(Report(id='report', user_id='citizen', client_id='r', case_id='case', waterbody_id='lake', observation_type='foam', description='Test', observed_at='2026-10-04'))
        session.commit()
        session.add(Evidence(id='evidence', user_id='citizen', case_id='case', report_id='report', name='Photo', original_path='x', public_path='y', sha256='x', mime_type='image/jpeg', size=100))
        session.commit()
        yield session
    engine.dispose()

def test_citizens_cannot_access_cleanup():
    with pytest.raises(HTTPException) as error:
        require_admin(User(role='citizen'))
    assert error.value.status_code == 403

def test_preview_no_deletion_and_full_cleanup_preserves_registry(db):
    admin = db.get(User, 'admin')
    result = preview(Options(reports=True, uploads=True, accounts=True), db, admin)
    assert result['counts'] == {'accounts': 1, 'reports': 1, 'cases': 1, 'uploads': 1}
    assert db.get(Report, 'report')
    execute(Confirmation(preview_id=result['preview_id'], confirmation='DELETE PROTOTYPE DATA'), db, admin)
    db.expire_all()
    assert db.get(User, 'admin') and db.get(WaterBody, 'lake') and db.get(Organisation, 'org')
    assert db.get(User, 'citizen') is None and db.get(Case, 'case') is None
    assert db.scalar(select(Job).where(Job.kind == 'media_delete')).data['evidence_id'] == 'evidence'
    with pytest.raises(HTTPException):
        execute(Confirmation(preview_id=result['preview_id'], confirmation='DELETE PROTOTYPE DATA'), db, admin)

def test_confirmation_and_changed_records_are_rejected(db):
    admin = db.get(User, 'admin')
    result = preview(Options(uploads=True), db, admin)
    with pytest.raises(HTTPException):
        execute(Confirmation(preview_id=result['preview_id'], confirmation='yes'), db, admin)
    db.delete(db.get(Evidence, 'evidence')); db.commit()
    with pytest.raises(HTTPException) as error:
        execute(Confirmation(preview_id=result['preview_id'], confirmation='DELETE PROTOTYPE DATA'), db, admin)
    assert error.value.status_code == 409

def test_account_cleanup_requires_dependencies(db):
    with pytest.raises(HTTPException): preview(Options(accounts=True), db, db.get(User, 'admin'))

def test_failed_storage_deletion_can_be_retried(db):
    db.add(Job(id='failed-job', kind='media_delete', dedup_key='failed-delete', state='failed', attempts=5, data={'evidence_id':'evidence'}))
    db.commit()
    assert retry_storage(db, db.get(User, 'admin'))['count'] == 1
    db.expire_all()
    job = db.get(Job, 'failed-job')
    assert job.state == 'pending' and job.attempts == 0
