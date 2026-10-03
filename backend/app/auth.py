import hashlib
import hmac
import os
import secrets
import re
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .db import get_db
from .models import LoginSession, Membership, User, Job, Audit, uid, utcnow

router = APIRouter()
hasher = PasswordHasher()
COOKIE = "aquarelay_session"
SECURE_COOKIE = os.getenv("COOKIE_SECURE", "true").lower() != "false"

def lock_usernames(db):
    # Production accounts serialize uniqueness checks until commit on PostgreSQL.
    if db.bind.dialect.name=='postgresql':db.execute(text("SELECT pg_advisory_xact_lock(hashtext('aquarelay:usernames'))"))

def clean_username(value):
    result=value.strip().lstrip('@').lower()
    if not re.fullmatch(r'[a-z0-9_]{3,40}',result):raise HTTPException(422,'Username must be 3–40 letters, digits or underscores.')
    return result

def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()

def session_record(request, db):
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    row = db.scalar(select(LoginSession).where(LoginSession.token_hash == token_hash(token)))
    if row and row.expires_at > utcnow():
        return row
    return None

def current_user(request: Request, db: Session = Depends(get_db)):
    row = session_record(request, db)
    return db.get(User, row.user_id) if row and row.user_id else None

def require_user(user: User = Depends(current_user)):
    if not user:
        raise HTTPException(401, "Please sign in to continue.")
    return user

def require_manager(user: User = Depends(require_user), db: Session = Depends(get_db)):
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id, Membership.organisation_id == user.organisation_id))
    if not membership or membership.role not in {"manager", "admin", "reviewer"}:
        raise HTTPException(403, "Organisation case-management permission is required.")
    return user

def public_user(user, csrf):
    if not user:
        return None
    prefs = (user.preferences or {}) if hasattr(user, "preferences") else {}
    profile = prefs.get("profile", {}) if isinstance(prefs, dict) else {}
    username = profile.get("username") or (user.email.split("@")[0] if user.email else "")
    age = profile.get("age")
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "organisation_id": user.organisation_id,
        "username": username,
        "age": age,
        "email_verified":bool(user.data.get('email_verified_at')),
        "csrf_token": csrf,
    }

def new_session(db, response, user_id=None):
    token = secrets.token_urlsafe(48)
    row = LoginSession(id=uid("session"), token_hash=token_hash(token), csrf_token=secrets.token_urlsafe(32), user_id=user_id, expires_at=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat())
    db.add(row)
    db.commit()
    response.set_cookie(COOKIE, token, httponly=True, secure=SECURE_COOKIE, samesite="lax", max_age=7*86400, path="/")
    return row

def validate_csrf(request, db):
    row = session_record(request, db)
    token = request.headers.get("x-csrf-token", "")
    if not row or not hmac.compare_digest(token, row.csrf_token):
        raise HTTPException(403, "Session CSRF token required. Refresh your session and retry.")

@router.get("/auth/session")
def auth_session(request: Request, response: Response, db: Session = Depends(get_db)):
    row = session_record(request, db) or new_session(db, response)
    user = db.get(User, row.user_id) if row.user_id else None
    return {"user": public_user(user, row.csrf_token) if user else None, "csrf_token": row.csrf_token}

class Credentials(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)

@router.post("/auth/login")
def login(body: Credentials, request: Request, response: Response, db: Session = Depends(get_db)):
    validate_csrf(request, db)
    user = db.scalar(select(User).where(User.email == body.email.lower().strip()))
    try:
        valid = user and hasher.verify(user.password_hash, body.password)
    except (VerifyMismatchError, InvalidHashError):
        valid = False
    if not valid:
        raise HTTPException(401, "Email or password is incorrect.")
    previous = session_record(request, db)
    if previous:
        db.delete(previous)
    row = new_session(db, response, user.id)
    return {"user": public_user(user, row.csrf_token), "csrf_token": row.csrf_token}

class Registration(Credentials):
    name: str = Field(min_length=2, max_length=120)
    username: str | None = Field(default=None, max_length=40)
    age: int | None = Field(default=None, ge=1, le=130)

@router.post("/auth/register", status_code=201)
def register(body: Registration, request: Request, response: Response, db: Session = Depends(get_db)):
    validate_csrf(request, db)
    lock_usernames(db)
    email = body.email.lower().strip()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(422, "Enter a valid email address.")
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "An account already uses this email address.")
    
    username_clean = clean_username(body.username or email.split("@")[0])
    # Check username uniqueness
    all_users = db.scalars(select(User)).all()
    for u in all_users:
        u_prefs = u.preferences or {}
        u_prof = u_prefs.get("profile", {}) if isinstance(u_prefs, dict) else {}
        existing_u = (u_prof.get("username") or u.email.split("@")[0]).strip().lstrip("@").lower()
        if existing_u == username_clean:
            raise HTTPException(409, f"Username @{username_clean} is already taken. Please choose another unique username.")

    user = User(
        id=uid("user"),
        name=body.name.strip(),
        email=email,
        password_hash=hasher.hash(body.password),
        role="citizen",
        preferences={"profile": {"name": body.name.strip(), "username": username_clean, "age": body.age}},
    )
    db.add(user)
    try:db.flush()
    except IntegrityError:
        db.rollback();raise HTTPException(409,'An account already uses this email address.')
    previous = session_record(request, db)
    if previous:
        db.delete(previous)
    row = new_session(db, response, user.id)
    return {"user": public_user(user, row.csrf_token), "csrf_token": row.csrf_token}

class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    username: str = Field(min_length=3, max_length=40)
    age: int | None = Field(default=None, ge=1, le=130)

@router.put("/auth/profile")
def update_profile(body: ProfileUpdate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_user)):
    validate_csrf(request, db)
    lock_usernames(db)
    username_clean = clean_username(body.username)
    
    all_users = db.scalars(select(User).where(User.id != user.id)).all()
    for u in all_users:
        u_prefs = u.preferences or {}
        u_prof = u_prefs.get("profile", {}) if isinstance(u_prefs, dict) else {}
        existing_u = (u_prof.get("username") or u.email.split("@")[0]).strip().lstrip("@").lower()
        if existing_u == username_clean:
            raise HTTPException(409, f"Username @{username_clean} is already taken. Please choose another unique username.")

    prefs = dict(user.preferences or {})
    current_profile = dict(prefs.get("profile") or {})
    current_profile["name"] = body.name.strip()
    current_profile["username"] = username_clean
    current_profile["age"] = body.age
    prefs["profile"] = current_profile

    user.name = body.name.strip()
    user.preferences = prefs
    db.commit()

    row = session_record(request, db)
    csrf = row.csrf_token if row else ""
    return {"user": public_user(user, csrf), "message": "Profile updated successfully."}

@router.get("/auth/profile")
def get_profile(user: User = Depends(require_user)):
    prefs = user.preferences or {}
    profile = prefs.get("profile", {}) if isinstance(prefs, dict) else {}
    username = profile.get("username") or user.email.split("@")[0]
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "age": profile.get("age"),
        "username": username,
    }

@router.post("/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    validate_csrf(request, db)
    row = session_record(request, db)
    if row:
        db.delete(row)
        db.commit()
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}

class RecoveryRequest(BaseModel):
    email:str=Field(min_length=5,max_length=254)

def queue_account_email(db,user,kind):
    from .mail import configured
    if not configured():raise HTTPException(503,'Account email is not configured. Contact the platform administrator.')
    previous=user.data.get(kind,{})
    if previous.get('requested_at','')>(datetime.now(timezone.utc)-timedelta(minutes=2)).isoformat():return
    token=user.id+'.'+secrets.token_urlsafe(40)
    user.data={**user.data,kind:{'hash':token_hash(token),'expires_at':(datetime.now(timezone.utc)+timedelta(minutes=30)).isoformat(),'requested_at':utcnow()}}
    base=os.environ['PUBLIC_URL'].rstrip('/')
    db.add(Job(id=uid('job'),dedup_key='mail:'+token_hash(token),kind='email',available_at=utcnow(),data={'to':user.email,'subject':'Reset your AquaRelay password' if kind=='recovery' else 'Verify your AquaRelay email','message':'This link expires in 30 minutes.','link':base+('/account/recovery' if kind=='recovery' else '/account/verify')+'?token='+token}))

@router.post('/auth/recovery',status_code=202)
def request_recovery(body:RecoveryRequest,db:Session=Depends(get_db)):
    from .mail import configured
    if not configured():raise HTTPException(503,'Account email is not configured. Contact the platform administrator.')
    user=db.scalar(select(User).where(User.email==body.email.strip().lower()))
    if user:queue_account_email(db,user,'recovery');db.commit()
    return {'message':'If this account exists, a recovery email will be queued.'}

class ResetPassword(BaseModel):
    token:str=Field(min_length=20,max_length=200)
    password:str=Field(min_length=12,max_length=128)

def consume_token(db,token,kind):
    user=db.scalar(select(User).where(User.id==token.split('.',1)[0]).with_for_update())
    record=user.data.get(kind,{}) if user else {}
    if not record.get('hash') or record.get('expires_at','')<utcnow() or not hmac.compare_digest(record['hash'],token_hash(token)):raise HTTPException(422,'Link is invalid, expired or already used. Request a new email.')
    user.data={k:v for k,v in user.data.items() if k!=kind}
    return user

@router.post('/auth/reset-password')
def reset_password(body:ResetPassword,db:Session=Depends(get_db)):
    user=consume_token(db,body.token,'recovery');user.password_hash=hasher.hash(body.password)
    for session in db.scalars(select(LoginSession).where(LoginSession.user_id==user.id)):db.delete(session)
    db.add(Audit(id=uid('audit'),actor_id=user.id,kind='password_recovered',target_id=user.id));db.commit()
    return {'message':'Password updated. Sign in with your new password.'}

@router.post('/auth/request-verification',status_code=202)
def request_verification(db:Session=Depends(get_db),user:User=Depends(require_user)):
    if not user.data.get('email_verified_at'):queue_account_email(db,user,'verification');db.commit()
    return {'message':'Verification email queued if needed.'}

class VerifyToken(BaseModel):
    token:str=Field(min_length=20,max_length=200)

@router.post('/auth/verify-email')
def verify_email(body:VerifyToken,db:Session=Depends(get_db)):
    user=consume_token(db,body.token,'verification');user.data={**user.data,'email_verified_at':utcnow()};db.commit()
    return {'message':'Email verified.'}
