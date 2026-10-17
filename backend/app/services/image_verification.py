"""
CivicPulse AI — AI-Powered Image Verification Service

Implements fast, reliable AI image verification for municipal complaints:
1. File validation: MIME type, magic bytes, file size, image dimensions.
2. Deduplication & Caching: SHA-256 fingerprinting to prevent redundant AI API calls.
3. Multimodal Analysis: Google Gemini Flash-Lite structured JSON verification.
4. Deterministic Thresholding: Configurable high (0.80) & medium (0.50) confidence gates.
5. Server-side Enforcement: HMAC-signed verification tokens to prevent client bypass.
"""

import hashlib
import hmac
import io
import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import UploadFile
from PIL import Image

from app.core.config import settings
from app.schemas.report import CATEGORY_LABELS, VALID_CATEGORIES
from app.services.gemini import GeminiService

logger = logging.getLogger(__name__)

# Allowed MIME types and corresponding file signatures (magic bytes)
ALLOWED_MIME_TYPES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],
}

# Mapping between AI-detected category keywords and canonical system categories
AI_CATEGORY_MAP = {
    # Potholes and damaged roads
    "pothole": "pothole_damaged_road",
    "damaged_road": "pothole_damaged_road",
    "pothole_damaged_road": "pothole_damaged_road",
    "road_damage": "pothole_damaged_road",
    "road_depression": "pothole_damaged_road",
    "asphalt_damage": "pothole_damaged_road",

    # Overflowing garbage & public waste dumping
    "overflowing_garbage": "garbage_dumping",
    "public_waste_dumping": "garbage_dumping",
    "garbage_dumping": "garbage_dumping",
    "garbage": "garbage_dumping",
    "waste_dumping": "garbage_dumping",
    "trash": "garbage_dumping",
    "litter": "garbage_dumping",
    "waste": "garbage_dumping",

    # Blocked drains & drainage overflow
    "blocked_drain": "drainage_overflow",
    "drainage_overflow": "drainage_overflow",
    "drain_blockage": "drainage_overflow",
    "drainage": "drainage_overflow",
    "culvert_blockage": "drainage_overflow",

    # Sewage leakage & wastewater overflow
    "sewage_leakage": "sewage_leakage",
    "sewage": "sewage_leakage",
    "wastewater_overflow": "sewage_leakage",
    "sewage_overflow": "sewage_leakage",

    # Road waterlogging & flooding
    "waterlogging": "waterlogging",
    "road_waterlogging": "waterlogging",
    "flooding": "waterlogging",
    "stagnant_water": "waterlogging",

    # Broken manhole covers & damaged public infrastructure
    "broken_manhole_cover": "damaged_infrastructure",
    "manhole": "damaged_infrastructure",
    "damaged_infrastructure": "damaged_infrastructure",
    "damaged_public_infrastructure": "damaged_infrastructure",
    "infrastructure": "damaged_infrastructure",
    "collapsed_wall": "damaged_infrastructure",
    "broken_railing": "damaged_infrastructure",

    # Damaged streetlights & electrical hazards
    "broken_streetlight": "broken_streetlight",
    "damaged_streetlights": "broken_streetlight",
    "damaged_streetlight": "broken_streetlight",
    "streetlight": "broken_streetlight",
    "street_light": "broken_streetlight",
    "electrical_hazard": "broken_streetlight",

    # Other municipal issues
    "other": "other",
    "other_municipal_issue": "other",
    "municipal_issue": "other",
}

# Standard user-facing messages conforming to specifications
MESSAGES = {
    "analysing": "AI is analysing your image. Please wait...",
    "accepted": "Municipal issue detected. Your image passed preliminary verification.",
    "irrelevant": "Your image does not appear to show a municipal problem. Please upload a photo of a pothole, blocked drain, overflowing garbage or another municipal issue.",
    "unclear": "Your image is not providing enough information to identify a municipal issue. Please upload a clearer photo showing the problem.",
    "api_failure": "AI image verification is temporarily unavailable. You may still submit your report, but it will be flagged for manual review.",
    "corrupted": "The uploaded file could not be read or is corrupted. Please upload a valid image (JPEG, PNG, or WebP).",
    "too_large": "The image file exceeds the maximum allowed size (10MB).",
    "too_small": "The image dimensions are too small to reliably verify. Please upload a full-resolution photo (min 100x100 px).",
}

# In-memory SHA-256 verification cache: {sha256: {"data": dict, "timestamp": float}}
_VERIFICATION_CACHE: dict[str, dict] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour cache


def map_ai_category_to_canonical(category_str: str) -> Tuple[str, str]:
    """
    Map an AI-detected issue category string to a canonical system category
    and human-readable label.
    """
    cleaned = category_str.lower().strip().replace("-", "_").replace(" ", "_")
    canonical = AI_CATEGORY_MAP.get(cleaned, "other")
    if canonical not in VALID_CATEGORIES:
        canonical = "other"
    label = CATEGORY_LABELS.get(canonical, "Municipal Maintenance Issue")
    return canonical, label


def generate_verification_token(
    sha256: str,
    status: str,
    category: str,
    confidence: float,
    timestamp: Optional[int] = None,
) -> str:
    """Generate an HMAC-SHA256 signed verification token."""
    ts = timestamp or int(time.time())
    msg = f"{sha256}:{status}:{category}:{confidence:.3f}:{ts}".encode("utf-8")
    sig = hmac.new(settings.app_secret_key.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return f"{sig}.{ts}"


def verify_token_signature(
    token: str,
    sha256: str,
    status: str,
    category: str,
    confidence: float,
    max_age_seconds: int = 7200,
) -> bool:
    """Validate that a verification token has a valid HMAC signature and has not expired."""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return False
        sig, ts_str = parts
        ts = int(ts_str)
        if time.time() - ts > max_age_seconds:
            return False  # Expired

        expected_msg = f"{sha256}:{status}:{category}:{confidence:.3f}:{ts}".encode("utf-8")
        expected_sig = hmac.new(settings.app_secret_key.encode("utf-8"), expected_msg, hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected_sig)
    except Exception:
        return False


class ImageVerificationService:
    """High-level verification engine for municipal issue images."""

    def __init__(self):
        self.gemini = GeminiService()

    def validate_image_bytes(self, content: bytes, mime_type: Optional[str] = None) -> Tuple[bool, Optional[str], Optional[Image.Image]]:
        """
        Validate image content: size, magic bytes, MIME type, PIL decodability, and dimensions.
        Returns: (is_valid, error_message, PIL.Image object)
        """
        # 1. Size check
        if len(content) > settings.max_upload_bytes:
            return False, MESSAGES["too_large"], None
        if len(content) < 100:
            return False, MESSAGES["corrupted"], None

        # 2. Magic bytes check
        matches_magic = False
        for expected_mime, signatures in ALLOWED_MIME_TYPES.items():
            for sig in signatures:
                if content.startswith(sig):
                    matches_magic = True
                    break
            if matches_magic:
                break

        if not matches_magic:
            return False, "Invalid image format. Supported formats: JPEG, PNG, WebP.", None

        # 3. PIL image decoding
        try:
            img = Image.open(io.BytesIO(content))
            img.verify()  # Verify integrity
            # Reopen after verify() since verify() closes image state
            img = Image.open(io.BytesIO(content))
        except Exception as e:
            logger.warning(f"Failed to decode image bytes with PIL: {e}")
            return False, MESSAGES["corrupted"], None

        # 4. Dimension check
        if img.width < 100 or img.height < 100:
            return False, MESSAGES["too_small"], None

        return True, None, img

    async def verify_image_bytes(
        self,
        content: bytes,
        filename: str = "upload.jpg",
        content_type: str = "image/jpeg",
    ) -> dict:
        """
        Perform complete AI-powered verification on image bytes.
        Returns a structured dictionary with verification results and token.
        """
        sha256 = hashlib.sha256(content).hexdigest()

        # Check in-memory cache to avoid duplicate AI API calls
        now = time.time()
        if sha256 in _VERIFICATION_CACHE:
            cached = _VERIFICATION_CACHE[sha256]
            if now - cached["timestamp"] < CACHE_TTL_SECONDS:
                logger.info(f"Returning cached image verification for SHA-256: {sha256[:10]}...")
                return cached["data"]

        # Validate image file structure
        is_valid, err_msg, pil_img = self.validate_image_bytes(content, content_type)
        if not is_valid:
            result = {
                "is_municipal_issue": False,
                "issue_category": "unknown",
                "canonical_category": "other",
                "category_label": "Unknown",
                "confidence": 0.0,
                "image_quality": "corrupted",
                "severity": "unknown",
                "evidence": "",
                "reason": err_msg or MESSAGES["corrupted"],
                "user_message": err_msg or MESSAGES["corrupted"],
                "verification_status": "corrupted",
                "can_submit": False,
                "image_sha256": sha256,
                "verification_token": "",
                "verified_at": datetime.now(timezone.utc).isoformat(),
            }
            return result

        # Call Gemini Vision Flash-Lite
        ai_resp = await self.gemini.verify_municipal_issue(pil_img)

        # Check for service error or timeout — allow submission but flag for manual review
        if ai_resp.get("raw_error") or ai_resp.get("image_quality") == "unknown":
            logger.warning(f"Gemini service error for image SHA-256 {sha256[:10]}...: {ai_resp.get('raw_error', 'unknown error')}")
            result = {
                "is_municipal_issue": False,
                "issue_category": "unknown",
                "canonical_category": "other",
                "category_label": "Verification Unavailable",
                "confidence": 0.0,
                "image_quality": "unknown",
                "severity": "unknown",
                "evidence": "",
                "reason": ai_resp.get("reason", "AI service unavailable"),
                "user_message": MESSAGES["api_failure"],
                "verification_status": "service_unavailable",
                "can_submit": True,
                "image_sha256": sha256,
                "verification_token": "",
                "verified_at": datetime.now(timezone.utc).isoformat(),
            }
            # Do NOT cache service errors — allow retry on next attempt
            return result

        is_issue = ai_resp.get("is_municipal_issue", False)
        raw_cat = ai_resp.get("issue_category", "unknown")
        confidence = float(ai_resp.get("confidence", 0.0))
        image_quality = ai_resp.get("image_quality", "good")
        severity = ai_resp.get("severity", "unknown")
        evidence = ai_resp.get("evidence", "")
        reason = ai_resp.get("reason", "")
        canonical_category, category_label = map_ai_category_to_canonical(raw_cat)

        high_thresh = settings.image_verification_confidence_threshold
        med_thresh = settings.image_verification_medium_threshold

        # Determine verification status
        if not is_issue or raw_cat in ("unknown", "none", ""):
            # Low confidence or irrelevant image (e.g. selfie, food, normal scenery)
            v_status = "rejected_irrelevant"
            can_submit = False
            user_msg = MESSAGES["irrelevant"]
        elif image_quality in ("poor", "blurry", "dark", "unreadable", "heavily_blurred"):
            # Unclear or poorly captured image
            v_status = "unclear"
            can_submit = False
            user_msg = MESSAGES["unclear"]
        elif confidence >= high_thresh and is_issue:
            # High confidence municipal issue
            v_status = "accepted"
            can_submit = True
            user_msg = MESSAGES["accepted"]
        elif confidence >= med_thresh:
            # Medium confidence — ask for clearer/closer photo
            v_status = "unclear"
            can_submit = False
            user_msg = MESSAGES["unclear"]
        else:
            # Low confidence
            v_status = "rejected_irrelevant"
            can_submit = False
            user_msg = MESSAGES["irrelevant"]

        # Generate HMAC token for accepted submissions
        token = ""
        if can_submit and v_status == "accepted":
            token = generate_verification_token(
                sha256=sha256,
                status=v_status,
                category=canonical_category,
                confidence=confidence,
            )

        result = {
            "is_municipal_issue": is_issue,
            "issue_category": raw_cat,
            "canonical_category": canonical_category,
            "category_label": category_label,
            "confidence": round(confidence, 3),
            "image_quality": image_quality,
            "severity": severity,
            "evidence": evidence,
            "reason": reason,
            "user_message": user_msg,
            "verification_status": v_status,
            "can_submit": can_submit,
            "image_sha256": sha256,
            "verification_token": token,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }

        # Cache result
        _VERIFICATION_CACHE[sha256] = {"data": result, "timestamp": now}
        return result

    async def verify_upload_file(self, file: UploadFile) -> dict:
        """Helper to verify an incoming FastAPI UploadFile."""
        content = await file.read()
        await file.seek(0)
        return await self.verify_image_bytes(
            content=content,
            filename=file.filename or "upload.jpg",
            content_type=file.content_type or "image/jpeg",
        )

    def is_image_verified_and_accepted(
        self,
        sha256: str,
        verification_token: Optional[str] = None,
    ) -> Tuple[bool, Optional[dict]]:
        """
        Check if an image hash has been successfully verified and accepted.
        Checks in-memory cache and/or verifies the cryptographically signed token.
        """
        # 1. Check in-memory verification cache
        if sha256 in _VERIFICATION_CACHE:
            cached = _VERIFICATION_CACHE[sha256]
            if time.time() - cached["timestamp"] < CACHE_TTL_SECONDS:
                data = cached["data"]
                if data.get("verification_status") == "accepted" and data.get("can_submit") is True:
                    return True, data

        # 2. Check verification token if provided
        if verification_token:
            # Attempt to decode token and verify HMAC
            try:
                parts = verification_token.split(".")
                if len(parts) == 2:
                    ts = int(parts[1])
                    if time.time() - ts <= 7200:  # 2 hours
                        # If cached data is available, verify token against it
                        if sha256 in _VERIFICATION_CACHE:
                            data = _VERIFICATION_CACHE[sha256]["data"]
                            if verify_token_signature(
                                token=verification_token,
                                sha256=sha256,
                                status=data["verification_status"],
                                category=data["canonical_category"],
                                confidence=data["confidence"],
                            ):
                                return True, data
            except Exception:
                pass

        return False, None
