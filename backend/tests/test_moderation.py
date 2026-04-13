import pytest

from app.services.moderation import check_image, ModerationResult


@pytest.mark.asyncio
async def test_check_image_approves_without_api_key():
    """Without Sightengine credentials, images are auto-approved."""
    result = await check_image(b"fake image data")
    assert result.status == "approved"


@pytest.mark.asyncio
async def test_moderation_result_dataclass():
    result = ModerationResult(status="flagged", reason="nudity")
    assert result.status == "flagged"
    assert result.reason == "nudity"
