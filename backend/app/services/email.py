"""
CivicPulse AI — Email Notification Service (Optional)

Uses Resend API for transactional emails.
Gracefully degrades when not configured.
"""

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Optional email notification service using Resend."""

    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is not None:
            return self._client

        if not settings.email_configured:
            logger.debug("Email not configured — notifications will be logged only.")
            return None

        try:
            import resend
            resend.api_key = settings.resend_api_key
            self._client = resend
            return self._client
        except Exception as e:
            logger.error(f"Resend client init failed: {e}")
            return None

    async def send_report_confirmation(
        self,
        to_email: str,
        report_id: str,
        title: str,
        category: str,
    ) -> dict:
        """Send report submission confirmation."""
        client = self._get_client()
        if not client:
            logger.info(f"[EMAIL-SKIP] Confirmation for {report_id} — email not configured")
            return {"status": "skipped", "reason": "email_not_configured"}

        try:
            html = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #000;">CivicPulse AI — Report Submitted</h2>
                <p>Your civic issue report has been submitted successfully.</p>
                <table style="border-collapse: collapse; width: 100%;">
                    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reference ID</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{report_id}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Title</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{title}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Category</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{category}</td></tr>
                </table>
                <p style="color: #666; font-size: 12px; margin-top: 20px;">
                    This report is stored in CivicPulse AI. You can track its status using the reference ID above.
                </p>
            </div>
            """

            result = client.Emails.send({
                "from": settings.resend_from_email,
                "to": [to_email],
                "subject": f"CivicPulse AI — Report {report_id} Submitted",
                "html": html,
            })

            logger.info(f"Confirmation email sent for {report_id}")
            return {"status": "sent", "id": result.get("id")}

        except Exception as e:
            logger.error(f"Email send failed for {report_id}: {e}")
            return {"status": "error", "error": str(e)}

    async def send_admin_alert(
        self,
        report_id: str,
        title: str,
        priority_level: str,
        evidence_risk: str,
    ) -> dict:
        """Send high-priority alert to admin."""
        if not settings.admin_notification_email:
            return {"status": "skipped", "reason": "no_admin_email"}

        client = self._get_client()
        if not client:
            return {"status": "skipped", "reason": "email_not_configured"}

        try:
            html = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #000;">⚠ High Priority Report</h2>
                <p><strong>Report:</strong> {report_id}</p>
                <p><strong>Title:</strong> {title}</p>
                <p><strong>Priority:</strong> {priority_level}</p>
                <p><strong>Evidence Risk:</strong> {evidence_risk}</p>
                <p>Please review this report in the admin dashboard.</p>
            </div>
            """

            result = client.Emails.send({
                "from": settings.resend_from_email,
                "to": [settings.admin_notification_email],
                "subject": f"[CivicPulse] High Priority Report: {report_id}",
                "html": html,
            })

            return {"status": "sent", "id": result.get("id")}
        except Exception as e:
            logger.error(f"Admin alert failed: {e}")
            return {"status": "error", "error": str(e)}
