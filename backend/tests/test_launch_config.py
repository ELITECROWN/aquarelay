from test_foundation import client
import pytest
from app.launch import validate_environment

def test_launch_rejects_demo_ephemeral_storage_and_insecure_cookies():
    with pytest.raises(ValueError) as exc:validate_environment({'COOKIE_SECURE':'false'})
    assert 'DEMO_MODE' in str(exc.value)
    assert 'PostgreSQL' in str(exc.value)
    assert 'Secure cookies' in str(exc.value)

def test_launch_accepts_explicit_persistent_environment():
    validate_environment({'DEMO_MODE':'false','DATABASE_URL':'postgresql://redacted','STORAGE_BACKEND':'supabase','SUPABASE_URL':'https://project.supabase.co','SUPABASE_SERVICE_ROLE_KEY':'test','PUBLIC_URL':'https://aquarelay.onrender.com','CORS_ORIGINS':'https://aquarelay.onrender.com'})

def test_launch_accepts_modern_supabase_secret():
    validate_environment({'DEMO_MODE':'false','DATABASE_URL':'postgresql://redacted','STORAGE_BACKEND':'supabase','SUPABASE_URL':'https://project.supabase.co','SUPABASE_SECRET_KEY':'sb_secret_test','PUBLIC_URL':'https://aquarelay.vercel.app','CORS_ORIGINS':'https://aquarelay.vercel.app'})

def test_startup_adoption_requires_explicit_flag(monkeypatch):
    from app.launch import prepare_database
    from app import migrate, bootstrap
    calls=[]
    monkeypatch.setattr(migrate,'migrate',lambda **kwargs:calls.append(kwargs))
    monkeypatch.setattr(bootstrap,'from_environment',lambda:None)
    monkeypatch.delenv('REGISTRY_STARTER_PATH',raising=False)
    monkeypatch.delenv('ADOPT_EXISTING_SCHEMA',raising=False)
    prepare_database()
    monkeypatch.setenv('ADOPT_EXISTING_SCHEMA','true')
    prepare_database()
    assert calls==[{'adopt_existing':False},{'adopt_existing':True}]


def test_production_startup_imports_multiple_region_snapshots(client,monkeypatch,tmp_path):
    import json
    import app.migrate,app.bootstrap,app.osm_registry
    from app.launch import prepare_database
    monkeypatch.setattr(app.migrate,'migrate',lambda **kwargs:None)
    monkeypatch.setattr(app.bootstrap,'from_environment',lambda:None)
    imported=[]
    monkeypatch.setattr(app.osm_registry,'import_registry',lambda db,payload:imported.append(payload['aquarelay_registry']['region']))
    paths=[]
    for region in ['sodepur-barrackpore','potheri']:
        path=tmp_path/(region+'.json');path.write_text(json.dumps({'aquarelay_registry':{'region':region},'elements':[]}));paths.append(str(path))
    monkeypatch.delenv('REGISTRY_STARTER_PATH',raising=False)
    monkeypatch.setenv('REGISTRY_STARTER_PATHS',','.join(paths))
    prepare_database()
    assert imported==['sodepur-barrackpore','potheri']
