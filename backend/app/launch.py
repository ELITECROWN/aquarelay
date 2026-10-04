"""Production startup for a single Render web service with durable SQL outbox."""
import os
import uvicorn

def validate_environment(env):
    errors=[]
    if env.get('DEMO_MODE','true').lower()!='false':errors.append('DEMO_MODE must be false')
    if not env.get('DATABASE_URL','').startswith(('postgresql://','postgresql+psycopg://')):errors.append('Persistent PostgreSQL DATABASE_URL required')
    if env.get('STORAGE_BACKEND')!='supabase':errors.append('STORAGE_BACKEND must be supabase on ephemeral hosting')
    for name in ('SUPABASE_URL','PUBLIC_URL','CORS_ORIGINS'):
        if not env.get(name):errors.append(name+' required')
    key=env.get('SUPABASE_SECRET_KEY') or env.get('SUPABASE_SERVICE_ROLE_KEY','')
    if not key or key.startswith('sb_publishable_'):errors.append('SUPABASE_SECRET_KEY server key required')
    if env.get('COOKIE_SECURE','true').lower()=='false':errors.append('Secure cookies required')
    if not env.get('PUBLIC_URL','').startswith('https://'):errors.append('PUBLIC_URL must use HTTPS')
    if errors:raise ValueError('; '.join(errors))

def prepare_database():
    from .migrate import migrate
    migrate(adopt_existing=os.getenv('ADOPT_EXISTING_SCHEMA','false').lower()=='true')
    from .bootstrap import from_environment
    from_environment()
    from .authority_directory import seed_directory
    from .db import SessionLocal
    if os.getenv("DEMO_MODE","true").lower()=="false":
        with SessionLocal() as db:seed_directory(db)
    paths=[os.getenv('REGISTRY_STARTER_PATH',''),*os.getenv('REGISTRY_STARTER_PATHS','').split(',')]
    paths=list(dict.fromkeys(path.strip() for path in paths if path.strip()))
    if paths:
        import json
        from pathlib import Path
        from .osm_registry import import_registry
        from .db import SessionLocal
        for path in paths:
            payload=json.loads(Path(path).read_text(encoding='utf-8'))
            with SessionLocal() as db:import_registry(db,payload)

def main():
    validate_environment(os.environ)
    prepare_database()
    uvicorn.run('app.main:app',host='0.0.0.0',port=int(os.getenv('PORT','8000')),proxy_headers=True,forwarded_allow_ips=os.getenv('FORWARDED_ALLOW_IPS','127.0.0.1'))

if __name__=='__main__':main()
