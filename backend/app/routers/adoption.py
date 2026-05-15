"""Adoption inquiries — POST a question to a rescue, list/update as a rescue."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_approved_rescue
from app.limiter import limiter
from app.models.adoption import AdoptionInquiry
from app.models.audit_log import AuditLog
from app.models.dog import Dog
from app.models.rescue import RescueProfile
from app.models.user import User
from app.schemas.adoption import (
    AdoptionInquiryCreate,
    AdoptionInquiryOut,
    AdoptionInquiryStatusUpdate,
)

router = APIRouter()


@router.post(
    "/rescues/{rescue_id}/inquiries",
    response_model=AdoptionInquiryOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/hour")
async def create_inquiry(
    request: Request,
    rescue_id: UUID,
    body: AdoptionInquiryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit an adoption inquiry to a rescue. Inquirer must be signed in."""
    result = await db.execute(
        select(RescueProfile).where(
            RescueProfile.id == rescue_id,
            RescueProfile.status == "approved",
        )
    )
    rescue = result.scalar_one_or_none()
    if not rescue:
        raise HTTPException(status_code=404, detail="Rescue not found")

    # If a dog was specified, ensure it belongs to this rescue.
    if body.dog_id is not None:
        dog_res = await db.execute(select(Dog).where(Dog.id == body.dog_id))
        dog = dog_res.scalar_one_or_none()
        if not dog or dog.owner_id != rescue.user_id:
            raise HTTPException(status_code=400, detail="Dog not from this rescue")

    inquiry = AdoptionInquiry(
        rescue_id=rescue.id,
        dog_id=body.dog_id,
        inquirer_id=user.id,
        name=body.name,
        email=body.email,
        phone=body.phone,
        message=body.message,
    )
    db.add(inquiry)
    db.add(AuditLog(
        actor_id=user.id,
        action="adoption.inquiry_submitted",
        target_type="rescue",
        target_id=rescue.id,
        metadata_={"dog_id": str(body.dog_id) if body.dog_id else None},
    ))
    await db.commit()
    await db.refresh(inquiry)
    return inquiry


@router.get(
    "/rescues/me/inquiries",
    response_model=list[AdoptionInquiryOut],
)
async def list_my_inquiries(
    user: User = Depends(require_approved_rescue),
    db: AsyncSession = Depends(get_db),
):
    """Inquiries that have come in to *my* rescue."""
    profile_res = await db.execute(
        select(RescueProfile).where(RescueProfile.user_id == user.id)
    )
    profile = profile_res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Rescue profile not found")

    result = await db.execute(
        select(AdoptionInquiry)
        .where(AdoptionInquiry.rescue_id == profile.id)
        .order_by(AdoptionInquiry.created_at.desc())
        .limit(200)
    )
    return list(result.scalars().all())


@router.patch(
    "/rescues/me/inquiries/{inquiry_id}",
    response_model=AdoptionInquiryOut,
)
async def update_inquiry_status(
    inquiry_id: UUID,
    body: AdoptionInquiryStatusUpdate,
    user: User = Depends(require_approved_rescue),
    db: AsyncSession = Depends(get_db),
):
    profile_res = await db.execute(
        select(RescueProfile).where(RescueProfile.user_id == user.id)
    )
    profile = profile_res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Rescue profile not found")

    result = await db.execute(
        select(AdoptionInquiry).where(
            AdoptionInquiry.id == inquiry_id,
            AdoptionInquiry.rescue_id == profile.id,
        )
    )
    inquiry = result.scalar_one_or_none()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    inquiry.status = body.status
    await db.commit()
    await db.refresh(inquiry)
    return inquiry
