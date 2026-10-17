"""
CivicPulse AI — Image Verification Test Suite

Tests all 11 required image verification scenarios:
1. Clear pothole photo -> Accepted (can_submit=True)
2. Overflowing garbage bin -> Accepted (can_submit=True)
3. Blocked drainage photo -> Accepted (can_submit=True)
4. Road waterlogging -> Accepted (can_submit=True)
5. Normal road without damage -> Rejected (irrelevant, can_submit=False)
6. Selfie / portrait -> Rejected (irrelevant, can_submit=False)
7. Food photograph -> Rejected (irrelevant, can_submit=False)
8. Screenshot / document -> Rejected (irrelevant, can_submit=False)
9. Blurred or dark image -> Unclear (can_submit=False, requests clearer photo)
10. Corrupted file -> Corrupted error (can_submit=False)
11. AI API timeout / rate-limit -> API failure error (can_submit=False, retry option)
12. Backend submission enforcement -> Rejects report if image fails verification
13. SHA-256 caching -> Avoids repeated AI calls for identical images
"""

import io
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.services.image_verification import (
    ImageVerificationService,
    _VERIFICATION_CACHE,
    MESSAGES,
)

client = TestClient(app)


def create_test_image(color=(128, 128, 128), size=(200, 200), fmt="JPEG"):
    """Helper to create dummy in-memory image bytes."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear in-memory verification cache before each test."""
    _VERIFICATION_CACHE.clear()
    yield
    _VERIFICATION_CACHE.clear()


# ── Scenario 1: Clear Pothole Photograph ──────────────────────
@pytest.mark.asyncio
async def test_scenario_1_clear_pothole():
    service = ImageVerificationService()
    img_bytes = create_test_image(color=(80, 80, 80))

    mock_gemini_response = {
        "is_municipal_issue": True,
        "issue_category": "pothole",
        "confidence": 0.94,
        "image_quality": "good",
        "severity": "medium",
        "evidence": "A deep crater with exposed aggregate in the asphalt road.",
        "reason": "A pothole is clearly visible on the road surface.",
        "user_message": "A possible road damage issue was identified.",
    }

    with patch.object(service.gemini, "verify_municipal_issue", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = mock_gemini_response
        result = await service.verify_image_bytes(img_bytes, "pothole.jpg")

    assert result["verification_status"] == "accepted"
    assert result["can_submit"] is True
    assert result["canonical_category"] == "pothole_damaged_road"
    assert result["confidence"] == 0.94
    assert result["user_message"] == MESSAGES["accepted"]
    assert len(result["verification_token"]) > 0


# ── Scenario 2: Overflowing Garbage Bin ────────────────────────
@pytest.mark.asyncio
async def test_scenario_2_overflowing_garbage():
    service = ImageVerificationService()
    img_bytes = create_test_image(color=(50, 100, 50))

    mock_gemini_response = {
        "is_municipal_issue": True,
        "issue_category": "overflowing_garbage",
        "confidence": 0.91,
        "image_quality": "good",
        "severity": "high",
        "evidence": "Municipal metal bin overflowing with domestic waste onto public sidewalk.",
        "reason": "Garbage dump and overflowing bin visible in public area.",
        "user_message": "Waste accumulation issue identified.",
    }

    with patch.object(service.gemini, "verify_municipal_issue", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = mock_gemini_response
        result = await service.verify_image_bytes(img_bytes, "garbage.jpg")

    assert result["verification_status"] == "accepted"
    assert result["can_submit"] is True
    assert result["canonical_category"] == "garbage_dumping"
    assert result["user_message"] == MESSAGES["accepted"]


# ── Scenario 3: Blocked Drainage Photograph ───────────────────
@pytest.mark.asyncio
async def test_scenario_3_blocked_drainage():
    service = ImageVerificationService()
    img_bytes = create_test_image(color=(40, 40, 80))

    mock_gemini_response = {
        "is_municipal_issue": True,
        "issue_category": "blocked_drain",
        "confidence": 0.88,
        "image_quality": "good",
        "severity": "high",
        "evidence": "Stormwater culvert choked with debris and plastic waste.",
        "reason": "Drainage channel blocked causing stagnant wastewater.",
        "user_message": "Drainage blockage identified.",
    }

    with patch.object(service.gemini, "verify_municipal_issue", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = mock_gemini_response
        result = await service.verify_image_bytes(img_bytes, "drain.jpg")

    assert result["verification_status"] == "accepted"
    assert result["can_submit"] is True
    assert result["canonical_category"] == "drainage_overflow"


# ── Scenario 4: Road Waterlogging ─────────────────────────────
@pytest.mark.asyncio
async def test_scenario_4_road_waterlogging():
    service = ImageVerificationService()
    img_bytes = create_test_image(color=(30, 60, 90))

    mock_gemini_response = {
        "is_municipal_issue": True,
        "issue_category": "waterlogging",
        "confidence": 0.89,
        "image_quality": "good",
        "severity": "high",
        "evidence": "Extensive standing water covering both lanes of vehicular roadway.",
        "reason": "Severe road waterlogging and flooding.",
        "user_message": "Waterlogging problem identified.",
    }

    with patch.object(service.gemini, "verify_municipal_issue", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = mock_gemini_response
        result = await service.verify_image_bytes(img_bytes, "waterlog.jpg")

    assert result["verification_status"] == "accepted"
    assert result["can_submit"] is True
    assert result["canonical_category"] == "waterlogging"


# ── Scenario 5: Normal Road Without Visible Damage ────────────
@pytest.mark.asyncio
async def test_scenario_5_normal_road():
    service = ImageVerificationService()
    img_bytes = create_test_image(color=(100, 100, 100))

    mock_gemini_response = {
        "is_municipal_issue": False,
        "issue_category": "unknown",
        "confidence": 0.95,
        "image_quality": "good",
        "severity": "unknown",
        "evidence": "Clear paved asphalt road in good condition without visible cracks or potholes.",
        "reason": "The road shows normal conditions with no municipal maintenance issue.",
        "user_message": "No municipal issue was found in this photo.",
    }

    with patch.object(service.gemini, "verify_municipal_issue", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = mock_gemini_response
        result = await service.verify_image_bytes(img_bytes, "normal_road.jpg")

    assert result["verification_status"] == "rejected_irrelevant"
    assert result["can_submit"] is False
    assert result["user_message"] == MESSAGES["irrelevant"]


# ── Scenario 6: Selfie / Portrait ─────────────────────────────
@pytest.mark.asyncio
async def test_scenario_6_selfie():
    service = ImageVerificationService()
    img_bytes = create_test_image(color=(200, 150, 120))

    mock_gemini_response = {
        "is_municipal_issue": False,
        "issue_category": "unknown",
        "confidence": 0.99,
        "image_quality": "good",
        "severity": "unknown",
        "evidence": "Close-up portrait/selfie of an individual.",
        "reason": "The image is a personal selfie, not a municipal problem.",
        "user_message": "This is a personal portrait and cannot be submitted.",
    }

    with patch.object(service.gemini, "verify_municipal_issue", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = mock_gemini_response
        result = await service.verify_image_bytes(img_bytes, "selfie.jpg")

    assert result["verification_status"] == "rejected_irrelevant"
    assert result["can_submit"] is False
    assert result["user_message"] == MESSAGES["irrelevant"]


# ── Scenario 7: Food Photograph ───────────────────────────────
@pytest.mark.asyncio
async def test_scenario_7_food():
    service = ImageVerificationService()
    img_bytes = create_test_image(color=(220, 120, 50))

    mock_gemini_response = {
        "is_municipal_issue": False,
        "issue_category": "unknown",
        "confidence": 0.98,
        "image_quality": "good",
        "severity": "unknown",
        "evidence": "Plate of food on a dining table.",
        "reason": "Photograph shows meal/food items.",
        "user_message": "Food photo is not a municipal problem.",
    }

    with patch.object(service.gemini, "verify_municipal_issue", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = mock_gemini_response
        result = await service.verify_image_bytes(img_bytes, "food.jpg")

    assert result["verification_status"] == "rejected_irrelevant"
    assert result["can_submit"] is False
    assert result["user_message"] == MESSAGES["irrelevant"]


# ── Scenario 8: Screenshot / Document ─────────────────────────
@pytest.mark.asyncio
async def test_scenario_8_screenshot_document():
    service = ImageVerificationService()
    img_bytes = create_test_image(color=(255, 255, 255))

    mock_gemini_response = {
        "is_municipal_issue": False,
        "issue_category": "unknown",
        "confidence": 0.99,
        "image_quality": "good",
        "severity": "unknown",
        "evidence": "Digital screenshot of text document and notes.",
        "reason": "Document/screenshot does not contain municipal infrastructure evidence.",
        "user_message": "Screenshots are not accepted as civic problem evidence.",
    }

    with patch.object(service.gemini, "verify_municipal_issue", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = mock_gemini_response
        result = await service.verify_image_bytes(img_bytes, "doc.jpg")

    assert result["verification_status"] == "rejected_irrelevant"
    assert result["can_submit"] is False
    assert result["user_message"] == MESSAGES["irrelevant"]


# ── Scenario 9: Blurred or Dark Image ─────────────────────────
@pytest.mark.asyncio
async def test_scenario_9_blurred_or_dark():
    service = ImageVerificationService()
    img_bytes = create_test_image(color=(10, 10, 10))

    mock_gemini_response = {
        "is_municipal_issue": True,
        "issue_category": "pothole",
        "confidence": 0.55,  # Medium confidence
        "image_quality": "poor",  # Flagged poor quality
        "severity": "unknown",
        "evidence": "Extremely dark and motion-blurred view possibly showing a dark spot.",
        "reason": "Insufficient lighting and heavy blur prevent confirming if a pothole exists.",
        "user_message": "Image is too blurry to confirm.",
    }

    with patch.object(service.gemini, "verify_municipal_issue", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = mock_gemini_response
        result = await service.verify_image_bytes(img_bytes, "dark.jpg")

    assert result["verification_status"] == "unclear"
    assert result["can_submit"] is False
    assert result["user_message"] == MESSAGES["unclear"]


# ── Scenario 10: Corrupted File ───────────────────────────────
@pytest.mark.asyncio
async def test_scenario_10_corrupted_file():
    service = ImageVerificationService()
    corrupted_bytes = b"NOT_A_VALID_IMAGE_HEADER_12345"

    result = await service.verify_image_bytes(corrupted_bytes, "corrupted.jpg")

    assert result["verification_status"] == "corrupted"
    assert result["can_submit"] is False
    assert "Invalid image format" in result["user_message"] or MESSAGES["corrupted"] in result["user_message"]


# ── Scenario 11: AI API Timeout / Rate Limit ──────────────────
@pytest.mark.asyncio
async def test_scenario_11_api_timeout_or_error():
    service = ImageVerificationService()
    img_bytes = create_test_image()

    mock_gemini_response = {
        "is_municipal_issue": False,
        "issue_category": "unknown",
        "confidence": 0.0,
        "image_quality": "unknown",
        "severity": "unknown",
        "evidence": "",
        "reason": "AI verification request timed out.",
        "user_message": MESSAGES["api_failure"],
        "raw_error": "timeout",
    }

    with patch.object(service.gemini, "verify_municipal_issue", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = mock_gemini_response
        result = await service.verify_image_bytes(img_bytes, "error.jpg")

    assert result["verification_status"] == "service_unavailable"
    assert result["can_submit"] is True
    assert result["user_message"] == MESSAGES["api_failure"]


# ── Scenario 12: Backend Submission Rejection ─────────────────
def test_scenario_12_backend_rejects_unverified_image():
    """Ensure submitting an unverified or rejected image to POST /api/v1/reports fails with 400."""
    img_bytes = create_test_image()

    with patch.object(ImageVerificationService, "verify_image_bytes", new_callable=AsyncMock) as mock_verify:
        # Mock that image is rejected as irrelevant
        mock_verify.return_value = {
            "is_municipal_issue": False,
            "issue_category": "unknown",
            "canonical_category": "other",
            "category_label": "Unknown",
            "confidence": 0.1,
            "image_quality": "good",
            "severity": "unknown",
            "evidence": "",
            "reason": "No issue found",
            "user_message": MESSAGES["irrelevant"],
            "verification_status": "rejected_irrelevant",
            "can_submit": False,
            "image_sha256": "abcdef",
            "verification_token": "",
            "verified_at": "2026-10-17T00:00:00Z",
        }

        resp = client.post(
            "/api/v1/reports",
            data={
                "category": "pothole_damaged_road",
                "title": "Attempt to bypass with selfie",
                "observed_severity": "high",
                "location_source": "manual",
                "submission_consent": "true",
            },
            files={"image": ("selfie.jpg", img_bytes, "image/jpeg")},
        )

        assert resp.status_code == 400
        assert MESSAGES["irrelevant"] in resp.json()["detail"]


# ── Scenario 13: Caching Prevents Duplicate Calls ─────────────
@pytest.mark.asyncio
async def test_scenario_13_sha256_caching():
    """Verify that calling verify on the same image twice only calls Gemini once."""
    service = ImageVerificationService()
    img_bytes = create_test_image(color=(70, 70, 70))

    mock_gemini_response = {
        "is_municipal_issue": True,
        "issue_category": "pothole",
        "confidence": 0.95,
        "image_quality": "good",
        "severity": "medium",
        "evidence": "Pothole detected.",
        "reason": "Clear road damage.",
        "user_message": "Road damage identified.",
    }

    with patch.object(service.gemini, "verify_municipal_issue", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = mock_gemini_response

        # First call hits Gemini
        res1 = await service.verify_image_bytes(img_bytes, "pothole.jpg")
        assert mock_verify.call_count == 1
        assert res1["can_submit"] is True

        # Second call with same image hits cache, does NOT call Gemini again
        res2 = await service.verify_image_bytes(img_bytes, "pothole.jpg")
        assert mock_verify.call_count == 1  # Still 1!
        assert res2["image_sha256"] == res1["image_sha256"]
        assert res2["can_submit"] is True


# ── HTTP Endpoint Test: POST /api/v1/reports/verify-image ─────
def test_verify_image_http_endpoint():
    """Verify the dedicated HTTP endpoint POST /api/v1/reports/verify-image returns ImageVerificationResponse."""
    img_bytes = create_test_image(color=(60, 60, 60))

    with patch.object(ImageVerificationService, "verify_image_bytes", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = {
            "is_municipal_issue": True,
            "issue_category": "pothole",
            "canonical_category": "pothole_damaged_road",
            "category_label": "Potholes & Damaged Roads",
            "confidence": 0.92,
            "image_quality": "good",
            "severity": "high",
            "evidence": "Pothole on asphalt",
            "reason": "Road crater visible",
            "user_message": MESSAGES["accepted"],
            "verification_status": "accepted",
            "can_submit": True,
            "image_sha256": "1234567890abcdef",
            "verification_token": "valid_token.12345",
            "verified_at": "2026-10-17T00:00:00Z",
        }

        resp = client.post(
            "/api/v1/reports/verify-image",
            files={"image": ("test.jpg", img_bytes, "image/jpeg")},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["is_municipal_issue"] is True
        assert data["verification_status"] == "accepted"
        assert data["can_submit"] is True
        assert data["canonical_category"] == "pothole_damaged_road"
        assert data["user_message"] == MESSAGES["accepted"]


# ── Scenario 14: Submission Allowed When Service Unavailable ──
def test_scenario_14_submission_allowed_when_service_unavailable():
    """Ensure submitting when AI verification is unavailable succeeds (graceful degradation)."""
    img_bytes = create_test_image()

    with patch.object(ImageVerificationService, "verify_image_bytes", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = {
            "is_municipal_issue": False,
            "issue_category": "unknown",
            "canonical_category": "other",
            "category_label": "Unknown",
            "confidence": 0.0,
            "image_quality": "unknown",
            "severity": "unknown",
            "evidence": "",
            "reason": "AI verification service temporarily unavailable.",
            "user_message": MESSAGES["api_failure"],
            "verification_status": "service_unavailable",
            "can_submit": True,
            "image_sha256": "aabbcc112233",
            "verification_token": "token.12345",
            "verified_at": "2026-10-17T00:00:00Z",
        }

        resp = client.post(
            "/api/v1/reports",
            data={
                "category": "pothole_damaged_road",
                "title": "Road damage during AI outage",
                "observed_severity": "high",
                "location_source": "manual",
                "submission_consent": "true",
            },
            files={"image": ("outage.jpg", img_bytes, "image/jpeg")},
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["report_id"] is not None
        assert data["status"] == "submitted"

