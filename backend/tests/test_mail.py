from types import SimpleNamespace
import httpx
from app import mail
import base64
import json
from email import message_from_bytes

def test_gmail_refresh_and_send(monkeypatch):
    monkeypatch.setenv('EMAIL_PROVIDER','gmail')
    for name in ('CLIENT_ID','CLIENT_SECRET','REFRESH_TOKEN'):
        monkeypatch.setenv('GMAIL_'+name,'test-value')
    monkeypatch.setenv('EMAIL_FROM','AquaRelay <sender@gmail.com>')
    monkeypatch.setenv('PUBLIC_URL','https://example.org')
    requests=[]
    def handle(request):
        requests.append(request)
        if len(requests)==1:
            return httpx.Response(200,json={'access_token':'access'})
        return httpx.Response(200,json={'id':'sent'})
    real_client=httpx.Client
    monkeypatch.setattr(mail.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(handle),**kwargs))
    assert mail.configured()
    mail.deliver(SimpleNamespace(id='job-gmail',data={'to':'person@example.org','subject':'Verify','message':'Your code: 123456','link':'https://example.org'}))
    assert str(requests[0].url)=='https://oauth2.googleapis.com/token'
    assert requests[1].headers['authorization']=='Bearer access'
    raw=json.loads(requests[1].content)['raw']
    message=message_from_bytes(base64.urlsafe_b64decode(raw))
    assert message['To']=='person@example.org'
    assert message.is_multipart()

def test_explicit_gmail_missing_credentials_does_not_fallback(monkeypatch):
    monkeypatch.setenv('EMAIL_PROVIDER','gmail')
    monkeypatch.setenv('MAILJET_API_KEY','key')
    monkeypatch.setenv('MAILJET_SECRET_KEY','secret')
    monkeypatch.setenv('EMAIL_FROM','sender@gmail.com')
    monkeypatch.setenv('PUBLIC_URL','https://example.org')
    monkeypatch.delenv('GMAIL_REFRESH_TOKEN',raising=False)
    assert not mail.configured()

def test_mailjet_https_sender_and_safe_html(monkeypatch):
    monkeypatch.delenv('RESEND_API_KEY',raising=False)
    monkeypatch.setenv('MAILJET_API_KEY','test-key');monkeypatch.setenv('MAILJET_SECRET_KEY','test-secret')
    monkeypatch.setenv('EMAIL_FROM','AquaRelay <sender@example.org>');monkeypatch.setenv('PUBLIC_URL','https://example.org')
    requests=[]
    def handle(request):
        requests.append(request)
        return httpx.Response(200,json={'Messages':[{'Status':'success'}]})
    real_client=httpx.Client
    monkeypatch.setattr(mail.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(handle),**kwargs))
    mail.deliver(SimpleNamespace(id='job-1',data={'to':'person@example.org','subject':'Verify','message':'<script>','link':'https://example.org/verify'}))
    assert mail.configured()
    assert requests[0].url==httpx.URL('https://api.mailjet.com/v3.1/send')
    assert b'&lt;script&gt;' in requests[0].content
    assert b'sender@example.org' in requests[0].content
