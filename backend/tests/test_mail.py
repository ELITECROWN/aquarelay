from types import SimpleNamespace
import httpx
from app import mail

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
