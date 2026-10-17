"""CivicPulse AI — Core Configuration"""

from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────
    app_env: str = "development"
    app_secret_key: str = "CHANGE_ME_GENERATE_A_RANDOM_SECRET"
    app_debug: bool = True
    backend_port: int = 8000
    frontend_url: str = "http://localhost:5173"

    # ── Firebase ─────────────────────────────────────────────
    firebase_project_id: str = ""
    firebase_api_key: str = ""
    firebase_auth_domain: str = ""
    firebase_messaging_sender_id: str = ""
    firebase_app_id: str = ""
    firebase_service_account_path: str = "./firebase-service-account.json"
    firebase_service_account_json: str = ""  # Raw JSON string for cloud deployment

    # ── Gemini ───────────────────────────────────────────────
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    image_verification_confidence_threshold: float = 0.80
    image_verification_medium_threshold: float = 0.50
    image_verification_max_dimension: int = 1600

    # ── Google Sheets ────────────────────────────────────────
    google_sheets_service_account_path: str = "./google-sheets-service-account.json"
    google_sheets_spreadsheet_id: str = ""

    # ── Resend (optional) ────────────────────────────────────
    resend_api_key: str = ""
    resend_from_email: str = "notifications@civicpulse.ai"
    admin_notification_email: str = ""

    # ── Storage ──────────────────────────────────────────────
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 10

    # ── Admin ────────────────────────────────────────────────
    admin_firebase_uids: str = ""  # Comma-separated UIDs

    # ── Rate Limiting ────────────────────────────────────────
    rate_limit_reports_per_hour: int = 10
    rate_limit_otp_per_hour: int = 5

    # ── Database ─────────────────────────────────────────────
    database_url: str = "sqlite:///./civicpulse.db"

    # ── Computed ─────────────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def admin_uids(self) -> list[str]:
        if not self.admin_firebase_uids:
            return []
        return [uid.strip() for uid in self.admin_firebase_uids.split(",") if uid.strip()]

    @property
    def upload_path(self) -> Path:
        p = Path(self.upload_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def firebase_service_account_file(self) -> Optional[Path]:
        candidates = [
            Path(self.firebase_service_account_path),
            Path("firebase-service-account.json"),
            Path("./firebase-service-account.json"),
            Path(__file__).resolve().parent.parent.parent / "firebase-service-account.json",
            Path(__file__).resolve().parent.parent.parent.parent / "firebase-service-account.json",
        ]
        for c in candidates:
            if c.exists() and c.is_file():
                return c
        return None

    @property
    def firebase_configured(self) -> bool:
        return bool(self.firebase_project_id) and (
            bool(self.firebase_service_account_json) or self.firebase_service_account_file is not None
        )

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def sheets_configured(self) -> bool:
        return bool(self.google_sheets_spreadsheet_id) and Path(self.google_sheets_service_account_path).exists()

    @property
    def email_configured(self) -> bool:
        return bool(self.resend_api_key)


settings = Settings()
