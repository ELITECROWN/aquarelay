"""Run interactively in Render Shell; never accept a password on the command line."""
import getpass
import os
from sqlalchemy import select
from .auth import hasher
from .db import SessionLocal
from .models import User, Audit, uid

def create_admin(email,name,password):
    if '@' not in email or len(name)<2 or len(password)<14: raise SystemExit('Valid email, name and 14-character password required.')
    with SessionLocal() as db:
        existing=db.scalar(select(User).where(User.email==email))
        if existing:
            if existing.role!='admin': raise SystemExit('Refusing to promote an existing account through bootstrap.')
            return
        user=User(id=uid('user'),email=email,name=name,password_hash=hasher.hash(password),role='admin',preferences={})
        db.add(user);db.flush();db.add(Audit(id=uid('audit'),actor_id=user.id,kind='initial_admin_created',target_id=user.id));db.commit()
    print('Administrator created. Sign in and open /registry. No demonstration records were added.')

def from_environment():
    email=os.getenv('BOOTSTRAP_ADMIN_EMAIL','').strip().lower()
    if email:create_admin(email,os.getenv('BOOTSTRAP_ADMIN_NAME','AquaRelay administrator'),os.environ['BOOTSTRAP_ADMIN_PASSWORD'])

def main():
    email=input('Admin email: ').strip().lower()
    name=input('Admin display name: ').strip()
    password=getpass.getpass('New admin password (minimum 14 characters): ')
    if password!=getpass.getpass('Repeat password: '): raise SystemExit('Passwords differ.')
    create_admin(email,name,password)

if __name__=='__main__': main()
