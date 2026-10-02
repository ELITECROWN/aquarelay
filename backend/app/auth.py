import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from sqlalchemy import select
from sqlalchemy.orm import Session
from .db import get_db
from .models import LoginSession, Membership, User, uid, utcnow

router = APIRouter()
hasher = PasswordHasher()
COOKIE = "aquarelay_session"
SECURE_COOKIE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

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
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "organisation_id": user.organisation_id, "csrf_token": csrf}

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

@router.post("/auth/register", status_code=201)
def register(body: Registration, request: Request, response: Response, db: Session = Depends(get_db)):
    validate_csrf(request, db)
    email = body.email.lower().strip()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(422, "Enter a valid email address.")
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "An account already uses this email address.")
    user = User(id=uid("user"), name=body.name.strip(), email=email, password_hash=hasher.hash(body.password), role="citizen")
    db.add(user)
    db.flush()
    previous = session_record(request, db)
    if previous:
        db.delete(previous)
    row = new_session(db, response, user.id)
    return {"user": public_user(user, row.csrf_token), "csrf_token": row.csrf_token}

@router.post("/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    validate_csrf(request, db)
    row = session_record(request, db)
    if row:
        db.delete(row)
        db.commit()
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}
