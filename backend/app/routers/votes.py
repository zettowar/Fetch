from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models.dog import Dog
from app.models.user import User
from app.models.vote import Vote
from app.schemas.dog import DogOut
from app.schemas.vote import VoteCreate, VoteOut
from app.services.dog_serializer import dog_to_out
from app.services.feed_service import current_week_bucket

router = APIRouter()


@router.post("", response_model=VoteOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("120/minute")
async def cast_vote(
    request: Request,
    body: VoteCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify dog exists and is active
    result = await db.execute(select(Dog).where(Dog.id == body.dog_id, Dog.is_active == True))
    dog = result.scalar_one_or_none()
    if not dog:
        raise HTTPException(status_code=404, detail="Dog not found")
    if dog.owner_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot vote on your own dog")

    week = current_week_bucket()
    vote = Vote(
        voter_id=user.id,
        dog_id=body.dog_id,
        value=body.value,
        week_bucket=week,
    )
    db.add(vote)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already voted on this dog this week")

    await db.refresh(vote)
    return vote


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


@router.get("/liked", response_model=list[DogOut])
async def liked_dogs(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dogs this user has liked (all time), newest like first."""
    liked_at = func.max(Vote.created_at).label("liked_at")
    liked_sq = (
        select(Vote.dog_id, liked_at)
        .where(Vote.voter_id == user.id, Vote.value == 1)
        .group_by(Vote.dog_id)
        .subquery()
    )
    result = await db.execute(
        select(Dog)
        .join(liked_sq, Dog.id == liked_sq.c.dog_id)
        .options(
            selectinload(Dog.photos),
            selectinload(Dog.breeds),
            selectinload(Dog.owner).selectinload(User.rescue_profile),
        )
        .where(Dog.is_active == True)  # noqa: E712
        .order_by(liked_sq.c.liked_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [dog_to_out(d) for d in result.scalars().all()]
