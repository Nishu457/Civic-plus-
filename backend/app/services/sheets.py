"""
CivicPulse AI — Google Sheets Sync Service

Syncs reports to a Google Spreadsheet as an additional
reporting and administration layer.

Design:
- SQLite is the primary data store. Sheets is supplementary.
- Reports are saved locally FIRST, then synced.
- Sync failures are retried with exponential backoff.
- Duplicate rows are prevented by checking report_id before insert.
- No secrets or sensitive user data in Sheets.
"""

import json
import logging
import time
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

REPORTS_SHEET = "Reports"
EVIDENCE_SHEET = "EvidenceChecks"
STATUS_SHEET = "StatusHistory"
AUDIT_SHEET = "AdminAuditLog"

REPORTS_HEADERS = [
    "report_id", "created_at", "updated_at", "category", "title",
    "description", "latitude", "longitude", "location_accuracy_m",
    "location_source", "observed_at", "image_reference",
    "image_sha256", "evidence_risk", "duplicate_status",
    "ai_category", "priority_score", "priority_level",
    "status", "assigned_authority", "notification_status",
]


class SheetsService:
    """Google Sheets sync service with retry and deduplication."""

    def __init__(self):
        self._client = None
        self._spreadsheet = None

    def _get_client(self):
        """Lazy-initialize the gspread client."""
        if self._client is not None:
            return self._client

        if not settings.sheets_configured:
            raise RuntimeError("Google Sheets not configured. Check env vars.")

        try:
            import gspread
            from google.oauth2.service_account import Credentials

            scopes = [
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive",
            ]
            creds = Credentials.from_service_account_file(
                settings.google_sheets_service_account_path,
                scopes=scopes,
            )
            self._client = gspread.authorize(creds)
            logger.info("Google Sheets client initialized.")
            return self._client
        except Exception as e:
            logger.error(f"Sheets client init failed: {e}")
            raise

    def _get_spreadsheet(self):
        """Get or open the configured spreadsheet."""
        if self._spreadsheet is not None:
            return self._spreadsheet

        client = self._get_client()
        self._spreadsheet = client.open_by_key(settings.google_sheets_spreadsheet_id)
        return self._spreadsheet

    def _get_or_create_sheet(self, title: str, headers: list[str]):
        """Get existing worksheet or create with headers."""
        ss = self._get_spreadsheet()
        try:
            ws = ss.worksheet(title)
        except Exception:
            ws = ss.add_worksheet(title=title, rows=1000, cols=len(headers))
            ws.update("A1", [headers])
            logger.info(f"Created worksheet: {title}")
        return ws

    def _row_exists(self, worksheet, report_id: str) -> bool:
        """Check if a report_id already exists in the sheet."""
        try:
            cell = worksheet.find(report_id, in_column=1)
            return cell is not None
        except Exception:
            return False

    async def sync_report(self, report, retries: int = 3) -> dict:
        """
        Sync a single report to Google Sheets.
        Uses exponential backoff on failure.
        Returns sync result.
        """
        for attempt in range(retries):
            try:
                ws = self._get_or_create_sheet(REPORTS_SHEET, REPORTS_HEADERS)

                # Check for duplicate
                if self._row_exists(ws, report.report_id):
                    # Update existing row
                    cell = ws.find(report.report_id, in_column=1)
                    row_data = self._report_to_row(report)
                    ws.update(f"A{cell.row}", [row_data])
                    logger.info(f"Updated report {report.report_id} in Sheets (row {cell.row})")
                    return {"status": "updated", "report_id": report.report_id, "row": cell.row}
                else:
                    # Append new row
                    row_data = self._report_to_row(report)
                    ws.append_row(row_data)
                    logger.info(f"Appended report {report.report_id} to Sheets")
                    return {"status": "created", "report_id": report.report_id}

            except Exception as e:
                wait = 2 ** attempt
                logger.warning(f"Sheets sync attempt {attempt + 1} failed: {e}. Retry in {wait}s")
                if attempt < retries - 1:
                    time.sleep(wait)
                else:
                    logger.error(f"Sheets sync failed after {retries} attempts: {e}")
                    return {"status": "error", "report_id": report.report_id, "error": str(e)}

    async def sync_pending_reports(self, db: Session) -> dict:
        """Sync all unsynced reports to Sheets."""
        from app.models.report import Report

        pending = db.query(Report).filter(Report.sheets_synced == False).all()
        results = {"synced": 0, "errors": 0, "total": len(pending)}

        for report in pending:
            result = await self.sync_report(report)
            if result.get("status") in ("created", "updated"):
                report.sheets_synced = True
                results["synced"] += 1
            else:
                results["errors"] += 1

        db.commit()
        logger.info(f"Sheets sync complete: {results}")
        return results

    def _report_to_row(self, report) -> list:
        """Convert a Report model to a Sheets row."""
        return [
            report.report_id,
            report.created_at.isoformat() if report.created_at else "",
            report.updated_at.isoformat() if report.updated_at else "",
            report.category,
            report.title,
            report.description or "",
            str(report.latitude) if report.latitude else "",
            str(report.longitude) if report.longitude else "",
            str(report.location_accuracy_m) if report.location_accuracy_m else "",
            report.location_source,
            report.observed_at.isoformat() if report.observed_at else "",
            report.image_filename or "",
            report.image_sha256 or "",
            report.evidence_risk or "",
            report.duplicate_status or "",
            report.ai_category or "",
            str(report.priority_score) if report.priority_score else "",
            report.priority_level or "",
            report.status,
            report.assigned_authority or "",
            report.notification_status or "",
        ]

    async def test_connection(self) -> dict:
        """Test Google Sheets API connectivity."""
        try:
            ss = self._get_spreadsheet()
            return {
                "status": "connected",
                "spreadsheet_title": ss.title,
                "sheets": [ws.title for ws in ss.worksheets()],
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}
