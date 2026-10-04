"""Owner-only, paginated record inspection; never expose credentials or storage paths."""
from typing import Literal
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from .db import get_db
from .workspace import require_admin
from .models import User, Report, Case, WaterBody, Evidence, Organisation, LoginSession

router = APIRouter()

@router.get('/admin/records/summary')
def summary(response: Response, db: Session = Depends(get_db), user=Depends(require_admin)):
    response.headers['Cache-Control'] = 'private, no-store'
    models = {'accounts':User,'reports':Report,'incidents':Case,'waterbodies':WaterBody,
              'uploads':Evidence,'organisations':Organisation,'sessions':LoginSession}
    counts = db.execute(select(*[select(func.count()).select_from(model).scalar_subquery().label(name)
                                for name, model in models.items()])).mappings().one()
    return {'counts':dict(counts)}

@router.get('/admin/records')
def records(response: Response, kind: Literal['accounts','reports','incidents','waterbodies','uploads']='reports',
            q: str=Query('',max_length=160), page: int=Query(1,ge=1,le=100000),
            page_size: int=Query(25,ge=1,le=50), db: Session=Depends(get_db), user=Depends(require_admin)):
    response.headers['Cache-Control'] = 'private, no-store'
    model = {'accounts':User,'reports':Report,'incidents':Case,'waterbodies':WaterBody,'uploads':Evidence}[kind]
    if kind == 'reports':
        query = select(Report,WaterBody.name,Case.state).join(WaterBody,Report.waterbody_id==WaterBody.id).join(Case,Report.case_id==Case.id)
        fields = [Report.id,Report.description,WaterBody.name,Report.observation_type]
    else:
        query = select(model)
        fields = [model.id, model.email, model.name] if kind == 'accounts' else [model.id,model.title,model.description] if kind == 'incidents' else [model.id,model.name,model.locality] if kind == 'waterbodies' else [model.id,model.name]
    if q.strip(): query = query.where(or_(*[field.icontains(q.strip(),autoescape=True) for field in fields]))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.execute(query.order_by(model.created_at.desc(),model.id).offset((page-1)*page_size).limit(page_size)).all()
    items = []
    for row in rows:
        record = row[0]
        item = {'id':record.id,'created_at':record.created_at}
        if kind == 'accounts':
            item.update(name=record.name,detail=record.email,status=record.role,
                        email_verified=bool((record.data or {}).get('email_verified_at')))
        elif kind == 'reports':
            item.update(name=row[1],detail=record.description,status=row[2],observation_type=record.observation_type,
                        case_id=record.case_id,waterbody_id=record.waterbody_id)
        elif kind == 'incidents':
            item.update(name=record.title,detail=record.description,status=record.state,case_id=record.id)
        elif kind == 'waterbodies':
            item.update(name=record.name,detail=record.locality,status=record.type,waterbody_id=record.id)
        else:
            item.update(name=record.name,detail=record.mime_type,status=record.visibility,size=record.size,case_id=record.case_id)
        items.append(item)
    return {'kind':kind,'items':items,'total':total,'page':page,'page_size':page_size}
