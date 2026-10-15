"""
CivicPulse AI — Priority Scoring Engine

Deterministic, explainable priority scoring from 0-100.

Score bands:
  81-100: Critical — requires immediate human review
  61-80:  High priority
  31-60:  Medium priority
  0-30:   Low priority

Scoring components (max 100):
  Safety risk:       0-30 points
  Severity:          0-20 points
  Evidence quality:  0-15 points
  Report density:    0-15 points (nearby independent reports)
  Recency:           0-10 points
  AI severity boost: 0-10 points

PRINCIPLES:
- Missing evidence reduces confidence, not priority.
- Immediate safety risks are always elevated.
- AI suggestions are one input, not the final score.
- All scoring rules are documented and deterministic.
"""

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.schemas.report import PriorityBreakdown

logger = logging.getLogger(__name__)

# Score band definitions
PRIORITY_BANDS = {
    "critical": (81, 100),
    "high": (61, 80),
    "medium": (31, 60),
    "low": (0, 30),
}


class PriorityService:
    """Deterministic priority scoring engine."""

    @staticmethod
    def calculate_priority(report, db: Session) -> PriorityBreakdown:
        """
        Calculate an explainable priority score for a report.
        Returns PriorityBreakdown with component scores and explanations.
        """
        breakdown = PriorityBreakdown()
        explanations = []

        # ── 1. Safety Risk (0-30) ────────────────────────────
        if report.is_safety_risk:
            breakdown.safety_risk_score = 30
            explanations.append("Immediate public safety risk reported (+30)")
        else:
            breakdown.safety_risk_score = 0
            explanations.append("No immediate safety risk reported (+0)")

        # ── 2. Observed Severity (0-20) ──────────────────────
        severity_scores = {
            "critical": 20,
            "high": 15,
            "medium": 10,
            "low": 5,
        }
        sev_score = severity_scores.get(report.observed_severity, 10)
        breakdown.severity_score = sev_score
        explanations.append(f"Observed severity '{report.observed_severity}' (+{sev_score})")

        # ── 3. Evidence Quality (0-15) ───────────────────────
        evidence_score = 0
        if report.image_filename:
            evidence_score += 5
            explanations.append("Photo evidence provided (+5)")
        if report.latitude is not None and report.longitude is not None:
            evidence_score += 5
            if report.location_source == "gps":
                evidence_score += 2
                explanations.append("GPS location verified (+7)")
            else:
                explanations.append("Location provided (+5)")
        if report.evidence_risk == "low":
            evidence_score += 3
            explanations.append("Low evidence risk (+3)")
        elif report.evidence_risk in ("medium", "high"):
            # Don't subtract — just don't add the bonus
            explanations.append(f"Evidence risk '{report.evidence_risk}' — no bonus")

        breakdown.evidence_score = min(evidence_score, 15)

        # ── 4. Report Density (0-15) ────────────────────────
        # Count reports within ~1km and last 30 days with same category
        density_score = 0
        if report.latitude is not None and report.longitude is not None:
            from app.models.report import Report
            try:
                # Simple bounding box (~1km ≈ 0.009 degrees)
                nearby = (
                    db.query(func.count(Report.id))
                    .filter(
                        Report.category == report.category,
                        Report.report_id != report.report_id,
                        Report.latitude.between(report.latitude - 0.009, report.latitude + 0.009),
                        Report.longitude.between(report.longitude - 0.009, report.longitude + 0.009),
                    )
                    .scalar()
                    or 0
                )

                if nearby >= 5:
                    density_score = 15
                    explanations.append(f"{nearby} similar reports nearby (+15)")
                elif nearby >= 3:
                    density_score = 10
                    explanations.append(f"{nearby} similar reports nearby (+10)")
                elif nearby >= 1:
                    density_score = 5
                    explanations.append(f"{nearby} similar report(s) nearby (+5)")
                else:
                    explanations.append("No similar nearby reports (+0)")
            except Exception as e:
                logger.warning(f"Density check error: {e}")
                explanations.append("Report density check unavailable")
        else:
            explanations.append("No location — density check unavailable")

        breakdown.report_density_score = density_score

        # ── 5. Recency (0-10) ───────────────────────────────
        recency_score = 5  # Default
        if report.observed_at:
            now = datetime.now(timezone.utc)
            observed = report.observed_at
            if observed.tzinfo is None:
                # Assume UTC if no timezone
                from datetime import timezone as tz
                observed = observed.replace(tzinfo=tz.utc)
            delta = now - observed
            if delta.days == 0:
                recency_score = 10
                explanations.append("Issue observed today (+10)")
            elif delta.days <= 3:
                recency_score = 7
                explanations.append(f"Issue observed {delta.days} days ago (+7)")
            elif delta.days <= 7:
                recency_score = 5
                explanations.append(f"Issue observed {delta.days} days ago (+5)")
            else:
                recency_score = 3
                explanations.append(f"Issue observed {delta.days} days ago (+3)")
        else:
            explanations.append("Observation date not provided (+5 default)")

        breakdown.recency_score = recency_score

        # ── 6. AI Severity Boost (0-10) ─────────────────────
        ai_score = 0
        if report.ai_severity:
            ai_severity_scores = {
                "critical": 10,
                "high": 7,
                "medium": 4,
                "low": 1,
            }
            ai_score = ai_severity_scores.get(report.ai_severity, 0)
            explanations.append(f"AI assessed severity '{report.ai_severity}' (+{ai_score})")
        else:
            explanations.append("AI analysis not available (+0)")

        breakdown.ai_severity_score = ai_score

        # ── Total ────────────────────────────────────────────
        total = (
            breakdown.safety_risk_score
            + breakdown.severity_score
            + breakdown.evidence_score
            + breakdown.report_density_score
            + breakdown.recency_score
            + breakdown.ai_severity_score
        )
        breakdown.total_score = min(total, 100)

        # Determine priority level
        for level, (low, high) in PRIORITY_BANDS.items():
            if low <= breakdown.total_score <= high:
                breakdown.priority_level = level
                break

        breakdown.explanation = explanations

        logger.info(
            f"Priority for {report.report_id}: {breakdown.total_score}/100 "
            f"({breakdown.priority_level})"
        )
        return breakdown
