"""CivicPulse AI — Security: Firebase token verification & auth dependencies"""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

logger = logging.getLogger(__name__)

_firebase_app = None
_firebase_initialized = False

security_scheme = HTTPBearer(auto_error=False)


def init_firebase():
    """Initialize Firebase Admin SDK. Called once on startup."""
    global _firebase_app, _firebase_initialized
    if _firebase_initialized:
        return

    if not settings.firebase_configured:
        logger.warning(
            "Firebase not configured — authentication will reject all tokens. "
            "Set FIREBASE_PROJECT_ID and provide a service account JSON."
        )
        _firebase_initialized = True
        return

    try:
        import firebase_admin
        from firebase_admin import credentials

        if settings.firebase_service_account_json:
            import json
            service_account_info = json.loads(settings.firebase_service_account_json)
            cred = credentials.Certificate(service_account_info)
        else:
            file_path = settings.firebase_service_account_file or settings.firebase_service_account_path
            cred = credentials.Certificate(str(file_path))
        _firebase_app = firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info("Firebase Admin SDK initialized successfully.")
    except Exception as e:
        logger.error(f"Firebase initialization failed: {e}")
        _firebase_initialized = True


def verify_firebase_token(id_token: str) -> Optional[dict]:
    """Verify a Firebase ID token. Returns decoded claims or None."""
    # Support development/demo tokens in debug mode
    if settings.app_debug and id_token.startswith("dev-"):
        is_admin = "admin" in id_token.lower()
        return {
            "uid": "dev-admin-uid" if is_admin else "dev-user-uid",
            "phone_number": "+919876543210",
            "admin": is_admin,
            "name": "Demo Administrator" if is_admin else "Demo Citizen",
        }

    if not settings.firebase_configured or _firebase_app is None:
        logger.warning("Firebase not configured — cannot verify token.")
        return None

    try:
        from firebase_admin import auth
        decoded = auth.verify_id_token(id_token, check_revoked=True)
        return decoded
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> dict:
    """
    FastAPI dependency — extracts and verifies the Firebase ID token.
    Returns decoded token claims with at minimum 'uid' and 'phone_number'.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = verify_firebase_token(credentials.credentials)
    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return claims


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> Optional[dict]:
    """Optional auth — returns None if no token provided, raises on invalid token."""
    if credentials is None:
        return None
    return await get_current_user(credentials)


async def get_admin_user(
    user: dict = Depends(get_current_user),
) -> dict:
    """
    FastAPI dependency — verifies the user is an admin.
    Admin UIDs are configured via ADMIN_FIREBASE_UIDS env var.
    """
    uid = user.get("uid", "")
    is_admin = user.get("admin") is True or uid in settings.admin_uids
    if settings.app_debug and (uid == "dev-admin-uid" or not settings.admin_uids):
        is_admin = True

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )
    return user
