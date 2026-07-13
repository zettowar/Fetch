"""Dog QR tag registry — owner-facing claim / unlink.

Admin batch generation + assignment lives in `routers/admin.py`; the public
scan resolver is `GET /public/tags/{code}` in `routers/public.py`.
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.pet import Pet
from app.models.qr_tag import QRTag
from app.models.user import User

router = APIRouter()


class TagOut(BaseModel):
    code: str
    pet_id: UUID | None = None
    pet_name: str | None = None
    assigned_at: datetime | None = None


class ClaimTagRequest(BaseModel):
    code: str
    pet_id: UUID


def _norm(code: str) -> str:
    return code.strip().upper()


async def _load_tag(db: AsyncSession, code: str) -> QRTag | None:
    return (
        await db.execute(select(QRTag).where(QRTag.code == _norm(code)))
    ).scalar_one_or_none()


@router.get("/by-pet/{pet_id}", response_model=list[TagOut])
async def tags_for_pet(
    pet_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tags currently linked to one of the caller's pets."""
    pet = (await db.execute(select(Pet).where(Pet.id == pet_id))).scalar_one_or_none()
    if not pet or pet.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Pet not found")
    rows = (await db.execute(select(QRTag).where(QRTag.pet_id == pet_id))).scalars().all()
    return [
        TagOut(code=t.code, pet_id=t.pet_id, pet_name=pet.name, assigned_at=t.assigned_at)
        for t in rows
    ]


@router.post("/claim", response_model=TagOut)
async def claim_tag(
    body: ClaimTagRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link a pre-printed tag to one of the caller's pets."""
    tag = await _load_tag(db, body.code)
    if not tag:
        raise HTTPException(status_code=404, detail="Unknown tag code")
    if tag.pet_id is not None:
        raise HTTPException(status_code=409, detail="That tag is already linked to a pet")
    pet = (await db.execute(select(Pet).where(Pet.id == body.pet_id))).scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    if pet.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your pet")

    tag.pet_id = pet.id
    tag.assigned_by = user.id
    tag.assigned_at = datetime.now(timezone.utc)
    await db.commit()
    return TagOut(code=tag.code, pet_id=tag.pet_id, pet_name=pet.name, assigned_at=tag.assigned_at)


@router.delete("/{code}")
async def unlink_tag(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unlink a tag, returning it to the unassigned pool. Pet owner or staff."""
    tag = await _load_tag(db, code)
    if not tag or tag.pet_id is None:
        raise HTTPException(status_code=404, detail="Tag not linked")
    pet = (await db.execute(select(Pet).where(Pet.id == tag.pet_id))).scalar_one_or_none()
    is_staff = user.role in ("admin", "moderator")
    if not is_staff and (not pet or pet.owner_id != user.id):
        raise HTTPException(status_code=403, detail="Not your tag")
    tag.pet_id = None
    tag.assigned_by = None
    tag.assigned_at = None
    await db.commit()
    return {"detail": "Tag unlinked"}
