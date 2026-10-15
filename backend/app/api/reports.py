"""CivicPulse AI — API Routes: Reports"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, get_current_user_optional
from app.models.report import Report, StatusHistory, generate_report_id, utcnow
from app.schemas.report import (
    CATEGORY_LABELS,
    VALID_CATEGORIES,
    VALID_SEVERITIES,
    VALID_LOCATION_SOURCES,
    EvidenceAssessment,
    ReportListItem,
    ReportListResponse,
    ReportResponse,
    StatusHistoryItem,
    TimelineResponse,
)
from app.services.evidence import EvidenceService
from app.services.priority import PriorityService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Reports"])


def _report_to_response(report: Report) -> ReportResponse:
    """Convert a Report model to response schema."""
    return ReportResponse(
        report_id=report.report_id,
        created_at=report.created_at,
        updated_at=report.updated_at,
        category=report.category,
        category_label=CATEGORY_LABELS.get(report.category, report.category),
        title=report.title,
        description=report.description,
        observed_severity=report.observed_severity,
        observed_at=report.observed_at,
        is_safety_risk=report.is_safety_risk,
        nearby_landmark=report.nearby_landmark,
        latitude=report.latitude,
        longitude=report.longitude,
        location_accuracy_m=report.location_accuracy_m,
        location_source=report.location_source,
        address=report.address,
        has_image=bool(report.image_filename),
        image_url=f"/uploads/{report.image_filename}" if report.image_filename else None,
        evidence_risk=report.evidence_risk,
        duplicate_status=report.duplicate_status,
        ai_category=report.ai_category,
        ai_severity=report.ai_severity,
        ai_description=report.ai_description,
        ai_confidence=report.ai_confidence,
        ai_analysis_status=report.ai_analysis_status,
        priority_score=report.priority_score,
        priority_level=report.priority_level,
        status=report.status,
        assigned_authority=report.assigned_authority,
        rejection_reason=report.rejection_reason,
    )


def _report_to_list_item(report: Report) -> ReportListItem:
    """Convert a Report model to list item schema."""
    return ReportListItem(
        report_id=report.report_id,
        created_at=report.created_at,
        category=report.category,
        category_label=CATEGORY_LABELS.get(report.category, report.category),
        title=report.title,
        observed_severity=report.observed_severity,
        is_safety_risk=report.is_safety_risk,
        latitude=report.latitude,
        longitude=report.longitude,
        location_source=report.location_source,
        has_image=bool(report.image_filename),
        image_url=f"/uploads/{report.image_filename}" if report.image_filename else None,
        evidence_risk=report.evidence_risk,
        priority_score=report.priority_score,
        priority_level=report.priority_level,
        status=report.status,
        address=report.address,
    )


@router.get("/reports", response_model=ReportListResponse)
async def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List reports (public — no auth required). Paginated and filterable."""
    query = db.query(Report)

    if category and category in VALID_CATEGORIES:
        query = query.filter(Report.category == category)
    if status_filter:
        query = query.filter(Report.status == status_filter)
    if severity and severity in VALID_SEVERITIES:
        query = query.filter(Report.observed_severity == severity)

    total = query.count()
    reports = (
        query.order_by(Report.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return ReportListResponse(
        reports=[_report_to_list_item(r) for r in reports],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/reports/{report_id}", response_model=ReportResponse)
async def get_report(report_id: str, db: Session = Depends(get_db)):
    """Get a single report by ID (public)."""
    report = db.query(Report).filter(Report.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    return _report_to_response(report)


@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    category: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    observed_severity: str = Form("medium"),
    observed_at: Optional[str] = Form(None),
    is_safety_risk: bool = Form(False),
    nearby_landmark: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    location_accuracy_m: Optional[float] = Form(None),
    location_source: str = Form("unknown"),
    address: Optional[str] = Form(None),
    location_consent: bool = Form(False),
    submission_consent: bool = Form(False),
    image: Optional[UploadFile] = File(None),
    user: Optional[dict] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Create a new civic issue report with optional image upload.
    Accepts multipart/form-data.
    """
    # ── Validate inputs ──────────────────────────────────────
    if category not in VALID_CATEGORIES:
        raise HTTPException(400, f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}")
    if observed_severity not in VALID_SEVERITIES:
        raise HTTPException(400, f"Invalid severity. Must be one of: {', '.join(VALID_SEVERITIES)}")
    if location_source not in VALID_LOCATION_SOURCES:
        raise HTTPException(400, f"Invalid location source.")
    if not title or len(title.strip()) < 5:
        raise HTTPException(400, "Title must be at least 5 characters.")
    if not submission_consent:
        raise HTTPException(400, "Submission consent is required.")

    # ── Parse optional datetime ──────────────────────────────
    parsed_observed_at = None
    if observed_at:
        try:
            parsed_observed_at = datetime.fromisoformat(observed_at)
        except ValueError:
            raise HTTPException(400, "Invalid observed_at datetime format.")

    # ── Process image ────────────────────────────────────────
    evidence_service = EvidenceService()
    image_result = None
    if image:
        image_result = await evidence_service.process_upload(image, db)
        if image_result.get("error"):
            raise HTTPException(400, image_result["error"])

    # ── Create report ────────────────────────────────────────
    report = Report(
        report_id=generate_report_id(),
        category=category,
        title=title.strip(),
        description=description.strip() if description else None,
        observed_severity=observed_severity,
        observed_at=parsed_observed_at,
        is_safety_risk=is_safety_risk,
        nearby_landmark=nearby_landmark.strip() if nearby_landmark else None,
        latitude=latitude,
        longitude=longitude,
        location_accuracy_m=location_accuracy_m,
        location_source=location_source,
        address=address.strip() if address else None,
        location_consent=location_consent,
        submission_consent=submission_consent,
        user_firebase_uid=user.get("uid") if user else None,
        status="submitted",
    )

    # Attach image data if processed
    if image_result and not image_result.get("error"):
        report.image_filename = image_result.get("filename")
        report.image_original_name = image_result.get("original_name")
        report.image_sha256 = image_result.get("sha256")
        report.image_size_bytes = image_result.get("size_bytes")
        report.image_width = image_result.get("width")
        report.image_height = image_result.get("height")
        report.image_format = image_result.get("format")

    db.add(report)

    # Add initial status history
    status_entry = StatusHistory(
        report_id=report.report_id,
        from_status=None,
        to_status="submitted",
        changed_by=user.get("uid") if user else "anonymous",
        reason="Report submitted.",
    )
    db.add(status_entry)
    db.commit()
    db.refresh(report)

    # ── Run evidence checks async (non-blocking for demo) ────
    try:
        assessment = await evidence_service.run_evidence_check(report, db)
        # Update report with evidence results
        report.evidence_risk = assessment.evidence_risk
        report.duplicate_status = assessment.duplicate_status
        report.ai_analysis_status = assessment.ai_analysis_status
        if assessment.ai_analysis_status == "completed":
            # AI results stored in evidence check, update report-level fields
            pass

        # Run priority scoring
        priority = PriorityService.calculate_priority(report, db)
        report.priority_score = priority.total_score
        report.priority_level = priority.priority_level
        report.priority_breakdown = json.dumps(priority.model_dump())

        db.commit()
        db.refresh(report)
    except Exception as e:
        logger.error(f"Evidence check error for {report.report_id}: {e}")
        # Report is still saved, evidence check can be retried

    logger.info(f"Report created: {report.report_id}")
    return _report_to_response(report)


@router.get("/users/me/reports", response_model=ReportListResponse)
async def get_my_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get reports submitted by the authenticated user."""
    uid = user.get("uid", "")
    query = db.query(Report).filter(Report.user_firebase_uid == uid)

    total = query.count()
    reports = (
        query.order_by(Report.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return ReportListResponse(
        reports=[_report_to_list_item(r) for r in reports],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/reports/{report_id}/timeline", response_model=TimelineResponse)
async def get_report_timeline(report_id: str, db: Session = Depends(get_db)):
    """Get the status timeline for a report."""
    report = db.query(Report).filter(Report.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    history = (
        db.query(StatusHistory)
        .filter(StatusHistory.report_id == report_id)
        .order_by(StatusHistory.changed_at.asc())
        .all()
    )

    return TimelineResponse(
        report_id=report_id,
        current_status=report.status,
        history=[
            StatusHistoryItem(
                changed_at=h.changed_at,
                from_status=h.from_status,
                to_status=h.to_status,
                changed_by=h.changed_by,
                reason=h.reason,
            )
            for h in history
        ],
    )


@router.get("/reports/{report_id}/evidence", response_model=EvidenceAssessment)
async def get_evidence_assessment(report_id: str, db: Session = Depends(get_db)):
    """Get the evidence assessment for a report."""
    from app.models.report import EvidenceCheck

    report = db.query(Report).filter(Report.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    check = (
        db.query(EvidenceCheck)
        .filter(EvidenceCheck.report_id == report_id)
        .order_by(EvidenceCheck.checked_at.desc())
        .first()
    )

    if not check:
        return EvidenceAssessment(
            findings=["No evidence check has been performed yet."],
            limitations=["Evidence assessment pending."],
        )

    return EvidenceAssessment(
        file_integrity=check.file_integrity,
        metadata_status=check.metadata_status,
        location_consistency=check.location_consistency,
        duplicate_status=check.duplicate_status,
        ai_analysis_status=check.ai_analysis_status,
        evidence_risk=check.evidence_risk,
        findings=json.loads(check.findings) if check.findings else [],
        limitations=json.loads(check.limitations) if check.limitations else [],
        requires_review=check.requires_review,
        exif_timestamp=check.exif_timestamp,
        exif_latitude=check.exif_latitude,
        exif_longitude=check.exif_longitude,
        exif_camera=f"{check.exif_camera_make or ''} {check.exif_camera_model or ''}".strip() or None,
        location_distance_m=check.location_distance_m,
        perceptual_hash=check.perceptual_hash,
        duplicate_of_report_id=check.duplicate_of_report_id,
    )


@router.get("/reports/{report_id}/image")
async def get_report_image(report_id: str, db: Session = Depends(get_db)):
    """
    Retrieve the uploaded image for a report with correct content-type, cache headers, and CORS.
    """
    import mimetypes
    from fastapi.responses import FileResponse

    report = db.query(Report).filter(Report.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    if not report.image_filename:
        raise HTTPException(status_code=404, detail="This report has no attached image.")

    file_path = settings.upload_path / report.image_filename
    if not file_path.is_file():
        logger.warning(f"Image file missing on disk: {file_path} for report {report_id}")
        raise HTTPException(status_code=404, detail="Image file not found in storage.")

    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        ext = file_path.suffix.lower().lstrip(".")
        mime_type = f"image/{ext}" if ext in ("jpeg", "jpg", "png", "webp") else "application/octet-stream"

    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        headers={
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "Access-Control-Allow-Origin": "*",
        },
    )
