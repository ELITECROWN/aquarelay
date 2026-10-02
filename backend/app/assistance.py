"""Non-authoritative operational drafts; no external model or network adapter configured."""
import asyncio
import logging
from datetime import datetime
from typing import Protocol
from fastapi import APIRouter,Depends
from pydantic import BaseModel,ConfigDict,Field,ValidationError
from .auth import require_user

router=APIRouter()
logger=logging.getLogger("aquarelay.assistance")

class ReportDraftInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    original_text:str=Field(min_length=8,max_length=12000)
    language:str=Field(default="en",max_length=80)
    observed_at:datetime|None=None

class ReportDraft(BaseModel):
    model_config=ConfigDict(extra="forbid")
    original_text:str
    draft:dict[str,str]
    observed_at:str|None=None
    issues:list[str]=Field(default_factory=list)
    assistance:str="Rules-based assistance"
    requires_confirmation:bool=True
    record_ids:list[str]=Field(default_factory=list)

class DraftProvider(Protocol):
    """Future adapters must use their own bounded HTTP timeout and explicit data consent."""
    async def draft(self,body:ReportDraftInput)->dict: ...

class RulesDraftProvider:
    async def draft(self,body):
        issues=[]
        observed_at=None
        if body.observed_at and body.observed_at.tzinfo:
            observed_at=body.observed_at.isoformat()
        else:
            issues.append("Confirm an observation date, time and explicit timezone; relative dates are not guessed.")
        return {"original_text":body.original_text,"draft":{"description":body.original_text,"language":body.language},"observed_at":observed_at,"issues":issues,"assistance":"Rules-based assistance","requires_confirmation":True,"record_ids":[]}

async def bounded_draft(provider,body,timeout=2.0,retries=1):
    for attempt in range(min(retries,1)+1):
        try:
            raw=await asyncio.wait_for(provider.draft(body),timeout=min(timeout,5))
            result=ReportDraft.model_validate(raw)
            if result.original_text!=body.original_text or not result.requires_confirmation:
                raise ValueError("Draft output changed original text or bypassed confirmation")
            return result
        except (TimeoutError,ValidationError,ValueError) as exc:
            logger.info("Draft adapter rejected",extra={"error_class":type(exc).__name__,"attempt":attempt+1})
    return ReportDraft.model_validate(await RulesDraftProvider().draft(body))

@router.post("/assistance/report-draft")
async def report_draft(body:ReportDraftInput,user=Depends(require_user)):
    return await bounded_draft(RulesDraftProvider(),body)
