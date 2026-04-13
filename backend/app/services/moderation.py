import logging
from dataclasses import dataclass

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ModerationResult:
    status: str  # "approved" | "flagged" | "rejected"
    reason: str | None = None


async def check_image(image_bytes: bytes) -> ModerationResult:
    """Check image content using Sightengine API.

    Falls back to approved if no API key is configured or on timeout.
    """
    if not settings.SIGHTENGINE_API_USER or not settings.SIGHTENGINE_API_SECRET:
        logger.info("Moderation check skipped (no API key), approving image (%d bytes)", len(image_bytes))
        return ModerationResult(status="approved")

    try:
        async with httpx.AsyncClient(timeout=settings.MODERATION_TIMEOUT_S) as client:
            response = await client.post(
                "https://api.sightengine.com/1.0/check.json",
                data={
                    "models": "nudity-2.1,offensive,gore",
                    "api_user": settings.SIGHTENGINE_API_USER,
                    "api_secret": settings.SIGHTENGINE_API_SECRET,
                },
                files={"media": ("image.jpg", image_bytes, "image/jpeg")},
            )
            result = response.json()

        if result.get("status") != "success":
            logger.warning("Sightengine API error: %s", result)
            return ModerationResult(status="approved", reason="api_error_fallback")

        # Check for flagged content
        nudity = result.get("nudity", {})
        if nudity.get("sexual_activity", 0) > 0.5 or nudity.get("sexual_display", 0) > 0.5:
            return ModerationResult(status="flagged", reason="nudity")

        offensive = result.get("offensive", {})
        if offensive.get("prob", 0) > 0.7:
            return ModerationResult(status="flagged", reason="offensive")

        gore = result.get("gore", {})
        if gore.get("prob", 0) > 0.5:
            return ModerationResult(status="flagged", reason="gore")

        return ModerationResult(status="approved")

    except httpx.TimeoutException:
        logger.warning("Sightengine timeout, approving image by default")
        return ModerationResult(status="approved", reason="timeout_fallback")
    except Exception:
        logger.exception("Sightengine error, approving image by default")
        return ModerationResult(status="approved", reason="error_fallback")
