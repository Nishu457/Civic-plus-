"""
CivicPulse AI — Gemini AI Image Analysis Service

Uses Google Gemini to analyse civic issue photos and return
structured classification data.

DESIGN PRINCIPLES:
- AI provides an assessment, not a verdict.
- We request structured JSON from Gemini.
- We validate the response against expected schemas.
- We never claim the model can detect AI-generated images conclusively.
- Timeouts and error handling are mandatory.
"""

import json
import logging
from pathlib import Path
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """You are an AI assistant for CivicPulse AI, a civic issue reporting platform in India.

Analyse this photo and return a JSON object with the following fields:

{
  "category": "The most likely civic issue category from this list: drainage_overflow, garbage_dumping, pothole_damaged_road, waterlogging, broken_streetlight, damaged_infrastructure, sewage_leakage, other",
  "description": "A brief factual description of what is visible in the image (2-3 sentences max)",
  "severity": "Estimated severity based on visual evidence: low, medium, high, or critical",
  "confidence": "How confident you are in this classification: low, medium, or high",
  "relevant_to_category": true or false — whether the image appears relevant to the user-selected category "{user_category}",
  "visible_indicators": ["list", "of", "specific", "visible", "problems"],
  "requires_human_review": true or false — whether anything about the image warrants human review,
  "review_reason": "If requires_human_review is true, explain why briefly"
}

IMPORTANT RULES:
- Base your analysis ONLY on what is visually present in the image.
- Do NOT invent details not visible in the photo.
- If the image is unclear, blurry, or does not clearly show a civic issue, set confidence to "low".
- If the image appears to be a non-civic subject (selfie, document, etc.), set relevant_to_category to false.
- Return ONLY the JSON object, no markdown formatting or extra text.
"""


class GeminiService:
    """Google Gemini AI image analysis service."""

    def __init__(self):
        self._model = None

    def _get_model(self):
        """Lazy-initialize the Gemini model."""
        if self._model is not None:
            return self._model

        if not settings.gemini_configured:
            raise RuntimeError("Gemini API key not configured. Set GEMINI_API_KEY in .env")

        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.gemini_api_key)
            self._model = genai.GenerativeModel(settings.gemini_model)
            logger.info(f"Gemini model initialized: {settings.gemini_model}")
            return self._model
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")
            raise

    async def analyze_image(
        self,
        image_path: str,
        user_category: str = "other",
    ) -> Optional[dict]:
        """
        Analyse a civic issue image using Gemini.
        Returns structured analysis dict or None on failure.
        """
        try:
            model = self._get_model()

            # Load image
            from PIL import Image
            img = Image.open(image_path)

            # Build prompt with user's selected category
            prompt = ANALYSIS_PROMPT.replace("{user_category}", user_category)

            # Call Gemini
            response = model.generate_content(
                [prompt, img],
                generation_config={
                    "temperature": 0.1,
                    "max_output_tokens": 1024,
                },
            )

            if not response or not response.text:
                logger.warning("Gemini returned empty response")
                return None

            # Parse JSON from response
            text = response.text.strip()

            # Strip markdown code fences if present
            if text.startswith("```"):
                lines = text.split("\n")
                # Remove first and last lines (```json and ```)
                text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

            result = json.loads(text)

            # Validate expected fields
            expected_fields = ["category", "description", "severity", "confidence"]
            for field in expected_fields:
                if field not in result:
                    logger.warning(f"Gemini response missing field: {field}")
                    result[field] = "unknown"

            # Validate enum values
            valid_categories = [
                "drainage_overflow", "garbage_dumping", "pothole_damaged_road",
                "waterlogging", "broken_streetlight", "damaged_infrastructure",
                "sewage_leakage", "other",
            ]
            if result.get("category") not in valid_categories:
                result["category"] = "other"

            valid_severities = ["low", "medium", "high", "critical"]
            if result.get("severity") not in valid_severities:
                result["severity"] = "medium"

            valid_confidences = ["low", "medium", "high"]
            if result.get("confidence") not in valid_confidences:
                result["confidence"] = "low"

            logger.info(
                f"Gemini analysis: category={result.get('category')}, "
                f"severity={result.get('severity')}, confidence={result.get('confidence')}"
            )
            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}")
            return None
        except Exception as e:
            logger.error(f"Gemini analysis error: {e}")
            return None

    async def test_connection(self) -> dict:
        """Test Gemini API connectivity."""
        try:
            model = self._get_model()
            response = model.generate_content("Reply with exactly: CIVIC_PULSE_OK")
            return {
                "status": "connected",
                "model": settings.gemini_model,
                "response": response.text.strip() if response else "no response",
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
            }
