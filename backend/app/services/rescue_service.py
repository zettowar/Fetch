"""Helpers for rescue public pages: slug generation + logo/cover image prep."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.breed_data import slugify
from app.models.rescue import RescueProfile
from app.services.image_processing import process_image

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


async def unique_rescue_slug(
    db: AsyncSession, org_name: str, exclude_id: UUID | None = None
) -> str:
    """A URL slug from org_name, uniquified with a numeric suffix on collision."""
    base = slugify(org_name) or "rescue"
    slug = base
    n = 1
    while True:
        q = select(RescueProfile.id).where(RescueProfile.slug == slug)
        if exclude_id is not None:
            q = q.where(RescueProfile.id != exclude_id)
        if (await db.execute(q)).first() is None:
            return slug
        n += 1
        slug = f"{base}-{n}"


def prepare_rescue_image(data: bytes, max_dim: int) -> tuple[bytes, str, int, int]:
    """Validate + orient + resize an uploaded rescue image. Returns (bytes,
    content_type, width, height). Raises ValueError on invalid/oversized input.

    Same processing as pet photos (``services.image_processing``). Rescue
    accounts are approval-gated, so — unlike pet photos — logos/covers skip
    the Sightengine moderation queue (there's no review surface for them).
    """
    if len(data) > MAX_IMAGE_SIZE:
        raise ValueError("File too large (max 10MB)")
    out = process_image(
        data,
        max_dim=max_dim,
        max_pixels=30_000_000,
        allowed_types=set(ALLOWED_IMAGE_TYPES),
    )
    return out.data, out.content_type, out.width, out.height

