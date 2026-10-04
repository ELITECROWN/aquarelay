"""Platform administration is reserved for the verified project owner."""
import os

OWNER_EMAIL = "dibyendukoley50@gmail.com"

def owner_verified(user):
    return bool(user and (user.email or "").strip().lower() == OWNER_EMAIL
                and (user.data or {}).get("email_verified_at"))

def platform_admin(user):
    if not user or user.role != "admin":
        return False
    if os.getenv("DEMO_MODE", "false").lower() == "true":
        return True
    return owner_verified(user)
