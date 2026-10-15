"""CivicPulse AI — Pydantic Schemas for API validation"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ── Issue Categories ─────────────────────────────────────────

VALID_CATEGORIES = [
    "drainage_overflow",
    "garbage_dumping",
    "pothole_damaged_road",
    "waterlogging",
    "broken_streetlight",
    "damaged_infrastructure",
    "sewage_leakage",
    "other",
]

CATEGORY_LABELS = {
    "drainage_overflow": "Drainage Overflow / Blocked Drains",
    "garbage_dumping": "Garbage Dumping",
    "pothole_damaged_road": "Potholes & Damaged Roads",
    "waterlogging": "Waterlogging / Stagnant Water",
    "broken_streetlight": "Broken Streetlights",
    "damaged_infrastructure": "Damaged Public Infrastructure",
    "sewage_leakage": "Sewage Leakage",
    "other": "Other Civic Problem",
}

VALID_SEVERITIES = ["low", "medium", "high", "critical"]
VALID_LOCATION_SOURCES = ["gps", "manual", "exif", "unknown"]
VALID_STATUSES = [
    "submitted",
    "evidence_review",
    "under_review",
    "forwarded",
    "acknowledged",
    "in_progress",
    "resolved",
    "rejected",
]


# ── Report Schemas ───────────────────────────────────────────

class ReportCreate(BaseModel):
    category: str = Field(..., description="Issue category")
    title: str = Field(..., min_length=5, max_length=200, description="Short issue title")
    description: Optional[str] = Field(None, max_length=2000)
    observed_severity: str = Field("medium", description="Observed severity level")
    observed_at: Optional[datetime] = None
    is_safety_risk: bool = False
    nearby_landmark: Optional[str] = Field(None, max_length=200)

    # Location
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    location_accuracy_m: Optional[float] = Field(None, ge=0)
    location_source: str = Field("unknown")
    address: Optional[str] = Field(None, max_length=500)

    # Consent
    location_consent: bool = False
    submission_consent: bool = False

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            raise ValueError(f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}")
        return v

    @field_validator("observed_severity")
    @classmethod
    def validate_severity(cls, v: str) -> str:
        if v not in VALID_SEVERITIES:
            raise ValueError(f"Invalid severity. Must be one of: {', '.join(VALID_SEVERITIES)}")
        return v

    @field_validator("location_source")
    @classmethod
    def validate_location_source(cls, v: str) -> str:
        if v not in VALID_LOCATION_SOURCES:
            raise ValueError(f"Invalid location source. Must be one of: {', '.join(VALID_LOCATION_SOURCES)}")
        return v

    @field_validator("submission_consent")
    @classmethod
    def require_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Submission consent is required.")
        return v


class ReportResponse(BaseModel):
    report_id: str
    created_at: datetime
    updated_at: datetime
    category: str
    category_label: str = ""
    title: str
    description: Optional[str] = None
    observed_severity: str
    observed_at: Optional[datetime] = None
    is_safety_risk: bool = False
    nearby_landmark: Optional[str] = None

    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy_m: Optional[float] = None
    location_source: str
    address: Optional[str] = None

    has_image: bool = False
    image_url: Optional[str] = None

    evidence_risk: str = "inconclusive"
    duplicate_status: str = "unique"

    ai_category: Optional[str] = None
    ai_severity: Optional[str] = None
    ai_description: Optional[str] = None
    ai_confidence: Optional[str] = None
    ai_analysis_status: str = "pending"

    priority_score: Optional[int] = None
    priority_level: Optional[str] = None

    status: str
    assigned_authority: Optional[str] = None
    rejection_reason: Optional[str] = None

    class Config:
        from_attributes = True


class ReportListItem(BaseModel):
    report_id: str
    created_at: datetime
    category: str
    category_label: str = ""
    title: str
    observed_severity: str
    is_safety_risk: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_source: str = "unknown"
    has_image: bool = False
    evidence_risk: str = "inconclusive"
    priority_score: Optional[int] = None
    priority_level: Optional[str] = None
    status: str
    address: Optional[str] = None

    class Config:
        from_attributes = True


class ReportListResponse(BaseModel):
    reports: list[ReportListItem]
    total: int
    page: int
    page_size: int


# ── Evidence Schemas ─────────────────────────────────────────

class EvidenceAssessment(BaseModel):
    file_integrity: str = Field("pending", description="pass | warning | fail")
    metadata_status: str = Field("unavailable", description="present | missing | inconsistent | unavailable")
    location_consistency: str = Field("unavailable", description="consistent | discrepancy | unavailable")
    duplicate_status: str = Field("unique", description="unique | possible_duplicate | exact_duplicate")
    ai_analysis_status: str = Field("pending", description="completed | unavailable | error")
    evidence_risk: str = Field("inconclusive", description="low | medium | high | inconclusive")
    findings: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    requires_review: bool = True

    # Additional details
    exif_timestamp: Optional[datetime] = None
    exif_latitude: Optional[float] = None
    exif_longitude: Optional[float] = None
    exif_camera: Optional[str] = None
    location_distance_m: Optional[float] = None
    perceptual_hash: Optional[str] = None
    duplicate_of_report_id: Optional[str] = None


# ── Status Schemas ───────────────────────────────────────────

class StatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = Field(None, max_length=1000)
    assigned_authority: Optional[str] = Field(None, max_length=200)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}")
        return v


class StatusHistoryItem(BaseModel):
    changed_at: datetime
    from_status: Optional[str] = None
    to_status: str
    changed_by: Optional[str] = None
    reason: Optional[str] = None

    class Config:
        from_attributes = True


class TimelineResponse(BaseModel):
    report_id: str
    current_status: str
    history: list[StatusHistoryItem]


# ── Priority Schemas ─────────────────────────────────────────

class PriorityBreakdown(BaseModel):
    safety_risk_score: int = Field(0, ge=0, le=30)
    severity_score: int = Field(0, ge=0, le=20)
    evidence_score: int = Field(0, ge=0, le=15)
    report_density_score: int = Field(0, ge=0, le=15)
    recency_score: int = Field(0, ge=0, le=10)
    ai_severity_score: int = Field(0, ge=0, le=10)
    total_score: int = Field(0, ge=0, le=100)
    priority_level: str = "low"
    explanation: list[str] = Field(default_factory=list)


# ── Admin Schemas ────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_reports: int = 0
    reports_by_status: dict[str, int] = Field(default_factory=dict)
    reports_by_category: dict[str, int] = Field(default_factory=dict)
    reports_by_priority: dict[str, int] = Field(default_factory=dict)
    reports_awaiting_review: int = 0
    average_priority_score: Optional[float] = None
    sheets_sync_status: str = "unknown"
    last_sync_at: Optional[datetime] = None


class PublicConfig(BaseModel):
    firebase_configured: bool = False
    firebase_api_key: str = ""
    firebase_auth_domain: str = ""
    firebase_project_id: str = ""
    firebase_messaging_sender_id: str = ""
    firebase_app_id: str = ""
    gemini_configured: bool = False
    sheets_configured: bool = False
    email_configured: bool = False
    categories: dict[str, str] = Field(default_factory=lambda: CATEGORY_LABELS)
    max_upload_size_mb: int = 10


# ── Health ───────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
    environment: str = "development"
    services: dict[str, str] = Field(default_factory=dict)
