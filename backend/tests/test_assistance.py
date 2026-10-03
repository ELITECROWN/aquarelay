import pytest
from test_foundation import client,login

def test_local_multilingual_draft_extracts_only_visible_observation(client):
    text='Paani mein bohot jhaag hai aur 20 machhliyan mari hui hain.'
    result=client.post('/api/v1/assistance/report-draft',json={'original_text':text,'language':'Hindi'},headers=login(client)).json()
    assert result['draft']['observation_type']=='fish_mortality'
    assert result['draft']['additional_observations']=='foam'
    assert result['draft']['count_estimate']=='20'
    assert result['original_text']==text
    assert 'cause' not in result['draft']

def test_preferences_update_keeps_profile(client):
    from app.db import SessionLocal
    from app.models import User
    with SessionLocal() as db:
        user=db.get(User,'user-citizen');user.preferences={'profile':{'username':'field_user'}};db.commit()
    r=client.put('/api/v1/preferences',json={'digest':'daily'},headers=login(client))
    assert r.status_code==200,r.text
    assert client.get('/api/v1/auth/session').json()['user']['username']=='field_user'


def test_rules_draft_preserves_original_text_and_requires_human_confirmation(client):
    headers=login(client)
    text="Yesterday I saw fish near the bank. I do not know the cause."
    response=client.post("/api/v1/assistance/report-draft",json={"original_text":text,"language":"English"},headers=headers)
    assert response.status_code==200,response.text
    result=response.json()
    assert result["original_text"]==text
    assert result["draft"]["description"]==text
    assert result["requires_confirmation"] is True
    assert result["observed_at"] is None
    assert result["assistance"]=="Rules-based assistance"
    assert "timezone" in result["issues"][0].lower()
    assert client.get("/api/v1/cases").json()["total"]==3


def test_untrusted_provider_output_is_schema_checked_and_failure_falls_back():
    from app.assistance import ReportDraftInput,RulesDraftProvider,bounded_draft
    class UnsupportedOutput:
        async def draft(self,body): return {"diagnosis":"pollution"}
    body=ReportDraftInput(original_text="Foam observed along the bank. Cause unknown.")
    import asyncio
    output=asyncio.run(bounded_draft(UnsupportedOutput(),body))
    assert output.original_text==body.original_text
    assert output.assistance=="Rules-based assistance"
    assert output.requires_confirmation is True

def test_gemini_adapter_bounds_fields_and_preserves_statement():
    import asyncio, httpx, json
    from app.assistance import GeminiDraftProvider, ReportDraftInput
    def handle(request):
        assert request.url.host=='generativelanguage.googleapis.com'
        assert request.headers['x-goog-api-key']=='test-key'
        return httpx.Response(200,json={'candidates':[{'content':{'parts':[{'text':json.dumps({'observation_type':'fish_mortality','count_estimate':'20','additional_observations':['foam']})}]}}]})
    provider=GeminiDraftProvider('test-key','test-model',transport=httpx.MockTransport(handle))
    output=asyncio.run(provider.draft(ReportDraftInput(original_text='About 20 dead fish and foam near the bank.',language='English')))
    assert output['draft']['count_estimate']=='20'
    assert output['original_text']=='About 20 dead fish and foam near the bank.'

def test_external_model_is_never_used_without_consent(client,monkeypatch):
    from app import assistance
    async def forbidden(*args):raise AssertionError('External call without consent')
    monkeypatch.setattr(assistance.GeminiDraftProvider,'draft',forbidden)
    monkeypatch.setenv('GEMINI_API_KEY','test-key');monkeypatch.setenv('GEMINI_MODEL','test-model')
    r=client.post('/api/v1/assistance/report-draft',json={'original_text':'There is foam at the bank.'},headers=login(client))
    assert r.json()['assistance']=='Rules-based assistance'
