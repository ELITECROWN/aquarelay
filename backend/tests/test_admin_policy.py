import pytest
from fastapi import HTTPException
from app.models import User
from app.auth import public_user
from app.workspace import require_admin

def test_production_admin_is_only_verified_owner(monkeypatch):
    monkeypatch.setenv('DEMO_MODE', 'false')
    for email, role, data in [
        ('other@gmail.com', 'admin', {'email_verified_at':'2026-10-05'}),
        ('dibyendukoley50@gmail.com', 'admin', {}),
        ('dibyendukoley50@gmail.com', 'citizen', {'email_verified_at':'2026-10-05'}),
    ]:
        with pytest.raises(HTTPException) as error:
            require_admin(User(email=email, role=role, data=data))
        assert error.value.status_code == 403
    owner = User(email='dibyendukoley50@gmail.com', role='admin', data={'email_verified_at':'2026-10-05'})
    assert require_admin(owner) is owner

def test_other_admin_has_no_public_admin_role(monkeypatch):
    monkeypatch.setenv('DEMO_MODE', 'false')
    user = User(email='other@gmail.com', role='admin', data={}, preferences={})
    assert public_user(user, 'csrf')['role'] == 'citizen'
