import io
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, status
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models.pet import Pet
from app.models.photo import Photo
from app.models.user import User
from app.schemas.photo import PhotoOut
from app.services.moderation import check_image
from app.storage import generate_storage_key, get_storage

logger = structlog.stdlib.get_logger()

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB

# Stored bytes are immutable (the key is a fresh UUID per upload), so images are
# safe to cache — but an approved photo can still be rejected or deleted later,
# and a long-lived cache entry would outlive the takedown. An hour of freshness
# kills the per-render refetch that dominates the swipe deck, while bounding how
# long a removed image can linger; the ETag then makes each revalidation a 304.
_PHOTO_MAX_AGE = 3600


def _process_upload(
    data: bytes, fallback_content_type: str | None
) -> tuple[str, bytes, tuple[int, int]]:
    """Validate, resize and re-encode an upload. Runs in a worker thread.

    Returns ``(content_type, encoded_bytes, (width, height))``. Raises
    ``HTTPException`` for anything the client got wrong, exactly as before —
    Starlette propagates it out of the threadpool unchanged.
    """
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
        img = Image.open(io.BytesIO(data))  # re-open after verify
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    content_type = f"image/{img.format.lower()}" if img.format else fallback_content_type
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP are allowed")

    # Image.resize() returns a copy with format=None, so capture the source
    # format before scaling or every large upload would fall back to JPEG
    # (500ing on RGBA PNGs and storing mislabeled bytes otherwise).
    save_format = (img.format or "JPEG").upper()

    img = _resize_image(img, MAX_DIMENSION)

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
    buf.seek(0)
    return content_type, buf.read(), img.size


def _cached_image(
    request: Request, data: bytes, media_type: str, key: str, *, private: bool
) -> Response:
    """Return an image with validators, or 304 when the client's copy is current."""
    etag = f'"{key}"'
    scope = "private" if private else "public"
    headers = {
        "Cache-Control": f"{scope}, max-age={_PHOTO_MAX_AGE}",
        "ETag": etag,
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    return Response(content=data, media_type=media_type, headers=headers)
MAX_DIMENSION = 1600


def _resize_image(img: Image.Image, max_dim: int) -> Image.Image:
    w, h = img.size
    if w <= max_dim and h <= max_dim:
        return img
    if w > h:
        new_w = max_dim
        new_h = int(h * max_dim / w)
    else:
        new_h = max_dim
        new_w = int(w * max_dim / h)
    return img.resize((new_w, new_h), Image.LANCZOS)


@router.post("/pets/{pet_id}/photos", response_model=PhotoOut, status_code=status.HTTP_201_CREATED)
# The most expensive endpoint in the app: a 10 MB read, a CPU-bound decode and
# resize, and a billed third-party moderation call — and it was the only
# user-facing write with no limit at all.
@limiter.limit("30/hour")
async def upload_photo(
    pet_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    if pet.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your pet")

    # Read and validate
    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Decode, validate, resize and re-encode in a worker thread — Pillow is
    # CPU-bound and synchronous, and doing it inline blocks the event loop for
    # every other request on the worker for the duration of the upload.
    content_type, saved_data, dimensions = await run_in_threadpool(
        _process_upload, data, file.content_type
    )

    # Content moderation
    mod_result = await check_image(data)
    if mod_result.status == "rejected":
        raise HTTPException(status_code=400, detail=f"Image rejected: {mod_result.reason}")

    moderation_status = "approved" if mod_result.status == "approved" else "flagged"

    storage = get_storage()
    key = generate_storage_key(content_type)
    await storage.put(key, saved_data, content_type)

    photo = Photo(
        pet_id=pet_id,
        storage_key=key,
        width=dimensions[0],
        height=dimensions[1],
        content_type=content_type,
        moderation_status=moderation_status,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)

    # Auto-set primary photo if first photo. Only a photo that actually passed
    # moderation can be primary — pointing `primary_photo_id` at a withheld
    # photo leaves every card rendering a blank hero until a reviewer gets to
    # it. `admin.approve_photo` claims the slot later if it's still empty.
    if pet.primary_photo_id is None and photo.moderation_status == "approved":
        pet.primary_photo_id = photo.id
        await db.commit()

    return photo


@router.delete("/photos/{photo_id}")
async def delete_photo(
    photo_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Verify ownership
    pet_result = await db.execute(select(Pet).where(Pet.id == photo.pet_id))
    pet = pet_result.scalar_one_or_none()
    if not pet or pet.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your photo")

    # Clear primary reference first, commit DB change, then delete the file.
    # Reversing this order means a failed commit leaves the file gone but the
    # row intact — orphaned references on reload.
    if pet.primary_photo_id == photo.id:
        pet.primary_photo_id = None

    key = photo.storage_key
    await db.delete(photo)
    await db.commit()

    storage = get_storage()
    try:
        await storage.delete(key)
    except Exception as exc:
        logger.warning("storage_delete_failed", key=key, exc=str(exc))
    return {"detail": "Photo deleted"}


@router.get("/photos/{photo_id}/file")
async def get_own_photo_file(
    photo_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve one of the caller's own photos regardless of moderation status.

    The public `/photos/file/{key}` route withholds anything not approved, which
    is right for everyone else but means an owner's in-review upload renders as
    a broken image on their own pet page. Owner-scoped and by id, so it can't be
    used to enumerate other people's withheld photos.
    """
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    pet_result = await db.execute(select(Pet).where(Pet.id == photo.pet_id))
    pet = pet_result.scalar_one_or_none()
    if not pet or pet.owner_id != user.id:
        # Same 404 a missing photo gives — don't confirm it exists.
        raise HTTPException(status_code=404, detail="Photo not found")

    storage = get_storage()
    try:
        data = await storage.get(photo.storage_key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    # private: this is the owner-only view of a possibly-withheld photo, so it
    # must never land in a shared/proxy cache.
    return _cached_image(
        request, data, photo.content_type, photo.storage_key, private=True
    )


@router.get("/photos/file/{key:path}")
async def get_photo_file(
    key: str, request: Request, db: AsyncSession = Depends(get_db)
):
    # Withhold pet photos that haven't passed moderation — otherwise sharing
    # the direct file URL bypasses every feed-level filter. Keys with no Photo
    # row (e.g. sighting photos, which are reject-on-upload) pass through.
    photo_result = await db.execute(select(Photo).where(Photo.storage_key == key))
    photo = photo_result.scalar_one_or_none()
    if photo and photo.moderation_status != "approved":
        raise HTTPException(status_code=404, detail="File not found")

    storage = get_storage()
    try:
        data = await storage.get(key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")

    if photo:
        media_type = photo.content_type
    else:
        # Keys with no Photo row (e.g. sighting photos) fall back to extension.
        ext = key.rsplit(".", 1)[-1] if "." in key else "jpg"
        media_type = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(
            ext, "image/jpeg"
        )
    return _cached_image(request, data, media_type, key, private=False)
