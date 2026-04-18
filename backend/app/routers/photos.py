import io
from pathlib import Path
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import Response
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.dog import Dog
from app.models.photo import Photo
from app.models.user import User
from app.schemas.photo import PhotoOut
from app.services.moderation import check_image
from app.storage import generate_storage_key, get_storage

logger = structlog.stdlib.get_logger()

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB
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


@router.post("/dogs/{dog_id}/photos", response_model=PhotoOut, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    dog_id: UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    result = await db.execute(select(Dog).where(Dog.id == dog_id))
    dog = result.scalar_one_or_none()
    if not dog:
        raise HTTPException(status_code=404, detail="Dog not found")
    if dog.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your dog")

    # Read and validate
    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Validate with Pillow (magic bytes check)
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
        img = Image.open(io.BytesIO(data))  # re-open after verify
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    content_type = f"image/{img.format.lower()}" if img.format else file.content_type
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP are allowed")

    # Resize
    img = _resize_image(img, MAX_DIMENSION)

    # Content moderation
    mod_result = await check_image(data)
    if mod_result.status == "rejected":
        raise HTTPException(status_code=400, detail=f"Image rejected: {mod_result.reason}")

    moderation_status = "approved" if mod_result.status == "approved" else "flagged"

    # Save to storage
    buf = io.BytesIO()
    save_format = img.format or "JPEG"
    if save_format.lower() == "webp":
        img.save(buf, format="WEBP", quality=85)
    else:
        img.save(buf, format=save_format, quality=85)
    buf.seek(0)
    saved_data = buf.read()

    storage = get_storage()
    key = generate_storage_key(content_type)
    await storage.put(key, saved_data, content_type)

    photo = Photo(
        dog_id=dog_id,
        storage_key=key,
        width=img.size[0],
        height=img.size[1],
        content_type=content_type,
        moderation_status=moderation_status,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)

    # Auto-set primary photo if first photo
    if dog.primary_photo_id is None:
        dog.primary_photo_id = photo.id
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
    dog_result = await db.execute(select(Dog).where(Dog.id == photo.dog_id))
    dog = dog_result.scalar_one_or_none()
    if not dog or dog.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your photo")

    # Clear primary reference first, commit DB change, then delete the file.
    # Reversing this order means a failed commit leaves the file gone but the
    # row intact — orphaned references on reload.
    if dog.primary_photo_id == photo.id:
        dog.primary_photo_id = None

    key = photo.storage_key
    await db.delete(photo)
    await db.commit()

    storage = get_storage()
    try:
        await storage.delete(key)
    except Exception as exc:
        logger.warning("storage_delete_failed", key=key, exc=str(exc))
    return {"detail": "Photo deleted"}


@router.get("/photos/file/{key:path}")
async def get_photo_file(key: str):
    storage = get_storage()
    try:
        data = await storage.get(key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")

    ext = key.rsplit(".", 1)[-1] if "." in key else "jpg"
    media_type = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(
        ext, "image/jpeg"
    )
    return Response(content=data, media_type=media_type)
