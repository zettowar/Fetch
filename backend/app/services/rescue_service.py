"""Helpers for rescue public pages: slug generation + logo/cover image prep."""
import io
from uuid import UUID

from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.breed_data import slugify
from app.models.rescue import RescueProfile

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
    """Validate + resize an uploaded rescue image. Returns (bytes, content_type,
    width, height). Raises ValueError on invalid/oversized input.

    Rescue accounts are approval-gated, so — unlike pet photos — logos/covers
    skip the Sightengine moderation queue (there's no review surface for them).
    """
    if len(data) > MAX_IMAGE_SIZE:
        raise ValueError("File too large (max 10MB)")
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
        img = Image.open(io.BytesIO(data))  # re-open after verify
    except Exception:
        raise ValueError("Invalid image file")

    content_type = f"image/{img.format.lower()}" if img.format else ""
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise ValueError("Only JPEG, PNG, and WebP are allowed")

    save_format = (img.format or "JPEG").upper()

    w, h = img.size
    if max(w, h) > max_dim:
        if w >= h:
            img = img.resize((max_dim, int(h * max_dim / w)), Image.LANCZOS)
        else:
            img = img.resize((int(w * max_dim / h), max_dim), Image.LANCZOS)

    buf = io.BytesIO()
    if save_format == "WEBP":
        if img.mode == "P":
            img = img.convert("RGBA")
        img.save(buf, format="WEBP", quality=85)
    elif save_format == "PNG":
        img.save(buf, format="PNG")
    else:
        if img.mode not in ("RGB", "L", "CMYK"):
            img = img.convert("RGB")
        img.save(buf, format="JPEG", quality=85)
    return buf.getvalue(), content_type, img.size[0], img.size[1]
