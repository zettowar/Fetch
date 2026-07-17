from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models.pet import Pet
from app.models.user import User
from app.models.vote import Vote
from app.schemas.pet import PetOut
from app.schemas.vote import VoteCreate, VoteOut
from app.services.blocks import is_blocked_between
from app.services.pet_serializer import pet_to_out
from app.services.feed_service import current_week_bucket
from app.services import quota as quota_service

router = APIRouter()


class QuotaOut(BaseModel):
    used: int
    cap: int
    remaining: int
    unlimited: bool


@router.post("", response_model=VoteOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("120/minute")
async def cast_vote(
    request: Request,
    body: VoteCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify pet exists and is active
    result = await db.execute(select(Pet).where(Pet.id == body.pet_id, Pet.is_active == True))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    if pet.owner_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot vote on your own pet")
    # A blocked user can't interact with the other side's pet via the raw API,
    # just as the feed never surfaces it. Same 404 as a nonexistent pet.
    if await is_blocked_between(db, user.id, pet.owner_id):
        raise HTTPException(status_code=404, detail="Pet not found")

    # Enforce the daily swipe cap server-side — the client mirror is only a
    # display. Ad-free (Pack+) users are uncapped.
    now = datetime.now(timezone.utc)
    if not await quota_service.can_swipe(db, user.id, now):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily swipe limit reached",
        )

    week = current_week_bucket()
    vote = Vote(
        voter_id=user.id,
        pet_id=body.pet_id,
        value=body.value,
        week_bucket=week,
    )
    db.add(vote)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already voted on this pet this week")

    await db.refresh(vote)
    return vote


@router.get("/quota", response_model=QuotaOut)
async def get_swipe_quota(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Today's server-authoritative swipe quota for the current user."""
    q = await quota_service.get_quota(db, user.id, datetime.now(timezone.utc))
    return QuotaOut(used=q.used, cap=q.cap, remaining=q.remaining, unlimited=q.unlimited)


@router.post("/quota/reward", response_model=QuotaOut)
@limiter.limit("20/hour")
async def grant_swipe_reward(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Grant one rewarded-ad increment for today (bounded by the daily ceiling)."""
    q = await quota_service.grant_reward(db, user.id, datetime.now(timezone.utc))
    return QuotaOut(used=q.used, cap=q.cap, remaining=q.remaining, unlimited=q.unlimited)


@router.get("/mine", response_model=list[VoteOut])
async def my_votes(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    week = current_week_bucket()
    result = await db.execute(
        select(Vote)
        .where(Vote.voter_id == user.id, Vote.week_bucket == week)
        .order_by(Vote.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/liked", response_model=list[PetOut])
async def liked_pets(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dogs this user has liked (all time), newest like first."""
    liked_at = func.max(Vote.created_at).label("liked_at")
    liked_sq = (
        select(Vote.pet_id, liked_at)
        .where(Vote.voter_id == user.id, Vote.value == 1)
        .group_by(Vote.pet_id)
        .subquery()
    )
    result = await db.execute(
        select(Pet)
        .join(liked_sq, Pet.id == liked_sq.c.pet_id)
        .options(
            selectinload(Pet.photos),
            selectinload(Pet.breeds),
            selectinload(Pet.owner).selectinload(User.rescue_profile),
        )
        .where(Pet.is_active == True)  # noqa: E712
        .order_by(liked_sq.c.liked_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [pet_to_out(d) for d in result.scalars().all()]
