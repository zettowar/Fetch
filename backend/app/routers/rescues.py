from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models.rescue import Rescue
from app.models.user import User
from app.schemas.rescue import RescueCreate, RescueOut

router = APIRouter()


@router.post("", response_model=RescueOut, status_code=status.HTTP_201_CREATED)
async def submit_rescue(
    body: RescueCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rescue = Rescue(
        name=body.name, description=body.description,
        location=body.location, website=body.website,
        donation_url=body.donation_url, submitted_by=user.id, verified=False,
    )
    db.add(rescue)
    await db.commit()
    await db.refresh(rescue)
    return rescue


@router.get("", response_model=list[RescueOut])
async def list_rescues(
    verified_only: bool = Query(True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Rescue).order_by(Rescue.name)
    if verified_only:
        query = query.where(Rescue.verified == True)
    result = await db.execute(query.limit(100))
    return list(result.scalars().all())


@router.get("/{rescue_id}", response_model=RescueOut)
async def get_rescue(
    rescue_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Rescue).where(Rescue.id == rescue_id))
    rescue = result.scalar_one_or_none()
    if not rescue:
        raise HTTPException(status_code=404, detail="Rescue not found")
    return rescue


@router.post("/{rescue_id}/verify", response_model=RescueOut)
async def verify_rescue(
    rescue_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Rescue).where(Rescue.id == rescue_id))
    rescue = result.scalar_one_or_none()
    if not rescue:
        raise HTTPException(status_code=404, detail="Rescue not found")
    rescue.verified = True
    await db.commit()
    await db.refresh(rescue)
    return rescue
