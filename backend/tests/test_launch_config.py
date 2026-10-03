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
