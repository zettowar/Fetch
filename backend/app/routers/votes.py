from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models.dog import Dog
from app.models.user import User
from app.models.vote import Vote
from app.schemas.vote import VoteCreate, VoteOut
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
