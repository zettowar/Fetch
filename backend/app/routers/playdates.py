from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models.dog import Dog
from app.models.park import Park
from app.models.playdate import PlayDate, PlayDateRsvp
from app.models.user import User
from app.schemas.playdate import (
    PlayDateCreate,
    PlayDateOut,
    PlayDateRsvpCreate,
    PlayDateRsvpOut,
)
from app.storage import get_storage

router = APIRouter()


def _rsvp_to_out(rsvp: PlayDateRsvp) -> PlayDateRsvpOut:
    storage = get_storage()
    photo_url = None
    dog = rsvp.dog
    if dog and dog.photos:
        photos_by_id = {p.id: p for p in dog.photos}
        photo = (
            photos_by_id.get(dog.primary_photo_id)
            if dog.primary_photo_id
            else dog.photos[0]
        )
        if photo:
            photo_url = storage.url(photo.storage_key)

    return PlayDateRsvpOut(
        id=rsvp.id,
        playdate_id=rsvp.playdate_id,
        user_id=rsvp.user_id,
        dog_id=rsvp.dog_id,
        dog_name=dog.name if dog else None,
        dog_photo_url=photo_url,
        status=rsvp.status,
        created_at=rsvp.created_at,
    )


def _playdate_to_out(pd: PlayDate, include_rsvps: bool = True) -> PlayDateOut:
    rsvps = list(pd.rsvps) if pd.rsvps else []
    going_count = sum(1 for r in rsvps if r.status == "going")
    return PlayDateOut(
        id=pd.id,
        host_id=pd.host_id,
        host_name=pd.host.display_name if pd.host else None,
        park_id=pd.park_id,
        park_name=pd.park.name if pd.park else None,
        title=pd.title,
        notes=pd.notes,
        scheduled_for=pd.scheduled_for,
        status=pd.status,
        rsvp_count=len(rsvps),
        going_count=going_count,
        rsvps=[_rsvp_to_out(r) for r in rsvps] if include_rsvps else [],
        created_at=pd.created_at,
    )


async def _load_playdate(playdate_id: UUID, db: AsyncSession) -> PlayDate:
    result = await db.execute(
        select(PlayDate)
        .options(
            selectinload(PlayDate.host),
            selectinload(PlayDate.park),
            selectinload(PlayDate.rsvps)
            .selectinload(PlayDateRsvp.dog)
            .selectinload(Dog.photos),
        )
        .where(PlayDate.id == playdate_id)
    )
    pd = result.scalar_one_or_none()
    if not pd:
        raise HTTPException(status_code=404, detail="Play date not found")
    return pd


@router.post("", response_model=PlayDateOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/hour")
async def create_playdate(
    request: Request,
    body: PlayDateCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Must be in the future
    scheduled = body.scheduled_for
    if scheduled.tzinfo is None:
        scheduled = scheduled.replace(tzinfo=timezone.utc)
    if scheduled <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="scheduled_for must be in the future")

    # Verify park exists
    park_result = await db.execute(select(Park).where(Park.id == body.park_id))
    if not park_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Park not found")

    # Verify host owns the dog
    dog_result = await db.execute(
        select(Dog).where(
            Dog.id == body.host_dog_id,
            Dog.owner_id == user.id,
            Dog.is_active == True,
        )
    )
    if not dog_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Dog not found or not yours")

    pd = PlayDate(
        host_id=user.id,
        park_id=body.park_id,
        title=body.title,
        notes=body.notes,
        scheduled_for=scheduled,
    )
    db.add(pd)
    await db.flush()

    # Auto-RSVP host
    rsvp = PlayDateRsvp(
        playdate_id=pd.id,
        user_id=user.id,
        dog_id=body.host_dog_id,
        status="going",
    )
    db.add(rsvp)
    await db.commit()

    pd = await _load_playdate(pd.id, db)
    return _playdate_to_out(pd)


@router.get("/upcoming", response_model=list[PlayDateOut])
async def list_upcoming(
    park_id: UUID | None = Query(None),
    mine: bool = Query(False),
    limit: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    query = (
        select(PlayDate)
        .options(
            selectinload(PlayDate.host),
            selectinload(PlayDate.park),
            selectinload(PlayDate.rsvps)
            .selectinload(PlayDateRsvp.dog)
            .selectinload(Dog.photos),
        )
        .where(PlayDate.scheduled_for > now, PlayDate.status == "scheduled")
        .order_by(PlayDate.scheduled_for.asc())
        .limit(limit)
    )
    if park_id:
        query = query.where(PlayDate.park_id == park_id)
    if mine:
        # Include play dates I'm hosting or have RSVPed to
        my_rsvps = select(PlayDateRsvp.playdate_id).where(PlayDateRsvp.user_id == user.id)
        query = query.where(or_(PlayDate.host_id == user.id, PlayDate.id.in_(my_rsvps)))

    result = await db.execute(query)
    playdates = result.scalars().unique().all()
    return [_playdate_to_out(pd) for pd in playdates]


@router.get("/{playdate_id}", response_model=PlayDateOut)
async def get_playdate(
    playdate_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pd = await _load_playdate(playdate_id, db)
    return _playdate_to_out(pd)


@router.delete("/{playdate_id}")
async def cancel_playdate(
    playdate_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PlayDate).where(PlayDate.id == playdate_id))
    pd = result.scalar_one_or_none()
    if not pd:
        raise HTTPException(status_code=404, detail="Play date not found")
    if pd.host_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the host can cancel")
    pd.status = "cancelled"
    await db.commit()
    return {"detail": "Cancelled"}


@router.post(
    "/{playdate_id}/rsvp",
    response_model=PlayDateRsvpOut,
    status_code=status.HTTP_201_CREATED,
)
async def rsvp_playdate(
    playdate_id: UUID,
    body: PlayDateRsvpCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify play date exists and is active
    pd_result = await db.execute(select(PlayDate).where(PlayDate.id == playdate_id))
    pd = pd_result.scalar_one_or_none()
    if not pd:
        raise HTTPException(status_code=404, detail="Play date not found")
    if pd.status != "scheduled":
        raise HTTPException(status_code=400, detail="Play date is not open for RSVPs")

    # Verify user owns the dog
    dog_result = await db.execute(
        select(Dog)
        .options(selectinload(Dog.photos))
        .where(
            Dog.id == body.dog_id,
            Dog.owner_id == user.id,
            Dog.is_active == True,
        )
    )
    dog = dog_result.scalar_one_or_none()
    if not dog:
        raise HTTPException(status_code=404, detail="Dog not found or not yours")

    # Upsert: update if exists, else create
    existing_result = await db.execute(
        select(PlayDateRsvp).where(
            PlayDateRsvp.playdate_id == playdate_id,
            PlayDateRsvp.dog_id == body.dog_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        existing.status = body.status
        existing.user_id = user.id
        await db.commit()
        await db.refresh(existing)
        existing.dog = dog
        return _rsvp_to_out(existing)

    rsvp = PlayDateRsvp(
        playdate_id=playdate_id,
        user_id=user.id,
        dog_id=body.dog_id,
        status=body.status,
    )
    db.add(rsvp)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already RSVPed with this dog")
    await db.refresh(rsvp)
    rsvp.dog = dog
    return _rsvp_to_out(rsvp)


@router.delete("/{playdate_id}/rsvp/{dog_id}")
async def remove_rsvp(
    playdate_id: UUID,
    dog_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlayDateRsvp).where(
            PlayDateRsvp.playdate_id == playdate_id,
            PlayDateRsvp.dog_id == dog_id,
            PlayDateRsvp.user_id == user.id,
        )
    )
    rsvp = result.scalar_one_or_none()
    if not rsvp:
        raise HTTPException(status_code=404, detail="RSVP not found")
    await db.delete(rsvp)
    await db.commit()
    return {"detail": "RSVP removed"}
