from test_foundation import client,login

def test_recovery_is_generic_single_use_and_revokes_sessions(client,monkeypatch):
    monkeypatch.setenv('RESEND_API_KEY','test');monkeypatch.setenv('EMAIL_FROM','AquaRelay <hello@example.org>');monkeypatch.setenv('PUBLIC_URL','https://aquarelay.example.org')
    headers=login(client)
    unknown=client.post('/api/v1/auth/recovery',json={'email':'unknown@example.org'},headers=headers)
    known=client.post('/api/v1/auth/recovery',json={'email':'citizen@demo.aquarelay.local'},headers=headers)
    assert known.status_code==202,known.text
    assert unknown.json()==known.json()
    from app.db import SessionLocal
    from app.models import Job
    from sqlalchemy import select
    from urllib.parse import urlsplit,parse_qs
    with SessionLocal() as db:
        job=db.scalar(select(Job).where(Job.kind=='email'))
        token=parse_qs(urlsplit(job.data['link']).query)['token'][0]
    result=client.post('/api/v1/auth/reset-password',json={'token':token,'password':'NewStrongPass123!'},headers=headers)
    assert result.status_code==200,result.text
    assert client.get('/api/v1/auth/session').json()['user'] is None
    new_headers={'X-CSRF-Token':client.get('/api/v1/auth/session').json()['csrf_token']}
    assert client.post('/api/v1/auth/reset-password',json={'token':token,'password':'OtherStrong123!'},headers=new_headers).status_code==422
    r=client.post('/api/v1/auth/login',json={'email':'citizen@demo.aquarelay.local','password':'NewStrongPass123!'},headers=new_headers)
    assert r.status_code==200

def test_recovery_reports_missing_mail_adapter(client):
    result=client.post('/api/v1/auth/recovery',json={'email':'citizen@demo.aquarelay.local'},headers=login(client))
    assert result.status_code==503,result.text
