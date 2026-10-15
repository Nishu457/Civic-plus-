"""CivicPulse AI — API Routes: Admin Dashboard"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_admin_user
from app.models.report import AdminAuditLog, Report, StatusHistory, utcnow
from app.schemas.report import (
    CATEGORY_LABELS,
    DashboardStats,
    ReportListItem,
    ReportListResponse,
    ReportResponse,
    StatusUpdate,
    VALID_STATUSES,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


def _report_to_list_item(report: Report) -> ReportListItem:
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


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Admin dashboard statistics from real data."""
    total = db.query(func.count(Report.id)).scalar() or 0

    # Status breakdown
    status_counts = (
        db.query(Report.status, func.count(Report.id))
        .group_by(Report.status)
        .all()
    )
    reports_by_status = {s: c for s, c in status_counts}

    # Category breakdown
    category_counts = (
        db.query(Report.category, func.count(Report.id))
        .group_by(Report.category)
        .all()
    )
    reports_by_category = {CATEGORY_LABELS.get(c, c): count for c, count in category_counts}

    # Priority breakdown
    priority_counts = (
        db.query(Report.priority_level, func.count(Report.id))
        .filter(Report.priority_level.isnot(None))
        .group_by(Report.priority_level)
        .all()
    )
    reports_by_priority = {p: c for p, c in priority_counts}

    awaiting = reports_by_status.get("submitted", 0) + reports_by_status.get("evidence_review", 0)

    avg_priority = db.query(func.avg(Report.priority_score)).filter(
        Report.priority_score.isnot(None)
    ).scalar()

    # Sheets sync status
    unsynced = db.query(func.count(Report.id)).filter(Report.sheets_synced == False).scalar() or 0
    sync_status = "all_synced" if unsynced == 0 and total > 0 else f"{unsynced}_pending"

    return DashboardStats(
        total_reports=total,
        reports_by_status=reports_by_status,
        reports_by_category=reports_by_category,
        reports_by_priority=reports_by_priority,
        reports_awaiting_review=awaiting,
        average_priority_score=round(avg_priority, 1) if avg_priority else None,
        sheets_sync_status=sync_status,
    )


@router.get("/reports", response_model=ReportListResponse)
async def admin_list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = None,
    evidence_risk: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("created_at", pattern="^(created_at|priority_score|status)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Admin: list all reports with advanced filters."""
    query = db.query(Report)

    if category:
        query = query.filter(Report.category == category)
    if status_filter:
        query = query.filter(Report.status == status_filter)
    if severity:
        query = query.filter(Report.observed_severity == severity)
    if evidence_risk:
        query = query.filter(Report.evidence_risk == evidence_risk)
    if search:
        query = query.filter(
            Report.title.ilike(f"%{search}%") | Report.report_id.ilike(f"%{search}%")
        )

    total = query.count()

    sort_col = getattr(Report, sort_by, Report.created_at)
    if sort_order == "desc":
        sort_col = sort_col.desc()

    reports = query.order_by(sort_col).offset((page - 1) * page_size).limit(page_size).all()

    return ReportListResponse(
        reports=[_report_to_list_item(r) for r in reports],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/reports/{report_id}/status")
async def update_report_status(
    report_id: str,
    update: StatusUpdate,
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Admin: update report status with audit trail."""
    report = db.query(Report).filter(Report.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    old_status = report.status
    report.status = update.status
    report.updated_at = utcnow()

    if update.assigned_authority:
        report.assigned_authority = update.assigned_authority
    if update.status == "rejected" and update.reason:
        report.rejection_reason = update.reason

    # Status history
    history = StatusHistory(
        report_id=report_id,
        from_status=old_status,
        to_status=update.status,
        changed_by=admin.get("uid", "admin"),
        reason=update.reason,
    )
    db.add(history)

    # Audit log
    audit = AdminAuditLog(
        admin_uid=admin.get("uid", "admin"),
        action="status_update",
        target_report_id=report_id,
        details=json.dumps({
            "from": old_status,
            "to": update.status,
            "reason": update.reason,
            "assigned_authority": update.assigned_authority,
        }),
    )
    db.add(audit)
    db.commit()

    logger.info(f"Admin {admin.get('uid')} updated {report_id}: {old_status} → {update.status}")
    return {"message": f"Status updated to {update.status}", "report_id": report_id}


@router.get("/sync-status")
async def get_sync_status(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Admin: get Google Sheets sync status."""
    from app.core.config import settings

    total = db.query(func.count(Report.id)).scalar() or 0
    synced = db.query(func.count(Report.id)).filter(Report.sheets_synced == True).scalar() or 0
    pending = total - synced

    return {
        "sheets_configured": settings.sheets_configured,
        "total_reports": total,
        "synced": synced,
        "pending": pending,
        "status": "all_synced" if pending == 0 and total > 0 else f"{pending}_pending",
    }


@router.post("/sync-reports")
async def trigger_sync(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Admin: trigger Google Sheets sync for pending reports."""
    from app.core.config import settings

    if not settings.sheets_configured:
        raise HTTPException(400, "Google Sheets is not configured.")

    try:
        from app.services.sheets import SheetsService
        sheets = SheetsService()
        result = await sheets.sync_pending_reports(db)

        # Audit log
        audit = AdminAuditLog(
            admin_uid=admin.get("uid", "admin"),
            action="sheets_sync",
            details=json.dumps(result),
        )
        db.add(audit)
        db.commit()

        return result
    except Exception as e:
        logger.error(f"Sheets sync failed: {e}")
        raise HTTPException(500, f"Sync failed: {str(e)}")


@router.get("/audit-log")
async def get_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Admin: view audit log."""
    total = db.query(func.count(AdminAuditLog.id)).scalar() or 0
    logs = (
        db.query(AdminAuditLog)
        .order_by(AdminAuditLog.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "entries": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "admin_uid": log.admin_uid,
                "action": log.action,
                "target_report_id": log.target_report_id,
                "details": json.loads(log.details) if log.details else None,
            }
            for log in logs
        ],
    }
