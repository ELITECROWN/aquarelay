import base64
from test_foundation import client,login

def test_push_subscription_validates_destination_and_is_account_scoped(client,monkeypatch):
    monkeypatch.setenv('VAPID_PRIVATE_KEY','test');monkeypatch.setenv('VAPID_PUBLIC_KEY','test');monkeypatch.setenv('VAPID_SUBJECT','mailto:hello@example.org')
    keys={'p256dh':base64.urlsafe_b64encode(b'\x04'+b'x'*64).decode().rstrip('='),'auth':base64.urlsafe_b64encode(b'x'*16).decode().rstrip('=')}
    headers=login(client)
    assert client.post('/api/v1/push/subscriptions',json={'endpoint':'https://127.0.0.1/admin','keys':keys},headers=headers).status_code==422
    assert client.post('/api/v1/push/subscriptions',json={'endpoint':'https://fcm.googleapis.com/fcm/send/test','keys':keys},headers=headers).status_code==201
    assert client.get('/api/v1/push/config').json()['configured'] is True
    from app.db import SessionLocal
    from app.models import User
    with SessionLocal() as db:assert len(db.get(User,'user-citizen').data['push_subscriptions'])==1
    client.delete('/api/v1/push/subscriptions',headers=headers)
    with SessionLocal() as db:assert db.get(User,'user-citizen').data['push_subscriptions']==[]
