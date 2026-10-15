"""CivicPulse AI — API Routes: Health & Config"""

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.report import HealthResponse, PublicConfig

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Health check endpoint — reports service availability."""
    services = {
        "database": "available",
        "firebase_auth": "configured" if settings.firebase_configured else "not_configured",
        "gemini_ai": "configured" if settings.gemini_configured else "not_configured",
        "google_sheets": "configured" if settings.sheets_configured else "not_configured",
        "email": "configured" if settings.email_configured else "not_configured",
    }

    return HealthResponse(
        status="ok",
        version="0.1.0",
        environment=settings.app_env,
        services=services,
    )


@router.get("/api/v1/config/public", response_model=PublicConfig, tags=["System"])
async def get_public_config():
    """
    Public configuration — exposes ONLY public Firebase config
    needed by the frontend to initialise auth. No secrets.
    """
    return PublicConfig(
        firebase_configured=settings.firebase_configured,
        firebase_api_key=settings.firebase_api_key,
        firebase_auth_domain=settings.firebase_auth_domain,
        firebase_project_id=settings.firebase_project_id,
        firebase_messaging_sender_id=settings.firebase_messaging_sender_id,
        firebase_app_id=settings.firebase_app_id,
        gemini_configured=settings.gemini_configured,
        sheets_configured=settings.sheets_configured,
        email_configured=settings.email_configured,
        max_upload_size_mb=settings.max_upload_size_mb,
    )
