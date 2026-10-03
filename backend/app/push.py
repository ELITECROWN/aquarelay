"""Account-scoped Web Push subscriptions; browser permission is requested in the UI."""
import os
import json
import base64
from urllib.parse import urlsplit
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from .models import User
from .auth import require_user
from .db import get_db

router=APIRouter()
def configured():return bool(os.getenv('VAPID_PRIVATE_KEY') and os.getenv('VAPID_PUBLIC_KEY') and os.getenv('VAPID_SUBJECT','').startswith('mailto:'))

@router.get('/push/config')
def configuration():return {'configured':configured(),'public_key':os.getenv('VAPID_PUBLIC_KEY','') if configured() else ''}

class SubscriptionInput(BaseModel):
    endpoint:str=Field(max_length=3000)
    keys:dict[str,str]=Field(min_length=2,max_length=2)

def validate_subscription(body):
    parsed=urlsplit(body.endpoint)
    host=parsed.hostname or ''
    allowed={'fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'}
    if parsed.scheme!='https' or parsed.username or parsed.password or parsed.port not in {None,443} or not (host in allowed or host.endswith('.notify.windows.com')):raise HTTPException(422,'Unsupported browser push-service destination.')
    try:
        if len(body.keys.get('p256dh',''))>128 or len(body.keys.get('auth',''))>32:raise ValueError('Invalid key length')
        pub=base64.urlsafe_b64decode(body.keys['p256dh']+'='*((-len(body.keys['p256dh']))%4))
        auth=base64.urlsafe_b64decode(body.keys['auth']+'='*((-len(body.keys['auth']))%4))
        if len(pub)!=65 or pub[0]!=4 or len(auth)!=16:raise ValueError('Invalid key')
    except (KeyError,ValueError,TypeError):raise HTTPException(422,'Invalid browser subscription keys.')

@router.post('/push/subscriptions',status_code=201)
def subscribe(body:SubscriptionInput,db:Session=Depends(get_db),user=Depends(require_user)):
    validate_subscription(body)
    if not configured():raise HTTPException(503,'Browser push is not configured.')
    if db.bind.dialect.name=='postgresql':db.execute(text("SELECT pg_advisory_xact_lock(hashtext('aquarelay:push-subscriptions'))"))
    for other in db.scalars(select(User).where(User.id!=user.id)):
        previous=other.data.get('push_subscriptions',[])
        if any(x['endpoint']==body.endpoint for x in previous):other.data={**other.data,'push_subscriptions':[x for x in previous if x['endpoint']!=body.endpoint]}
    others=[x for x in user.data.get('push_subscriptions',[]) if x['endpoint']!=body.endpoint]
    if len(others)>=5:raise HTTPException(422,'At most five browsers can receive push updates. Remove an old subscription first.')
    user.data={**user.data,'push_subscriptions':[*others,{'endpoint':body.endpoint,'keys':{k:body.keys[k] for k in ('p256dh','auth')}}]}
    user.preferences={**user.preferences,'push':True};db.commit()
    return {'message':'Browser subscription saved.'}

@router.delete('/push/subscriptions')
def unsubscribe(db:Session=Depends(get_db),user=Depends(require_user)):
    user.data={**user.data,'push_subscriptions':[]};user.preferences={**user.preferences,'push':False};db.commit()
    return {'message':'Push disabled for this account on all registered browsers.'}

def deliver(db,user,notice,job):
    if not configured():raise ValueError('Web Push is not configured')
    from pywebpush import webpush,WebPushException
    subscriptions=user.data.get('push_subscriptions',[])
    delivered=set(job.data.get('delivered_endpoints',[]))
    stale=[]
    for subscription in subscriptions:
        endpoint=subscription['endpoint']
        if endpoint in delivered:continue
        try:
            webpush(subscription_info=subscription,data=json.dumps({'title':notice.title[:160],'body':notice.description[:500],'url':'/notifications','tag':notice.id}),vapid_private_key=os.environ['VAPID_PRIVATE_KEY'],vapid_claims={'sub':os.environ['VAPID_SUBJECT']},timeout=10,ttl=86400)
        except WebPushException as exc:
            if exc.response is not None and exc.response.status_code in {404,410}:stale.append(endpoint)
            else:raise ValueError('Push delivery failed; retry scheduled')
        delivered.add(endpoint)
        job.data={**job.data,'delivered_endpoints':list(delivered)}
        if stale:user.data={**user.data,'push_subscriptions':[x for x in subscriptions if x['endpoint'] not in stale]}
        db.commit()
