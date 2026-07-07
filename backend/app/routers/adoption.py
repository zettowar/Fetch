"""Adoption inquiries — POST a question to a rescue, list/update as a rescue."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_approved_rescue
from app.limiter import limiter
from app.models.adoption import AdoptionInquiry
from app.models.audit_log import AuditLog
from app.models.pet import Pet
from app.models.rescue import RescueProfile
from app.models.user import User
from app.services.notify import notify
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

    # If a pet was specified, ensure it belongs to this rescue.
    if body.pet_id is not None:
        pet_res = await db.execute(select(Pet).where(Pet.id == body.pet_id))
        pet = pet_res.scalar_one_or_none()
        if not pet or pet.owner_id != rescue.user_id:
            raise HTTPException(status_code=400, detail="Pet not from this rescue")

    inquiry = AdoptionInquiry(
        rescue_id=rescue.id,
        pet_id=body.pet_id,
        inquirer_id=user.id,
        name=body.name,
        email=body.email,
        phone=body.phone,
        message=body.message,
    )
    db.add(inquiry)
    await notify(
        db, rescue.user_id,
        type="inquiry_received",
        title=f"New adoption inquiry from {body.name}",
        body=body.message[:120] if body.message else None,
        link="/app/rescue/dashboard",
    )
    db.add(AuditLog(
        actor_id=user.id,
        action="adoption.inquiry_submitted",
        target_type="rescue",
        target_id=rescue.id,
        metadata_={"pet_id": str(body.pet_id) if body.pet_id else None},
    ))
    await db.commit()
    await db.refresh(inquiry)
    return inquiry


@router.get(
    "/rescues/me/inquiries",
    response_model=list[AdoptionInquiryOut],
)
async def list_my_inquiries(
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
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
        .limit(limit)
        .offset(offset)
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
    if inquiry.inquirer_id is not None:
        await notify(
            db, inquiry.inquirer_id,
            type="inquiry_status",
            title=f"{profile.org_name} marked your adoption inquiry {body.status}",
            link=f"/app/rescues/{profile.id}",
        )
    await db.commit()
    await db.refresh(inquiry)
    return inquiry
