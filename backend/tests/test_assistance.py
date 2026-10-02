import pytest
from test_foundation import client,login


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
