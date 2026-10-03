"""Source-linked registry administration and professional contributions."""
from datetime import datetime
import re
from urllib.parse import urlsplit
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select,or_
from sqlalchemy.orm import Session
from .auth import require_user, require_manager
from .db import get_db
from .models import User, Membership, WaterBody, Source, Organisation, Biodiversity, Relationship, Evidence, Case, Report, EvidenceRequest, Audit, uid, utcnow
from .core import get_record, iso, emit_event, passport, organisation_case, evidence_json
from .core import cases,case_json

router = APIRouter()

@router.get('/waterbodies/{waterbody_id}/incidents')
def waterbody_incidents(waterbody_id:str,page:int=Query(1,ge=1),page_size:int=Query(50,ge=1,le=100),db:Session=Depends(get_db)):
    get_record(db,WaterBody,waterbody_id)
    return cases(waterbody_id=waterbody_id,state='',page=page,page_size=page_size,db=db)

@router.get('/cases/{case_id}/evidence-checklist')
def evidence_checklist(case_id:str,db:Session=Depends(get_db),user=Depends(require_manager)):
    case=organisation_case(db,case_id,user)
    reports=list(db.scalars(select(Report).where(Report.case_id==case.id)))
    evidence=list(db.scalars(select(Evidence).where(Evidence.case_id==case.id,Evidence.visibility=='public')))
    suggestions=[]
    if not evidence:suggestions.append({'description':'Request a photograph of the visible observation, with capture time and approximate position. Volunteers should collect evidence only from a safe, publicly accessible location.','record_ids':[case.id]})
    unknown=[r for r in reports if r.observation_type=='fish_mortality' and not r.count_estimate]
    if unknown:suggestions.append({'description':'Ask for an approximate count or range of the reported fish mortality, if observable. Preserve uncertainty.','record_ids':[r.id for r in unknown]})
    if case.state in {'investigating','action_in_progress'} and not case.data.get('comparison'):suggestions.append({'description':'Consider documenting dated before/follow-up photographs from comparable viewpoints when recording completed work.','record_ids':[case.id]})
    return {'suggestions':suggestions,'open_requests':[{'id':r.id,'description':r.description} for r in db.scalars(select(EvidenceRequest).where(EvidenceRequest.case_id==case.id,EvidenceRequest.state=='open'))],'requires_review':True,'assistance':'Workflow checklist based on stored records; no sampling advice or causal diagnosis.'}

def require_admin(user=Depends(require_user)):
    if user.role != "admin":
        raise HTTPException(403, "Platform administrator permission is required.")
    return user

class RegistryInput(BaseModel):
    name: str = Field(min_length=3, max_length=160)
    type: Literal["lake", "pond", "canal", "stream", "wetland"]
    locality: str = Field(min_length=2, max_length=160)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    aliases: list[str] = Field(default_factory=list, max_length=30)
    summary: str = Field(default="", max_length=4000)
    source_name: str = Field(min_length=3, max_length=200)
    source_url: HttpUrl | None = None
    license: str = Field(min_length=1, max_length=120)
    responsible_organisation_id: str | None = None

@router.post("/admin/waterbodies", status_code=201)
def create_waterbody(body: RegistryInput, db: Session=Depends(get_db), user=Depends(require_admin)):
    if body.responsible_organisation_id:
        get_record(db, Organisation, body.responsible_organisation_id)
    if db.scalar(select(WaterBody.id).where(WaterBody.name == body.name.strip(), WaterBody.locality == body.locality.strip())):
        raise HTTPException(409, "This name and locality already have a registered identity. Review the existing record.")
    wb=WaterBody(id=uid("wb"), name=body.name.strip(), type=body.type, locality=body.locality.strip(), latitude=body.latitude, longitude=body.longitude, aliases=body.aliases, summary=body.summary, synthetic=False, geometry={"type":"Point", "coordinates":[body.longitude, body.latitude]}, data={"responsible_organisation_id":body.responsible_organisation_id})
    db.add(wb); db.flush()
    source=Source(id=uid("source"), waterbody_id=wb.id, name=body.source_name, kind="registry", url=str(body.source_url or ""), license=body.license, attribution=body.source_name, synthetic=False)
    db.add(source); db.flush()
    emit_event(db,wb.id,None,"registry","Water-body identity registered", "Source-linked registry entry created; environmental condition not assessed.",user.id,source.id)
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="registry_created",target_id=wb.id)); db.commit()
    return {"id":wb.id, "source_id":source.id}

class OrganisationInput(BaseModel):
    name: str=Field(min_length=3,max_length=160)
    description: str=Field(min_length=8,max_length=4000)
    contact: str=Field(default="",max_length=200)
    social_accounts: list[HttpUrl]=Field(default_factory=list,max_length=10)

@router.post("/admin/organisations",status_code=201)
def create_organisation(body:OrganisationInput,db:Session=Depends(get_db),user=Depends(require_admin)):
    org=Organisation(id=uid("org"),name=body.name,description=body.description,contact=body.contact,synthetic=False,data={"verification":"Administrator-entered directory; institutional authority requires independent verification", "social_accounts":[str(x) for x in body.social_accounts]})
    db.add(org);db.add(Audit(id=uid("audit"),actor_id=user.id,kind="organisation_created",target_id=org.id));db.commit()
    return {"id":org.id,"name":org.name}

class SocialApprovalInput(BaseModel):
    organisation_id:str
    platform:Literal['x','instagram']
    handle:str=Field(min_length=1,max_length=30,pattern=r'^[A-Za-z0-9_.]+$')
    account_url:HttpUrl
    verification_source:HttpUrl
    review_confirmed:bool=False

@router.post('/admin/social-accounts',status_code=201)
def approve_social_account(body:SocialApprovalInput,db:Session=Depends(get_db),user=Depends(require_admin)):
    org=get_record(db,Organisation,body.organisation_id)
    account=urlsplit(str(body.account_url));source=urlsplit(str(body.verification_source))
    hosts={'x':{'x.com','twitter.com'},'instagram':{'instagram.com','www.instagram.com'}}
    handle_pattern=r'[A-Za-z0-9_]{1,15}' if body.platform=='x' else r'[A-Za-z0-9_.]{1,30}'
    if not body.review_confirmed or not re.fullmatch(handle_pattern,body.handle):raise HTTPException(422,'Review the account and confirm the cited source before approval.')
    if account.scheme!='https' or account.hostname not in hosts[body.platform] or account.username or account.password or account.query or account.fragment or account.port not in {None,443} or account.path.rstrip('/').casefold()!='/'+body.handle.casefold():raise HTTPException(422,'Account URL must be the matching HTTPS platform profile without credentials or extra parameters.')
    if source.scheme!='https' or source.username or source.password or source.hostname in {'localhost','127.0.0.1','::1'} or str(body.verification_source)==str(body.account_url):raise HTTPException(422,'Cite an independent public HTTPS verification source without credentials.')
    accounts=list(org.data.get('verified_social_accounts',[]))
    if any(a['account_url'].casefold()==str(body.account_url).casefold() and not a.get('revoked_at') for a in accounts):raise HTTPException(409,'This account already has an active approval.')
    record={'id':uid('social'),'platform':body.platform,'handle':body.handle,'account_url':str(body.account_url),'verification_source':str(body.verification_source),'verified_at':utcnow(),'reviewer_id':user.id}
    org.data={**org.data,'verified_social_accounts':[*accounts,record]}
    db.add(Audit(id=uid('audit'),actor_id=user.id,kind='social_account_approved',target_id=org.id,data={'account_id':record['id'],'verification_source':record['verification_source']}));db.commit()
    return {'id':record['id']}

class SocialRevocationInput(BaseModel):
    organisation_id:str

def revoke_social(db,organisation_id,account_id,user):
    org=get_record(db,Organisation,organisation_id)
    accounts=[dict(a) for a in org.data.get('verified_social_accounts',[])]
    record=next((a for a in accounts if a['id']==account_id),None)
    if not record:raise HTTPException(404,'Approved account not found.')
    record['revoked_at']=utcnow()
    org.data={**org.data,'verified_social_accounts':accounts}
    db.add(Audit(id=uid('audit'),actor_id=user.id,kind='social_account_revoked',target_id=org.id,data={'account_id':account_id}));db.commit()
    return {'id':account_id,'active':False}

@router.post('/admin/social-accounts/{account_id}/revoke')
def revoke_social_account(account_id:str,body:SocialRevocationInput,db:Session=Depends(get_db),user=Depends(require_admin)):
    return revoke_social(db,body.organisation_id,account_id,user)

class SocialRevocationForm(SocialRevocationInput):
    account_id:str

@router.post('/admin/social-accounts/revoke')
def revoke_social_account_form(body:SocialRevocationForm,db:Session=Depends(get_db),user=Depends(require_admin)):
    return revoke_social(db,body.organisation_id,body.account_id,user)

@router.get('/waterbodies/{waterbody_id}/social-accounts')
def relevant_social_accounts(waterbody_id:str,db:Session=Depends(get_db)):
    wb=get_record(db,WaterBody,waterbody_id)
    org_ids=set(db.scalars(select(Case.organisation_id).where(Case.waterbody_id==wb.id,Case.organisation_id.is_not(None))))
    org_ids.update(db.scalars(select(Relationship.target_id).where(Relationship.waterbody_id==wb.id,Relationship.kind=='documented_responsibility',Relationship.target_type=='organisation')))
    if wb.data.get('responsible_organisation_id'):org_ids.add(wb.data['responsible_organisation_id'])
    items=[]
    for org in db.scalars(select(Organisation).where(Organisation.id.in_(org_ids)).order_by(Organisation.name)):
        for account in org.data.get('verified_social_accounts',[]):
            if account.get('revoked_at'):continue
            items.append({**{k:account[k] for k in ('id','platform','handle','account_url','verification_source','verified_at')},'organisation_id':org.id,'organisation_name':org.name,'synthetic':org.synthetic})
    return {'items':items,'automatic_tagging':False,'notice':'Accounts reviewed by a platform administrator using the cited source. Select handles yourself; no organisation is automatically tagged or notified.'}

class MembershipInput(BaseModel):
    email:str
    organisation_id:str
    role:Literal["manager","researcher","volunteer","citizen"]

@router.post("/admin/memberships")
def assign_membership(body:MembershipInput,db:Session=Depends(get_db),admin=Depends(require_admin)):
    org=get_record(db,Organisation,body.organisation_id)
    user=db.scalar(select(User).where(User.email==body.email.lower().strip()))
    if not user: raise HTTPException(404,"Ask this person to register before assigning membership.")
    if user.role=="admin": raise HTTPException(422,"Platform administrators cannot be reassigned through this endpoint.")
    membership=db.scalar(select(Membership).where(Membership.user_id==user.id,Membership.organisation_id==org.id))
    if not membership:
        membership=Membership(id=uid("membership"),user_id=user.id,organisation_id=org.id)
        db.add(membership)
    membership.role="manager" if body.role=="manager" else "contributor"
    user.organisation_id=org.id;user.role=body.role
    db.add(Audit(id=uid("audit"),actor_id=admin.id,kind="membership_assigned",target_id=user.id,data={"organisation_id":org.id,"role":body.role}));db.commit()
    return {"user_id":user.id,"organisation_id":org.id,"role":user.role}

class AssignmentInput(BaseModel):
    organisation_id:str
    reason:str=Field(min_length=8,max_length=4000)
    source_name:str=Field(min_length=3,max_length=200)
    source_url:HttpUrl|None=None
    license:str=Field(min_length=1,max_length=120)
    assign_existing:bool=False

@router.put("/admin/waterbodies/{waterbody_id}/responsibility")
def assign_responsibility(waterbody_id:str,body:AssignmentInput,db:Session=Depends(get_db),user=Depends(require_admin)):
    wb=get_record(db,WaterBody,waterbody_id);org=get_record(db,Organisation,body.organisation_id)
    if wb.synthetic!=org.synthetic:raise HTTPException(422,'Real and demonstration organisations and water bodies cannot be mixed.')
    db.refresh(wb,with_for_update={'key_share':True})
    source=Source(id=uid('source'),waterbody_id=wb.id,organisation_id=org.id,name=body.source_name,kind='responsibility',url=str(body.source_url or ''),license=body.license,attribution=body.source_name,synthetic=wb.synthetic)
    db.add(source);db.flush()
    db.add(Relationship(id=uid('relation'),waterbody_id=wb.id,target_type='organisation',target_id=org.id,kind='documented_responsibility',description=body.reason,source_id=source.id,synthetic=wb.synthetic))
    wb.data={**wb.data,"responsible_organisation_id":body.organisation_id}
    assigned=0
    if body.assign_existing:
        for case in db.scalars(select(Case).where(Case.waterbody_id==wb.id,Case.organisation_id.is_(None),Case.state!='closed').with_for_update()):
            if case.data.get('merged_into'):continue
            case.organisation_id=body.organisation_id;assigned+=1
            emit_event(db,wb.id,case.id,"case_update","Assigned for organisation review",body.reason+' Assignment does not establish recipient acknowledgement.',user.id,source.id)
    emit_event(db,wb.id,None,'registry','Case coordination responsibility recorded',body.reason,user.id,source.id)
    db.add(Audit(id=uid("audit"),actor_id=user.id,kind="responsibility_assigned",target_id=wb.id,data=body.model_dump(mode='json')));db.commit()
    return {"id":wb.id,"waterbody_id":wb.id,"organisation_id":body.organisation_id,'assigned_cases':assigned,'source_id':source.id}

@router.get('/admin/unassigned-cases')
def unassigned_cases(page:int=Query(1,ge=1),db:Session=Depends(get_db),user=Depends(require_admin)):
    stmt=select(Case).where(Case.organisation_id.is_(None),Case.state!='closed',or_(Case.data['merged_into'].as_string().is_(None),Case.data['merged_into'].as_string()=='')).order_by(Case.created_at)
    return {'items':[case_json(db,c) for c in db.scalars(stmt.offset((page-1)*50).limit(50))]}

class CaseAssignmentInput(BaseModel):
    case_id:str
    organisation_id:str
    reason:str=Field(min_length=8,max_length=4000)

@router.post('/admin/case-assignments')
def assign_case(body:CaseAssignmentInput,db:Session=Depends(get_db),user=Depends(require_admin)):
    case=get_record(db,Case,body.case_id);org=get_record(db,Organisation,body.organisation_id)
    wb=get_record(db,WaterBody,case.waterbody_id)
    db.refresh(wb,with_for_update={'key_share':True});db.refresh(case,with_for_update=True)
    if case.state=='closed' or case.data.get('merged_into'):raise HTTPException(409,'Reopen closed cases through the case workflow; merged cases cannot be reassigned.')
    if case.synthetic!=org.synthetic:raise HTTPException(422,'Real cases cannot be assigned to demonstration organisations, or vice versa.')
    previous=case.organisation_id;case.organisation_id=org.id
    emit_event(db,case.waterbody_id,case.id,'case_update','Assigned for organisation review',body.reason+' Assignment does not establish recipient acknowledgement.',user.id)
    db.add(Audit(id=uid('audit'),actor_id=user.id,kind='case_assigned',target_id=case.id,data={'previous_organisation_id':previous,'organisation_id':org.id,'reason':body.reason}));db.commit()
    return {'id':case.id,'organisation_id':org.id,'state':case.state}

def contributor(db,user):
    membership=db.scalar(select(Membership).where(Membership.user_id==user.id,Membership.organisation_id==user.organisation_id))
    if not membership: raise HTTPException(403,"A verified organisation membership is required to contribute ecosystem records.")
    return membership

class BiodiversityInput(BaseModel):
    waterbody_id:str
    common_name:str=Field(min_length=3,max_length=160)
    scientific_name:str=Field(default="",max_length=160)
    observed_at:datetime
    source_name:str=Field(min_length=3,max_length=200)
    license:str=Field(min_length=1,max_length=120)
    restricted:bool=False
    note:str=Field(default="",max_length=4000)

@router.post("/biodiversity",status_code=201)
def add_biodiversity(body:BiodiversityInput,db:Session=Depends(get_db),user=Depends(require_user)):
    contributor(db,user);wb=get_record(db,WaterBody,body.waterbody_id)
    timestamp=iso(body.observed_at)
    if timestamp>utcnow(): raise HTTPException(422,"Observation time cannot be in the future.")
    source=Source(id=uid("source"),waterbody_id=wb.id,organisation_id=user.organisation_id,name=body.source_name,kind="research",license=body.license,attribution=body.source_name,observed_at=timestamp,synthetic=wb.synthetic)
    db.add(source);db.flush()
    row=Biodiversity(id=uid("bio"),waterbody_id=wb.id,source_id=source.id,common_name=body.common_name,scientific_name=body.scientific_name,observed_at=timestamp,restricted=body.restricted,synthetic=wb.synthetic,data={"note":body.note,"review_state":"contributor_record","contributor_id":user.id})
    db.add(row);db.flush();emit_event(db,wb.id,None,"biodiversity","Biodiversity observation added",body.common_name,user.id,source.id);db.commit()
    return {"id":row.id,"source_id":source.id,"review_state":"contributor_record"}

@router.post("/biodiversity/{record_id}/review")
def review_biodiversity(record_id:str,db:Session=Depends(get_db),user=Depends(require_user)):
    member=contributor(db,user)
    if user.role!="researcher" and member.role not in {"manager","admin","reviewer"}: raise HTTPException(403,"Researcher or reviewer permission required.")
    row=get_record(db,Biodiversity,record_id);source=get_record(db,Source,row.source_id)
    if source.organisation_id!=user.organisation_id: raise HTTPException(403,"This record belongs to another organisation.")
    row.data={**row.data,"review_state":"reviewed","reviewed_by":user.id,"reviewed_at":utcnow()};db.add(Audit(id=uid("audit"),actor_id=user.id,kind="biodiversity_reviewed",target_id=row.id));db.commit()
    return {"id":row.id,"review_state":"reviewed"}

class RelationshipInput(BaseModel):
    waterbody_id:str
    target_id:str
    source_id:str
    kind:Literal["documented_waterway","documented_responsibility"]
    description:str=Field(min_length=8,max_length=4000)

@router.post("/admin/relationships",status_code=201)
def add_relationship(body:RelationshipInput,db:Session=Depends(get_db),user=Depends(require_admin)):
    wb=get_record(db,WaterBody,body.waterbody_id);source=get_record(db,Source,body.source_id)
    target_type="waterbody" if body.kind=="documented_waterway" else "organisation"
    get_record(db,WaterBody if target_type=="waterbody" else Organisation,body.target_id)
    row=Relationship(id=uid("relation"),**body.model_dump(),target_type=target_type,synthetic=wb.synthetic or source.synthetic)
    db.add(row);db.commit();return {"id":row.id}

@router.get("/waterbodies/{waterbody_id}/knowledge")
def knowledge(waterbody_id:str,q:str=Query("",max_length=500),db:Session=Depends(get_db)):
    data=passport(waterbody_id,db=db)
    terms=q.casefold().split()
    records=[]
    for kind in ("events","actions","observations","biodiversity","sources","relationships"):
        for row in data[kind]:
            title=row.get("title") or row.get("common_name") or row.get("parameter") or row.get("name") or row.get("kind")
            description=row.get("description") or str(row.get("value",""))
            if terms and not any(t in (str(title)+" "+str(description)).casefold() for t in terms): continue
            records.append({"id":row["id"],"kind":kind,"title":title,"description":description,"source_id":row.get("source_id"),"href":f"/incidents/{row['case_id']}" if row.get("case_id") else f"/waterbodies/{waterbody_id}?tab=History","synthetic":row.get("synthetic",False)})
    return {"records":records[:50],"answer":"Matching stored records are listed below." if records else "No matching stored records. No conclusion can be drawn from missing records.","assistance":"Source-linked retrieval"}

class ComparisonInput(BaseModel):
    before_id:str
    after_id:str
    before_captured_at:datetime
    after_captured_at:datetime
    description:str=Field(min_length=8,max_length=4000)

@router.put("/cases/{case_id}/comparison")
def save_comparison(case_id:str,body:ComparisonInput,db:Session=Depends(get_db),user=Depends(require_manager)):
    case=organisation_case(db,case_id,user)
    before_time,after_time=iso(body.before_captured_at),iso(body.after_captured_at)
    if body.before_id==body.after_id or before_time>=after_time or after_time>utcnow(): raise HTTPException(422,"Choose distinct photographs with chronological, nonfuture capture dates.")
    for eid in (body.before_id,body.after_id):
        e=get_record(db,Evidence,eid)
        if e.case_id!=case.id or e.visibility!="public" or not e.mime_type.startswith("image/"): raise HTTPException(422,"Choose public photographs from this case.")
    case.data={**case.data,"comparison":{**body.model_dump(mode="json"),"before_captured_at":before_time,"after_captured_at":after_time,"recorded_by":user.id,"recorded_at":utcnow()}}
    emit_event(db,case.waterbody_id,case.id,"action","Before/follow-up story documented",body.description,user.id);db.commit()
    return case.data["comparison"]

@router.get("/cases/{case_id}/comparison")
def comparison(case_id:str,db:Session=Depends(get_db)):
    case=get_record(db,Case,case_id);pair=case.data.get("comparison")
    if not pair: return {"comparison":None}
    items=[db.get(Evidence,pair[k]) for k in ("before_id","after_id")]
    if any(not e or e.visibility!="public" for e in items): return {"comparison":None,"notice":"Supporting evidence is no longer public."}
    return {"comparison":pair,"evidence":[evidence_json(e) for e in items]}
