import re
from sqlalchemy import select
from test_foundation import client,login,report_payload

def setup_sender(monkeypatch):
    monkeypatch.setenv('MAILJET_API_KEY','test-client');monkeypatch.setenv('MAILJET_SECRET_KEY','test-secret');monkeypatch.setenv('EMAIL_FROM','AquaRelay <owner@example.org>');monkeypatch.setenv('PUBLIC_URL','https://aquarelay.example.org')

def register_code(client):
    csrf=client.get('/api/v1/auth/session').json()['csrf_token'];headers={'X-CSRF-Token':csrf}
    result=client.post('/api/v1/auth/register',json={'email':'real@example.org','password':'GoodPass123!','name':'Real Citizen','username':'real_citizen'},headers=headers)
    assert result.status_code==201,result.text
    assert result.json()['otp_required'] is True
    assert client.get('/api/v1/auth/session').json()['user'] is None
    from app.db import SessionLocal
    from app.models import Job
    with SessionLocal() as db:
        job=db.scalar(select(Job).where(Job.data['sensitive'].as_boolean()==True))
        code=re.search(r'\b\d{6}\b',job.data['message']).group()
    return code,headers

def test_otp_before_session_single_use_and_signin_alert(client,monkeypatch):
    setup_sender(monkeypatch);code,headers=register_code(client)
    wrong='000000' if code!='000000' else '111111'
    assert client.post('/api/v1/auth/verify-login-code',json={'email':'real@example.org','code':wrong},headers=headers).status_code==422
    good=client.post('/api/v1/auth/verify-login-code',json={'email':'real@example.org','code':code},headers=headers)
    assert good.status_code==200,good.text
    assert good.json()['user']['email_verified'] is True
    headers={'X-CSRF-Token':good.json()['csrf_token']}
    assert client.post('/api/v1/auth/verify-login-code',json={'email':'real@example.org','code':code},headers=headers).status_code==422
    from app.db import SessionLocal
    from app.models import Job
    with SessionLocal() as db:assert db.scalar(select(Job).where(Job.kind=='email',Job.data['subject'].as_string()=='New sign-in to AquaRelay'))

def test_otp_locks_after_five_guesses(client,monkeypatch):
    setup_sender(monkeypatch);code,headers=register_code(client)
    wrong='000000' if code!='000000' else '111111'
    for _ in range(5):assert client.post('/api/v1/auth/verify-login-code',json={'email':'real@example.org','code':wrong},headers=headers).status_code==422
    assert client.post('/api/v1/auth/verify-login-code',json={'email':'real@example.org','code':code},headers=headers).status_code==422
    assert client.get('/api/v1/auth/session').json()['user'] is None

def test_owner_receives_admin_access_only_after_otp(client,monkeypatch):
    setup_sender(monkeypatch)
    monkeypatch.setenv('DEMO_MODE','false')
    csrf=client.get('/api/v1/auth/session').json()['csrf_token']
    headers={'X-CSRF-Token':csrf}
    email='dibyendukoley50@gmail.com'
    created=client.post('/api/v1/auth/register',json={'email':email,'password':'GoodPass123!','name':'Owner','username':'verified_owner'},headers=headers)
    assert created.status_code==201,created.text
    assert client.get('/api/v1/admin/cleanup/storage-status').status_code==401
    from app.db import SessionLocal
    from app.models import Job,User
    with SessionLocal() as db:
        assert db.scalar(select(User).where(User.email==email)).role=='citizen'
        job=db.scalar(select(Job).where(Job.data['sensitive'].as_boolean()==True))
        code=re.search(r'\b\d{6}\b',job.data['message']).group()
    verified=client.post('/api/v1/auth/verify-login-code',json={'email':email,'code':code},headers=headers)
    assert verified.status_code==200,verified.text
    assert verified.json()['user']['role']=='admin'
    assert client.get('/api/v1/admin/cleanup/storage-status').status_code==200

def test_owner_passwordless_code_and_other_email_denial(client,monkeypatch):
    setup_sender(monkeypatch);monkeypatch.setenv('DEMO_MODE','false')
    headers={'X-CSRF-Token':client.get('/api/v1/auth/session').json()['csrf_token']}
    endpoint='/api/v1/auth/admin-email-code'
    assert client.post(endpoint,json={'email':'other@example.org'},headers=headers).status_code==403
    email='dibyendukoley50@gmail.com'
    result=client.post(endpoint,json={'email':email},headers=headers)
    assert result.status_code==200,result.text
    assert result.json()['otp_required'] is True
    assert client.get('/api/v1/auth/session').json()['user'] is None
    assert client.post(endpoint,json={'email':email},headers=headers).status_code==429
    from app.db import SessionLocal
    from app.models import Job,User
    with SessionLocal() as db:
        assert db.scalar(select(User).where(User.email==email)).role=='citizen'
        job=db.scalar(select(Job).where(Job.data['sensitive'].as_boolean()==True))
        code=re.search(r'\b\d{6}\b',job.data['message']).group()
    verified=client.post('/api/v1/auth/verify-login-code',json={'email':email,'code':code},headers=headers)
    assert verified.status_code==200,verified.text
    assert verified.json()['user']['role']=='admin'
    assert client.get('/api/v1/admin/cleanup/storage-status').status_code==200

def test_owner_passwordless_fails_closed_without_sender(client,monkeypatch):
    monkeypatch.delenv('MAILJET_API_KEY',raising=False)
    monkeypatch.delenv('GMAIL_REFRESH_TOKEN',raising=False)
    headers={'X-CSRF-Token':client.get('/api/v1/auth/session').json()['csrf_token']}
    result=client.post('/api/v1/auth/admin-email-code',json={'email':'dibyendukoley50@gmail.com'},headers=headers)
    assert result.status_code==503
    assert client.get('/api/v1/auth/session').json()['user'] is None

def test_required_otp_does_not_fall_back_when_sender_is_unavailable(client,monkeypatch):
    monkeypatch.setenv('EMAIL_OTP_REQUIRED','true')
    headers={'X-CSRF-Token':client.get('/api/v1/auth/session').json()['csrf_token']}
    result=client.post('/api/v1/auth/register',json={'email':'unavailable@example.org','password':'GoodPass123!','name':'Real Citizen','username':'unavailable_user'},headers=headers)
    assert result.status_code==503
    assert client.get('/api/v1/auth/session').json()['user'] is None

def test_reporter_receipt_and_checkpoint_without_follow(client,monkeypatch):
    setup_sender(monkeypatch);code,headers=register_code(client)
    verified=client.post('/api/v1/auth/verify-login-code',json={'email':'real@example.org','code':code},headers=headers).json();headers={'X-CSRF-Token':verified['csrf_token']}
    saved=client.post('/api/v1/reports',json=report_payload(client_id='email-receipt-001',related_case_id='case-current'),headers=headers)
    assert saved.status_code==201,saved.text
    from app.db import SessionLocal
    from app.models import Job,Event
    from app.worker import deliver_notifications
    def consume():
        with SessionLocal() as db:
            for job in db.scalars(select(Job).where(Job.kind=='notify')):deliver_notifications(db,job)
            db.commit()
    consume()
    client.post('/api/v1/auth/logout',headers=headers);manager=login(client,'manager@demo.aquarelay.local')
    assert client.post('/api/v1/cases/case-current/transition',json={'state':'acknowledged','reason':'Inspection team accepted the case.'},headers=manager).status_code==200
    consume();consume()
    with SessionLocal() as db:
        jobs=list(db.scalars(select(Job).where(Job.kind=='report_tracking_email')))
        assert len(jobs)==2
        assert all('/incidents/case-current' in j.data['link'] for j in jobs)
        assert any('Acknowledged' in j.data['message'] for j in jobs)
