"""Production startup for a single Render web service with durable SQL outbox."""
import os
import uvicorn

def validate_environment(env):
    errors=[]
    if env.get('DEMO_MODE','true').lower()!='false':errors.append('DEMO_MODE must be false')
    if not env.get('DATABASE_URL','').startswith(('postgresql://','postgresql+psycopg://')):errors.append('Persistent PostgreSQL DATABASE_URL required')
    if env.get('STORAGE_BACKEND')!='supabase':errors.append('STORAGE_BACKEND must be supabase on ephemeral hosting')
    for name in ('SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','PUBLIC_URL','CORS_ORIGINS'):
        if not env.get(name):errors.append(name+' required')
    if env.get('COOKIE_SECURE','true').lower()=='false':errors.append('Secure cookies required')
    if not env.get('PUBLIC_URL','').startswith('https://'):errors.append('PUBLIC_URL must use HTTPS')
    if errors:raise ValueError('; '.join(errors))

def main():
    validate_environment(os.environ)
    from .migrate import migrate
    migrate()
    from .bootstrap import from_environment
    from_environment()
    if os.getenv('REGISTRY_STARTER_PATH'):
        import json
        from pathlib import Path
        from .osm_registry import import_registry
        from .db import SessionLocal
        payload=json.loads(Path(os.environ['REGISTRY_STARTER_PATH']).read_text(encoding='utf-8'))
        with SessionLocal() as db:import_registry(db,payload)
    uvicorn.run('app.main:app',host='0.0.0.0',port=int(os.getenv('PORT','8000')),proxy_headers=True,forwarded_allow_ips=os.getenv('FORWARDED_ALLOW_IPS','127.0.0.1'))

if __name__=='__main__':main()
