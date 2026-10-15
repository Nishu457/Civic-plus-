"""CivicPulse AI — SQLAlchemy Models"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Index,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_report_id() -> str:
    """Generate a human-readable report ID like CP-2024-A1B2C3."""
    short = uuid.uuid4().hex[:6].upper()
    year = datetime.now(timezone.utc).year
    return f"CP-{year}-{short}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(String(20), unique=True, nullable=False, default=generate_report_id, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    # User
    user_firebase_uid = Column(String(128), nullable=True, index=True)
    user_phone_hash = Column(String(64), nullable=True)  # SHA-256 of phone, not raw phone

    # Issue details
    category = Column(String(100), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    observed_severity = Column(String(20), nullable=False, default="medium")
    observed_at = Column(DateTime, nullable=True)
    is_safety_risk = Column(Boolean, default=False)
    nearby_landmark = Column(String(200), nullable=True)

    # Location
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_accuracy_m = Column(Float, nullable=True)
    location_source = Column(String(20), nullable=False, default="unknown")  # gps, manual, exif
    address = Column(Text, nullable=True)

    # Image
    image_filename = Column(String(255), nullable=True)
    image_original_name = Column(String(255), nullable=True)
    image_sha256 = Column(String(64), nullable=True, index=True)
    image_size_bytes = Column(Integer, nullable=True)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    image_format = Column(String(10), nullable=True)

    # Evidence assessment
    evidence_risk = Column(String(20), default="inconclusive")
    duplicate_status = Column(String(20), default="unique")

    # AI analysis
    ai_category = Column(String(100), nullable=True)
    ai_severity = Column(String(20), nullable=True)
    ai_description = Column(Text, nullable=True)
    ai_confidence = Column(String(20), nullable=True)
    ai_relevant_to_category = Column(Boolean, nullable=True)
    ai_analysis_status = Column(String(20), default="pending")

    # Priority
    priority_score = Column(Integer, nullable=True)
    priority_level = Column(String(20), nullable=True)
    priority_breakdown = Column(Text, nullable=True)  # JSON string

    # Status
    status = Column(String(30), default="submitted", nullable=False, index=True)
    assigned_authority = Column(String(200), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Sync
    sheets_synced = Column(Boolean, default=False)
    sheets_row = Column(Integer, nullable=True)
    notification_status = Column(String(20), default="pending")

    # Consent
    location_consent = Column(Boolean, default=False)
    submission_consent = Column(Boolean, default=False)

    # Relationships
    evidence_checks = relationship("EvidenceCheck", back_populates="report", cascade="all, delete-orphan")
    status_history = relationship("StatusHistory", back_populates="report", cascade="all, delete-orphan", order_by="StatusHistory.changed_at")

    __table_args__ = (
        Index("ix_reports_category_status", "category", "status"),
        Index("ix_reports_location", "latitude", "longitude"),
    )


class EvidenceCheck(Base):
    __tablename__ = "evidence_checks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(String(20), ForeignKey("reports.report_id"), nullable=False, index=True)
    checked_at = Column(DateTime, default=utcnow, nullable=False)

    # File integrity
    file_integrity = Column(String(20), default="pending")  # pass, warning, fail
    mime_type = Column(String(50), nullable=True)
    magic_bytes_match = Column(Boolean, nullable=True)

    # EXIF
    metadata_status = Column(String(20), default="unavailable")  # present, missing, inconsistent
    exif_timestamp = Column(DateTime, nullable=True)
    exif_latitude = Column(Float, nullable=True)
    exif_longitude = Column(Float, nullable=True)
    exif_camera_make = Column(String(100), nullable=True)
    exif_camera_model = Column(String(100), nullable=True)
    exif_software = Column(String(200), nullable=True)

    # Location consistency
    location_consistency = Column(String(20), default="unavailable")  # consistent, discrepancy, unavailable
    location_distance_m = Column(Float, nullable=True)  # Distance between EXIF and reported coords

    # Duplicate
    duplicate_status = Column(String(20), default="unique")
    duplicate_of_report_id = Column(String(20), nullable=True)
    perceptual_hash = Column(String(64), nullable=True)

    # AI
    ai_analysis_status = Column(String(20), default="pending")
    ai_raw_response = Column(Text, nullable=True)  # JSON string of AI response

    # Overall
    evidence_risk = Column(String(20), default="inconclusive")
    findings = Column(Text, nullable=True)  # JSON array
    limitations = Column(Text, nullable=True)  # JSON array
    requires_review = Column(Boolean, default=True)

    report = relationship("Report", back_populates="evidence_checks")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(String(20), ForeignKey("reports.report_id"), nullable=False, index=True)
    changed_at = Column(DateTime, default=utcnow, nullable=False)
    from_status = Column(String(30), nullable=True)
    to_status = Column(String(30), nullable=False)
    changed_by = Column(String(128), nullable=True)  # Firebase UID or "system"
    reason = Column(Text, nullable=True)

    report = relationship("Report", back_populates="status_history")


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=utcnow, nullable=False)
    admin_uid = Column(String(128), nullable=False)
    action = Column(String(100), nullable=False)
    target_report_id = Column(String(20), nullable=True)
    details = Column(Text, nullable=True)  # JSON
    ip_address = Column(String(45), nullable=True)
