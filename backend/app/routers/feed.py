from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.db import get_db
from app.deps import get_current_user
from app.models.pet import Pet
from app.models.user import User
from app.schemas.pet import PetOut
from app.services.pet_serializer import pet_to_out as _pet_to_out
from app.services.feed_service import get_feed

router = APIRouter()


@router.get("/next", response_model=list[PetOut])
async def get_feed_next(
    limit: int = Query(10, ge=1, le=50),
    species: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pets = await get_feed(
        user.id, db, limit=limit,
        species=species if species in ("dog", "cat") else None,
    )

    # Eagerly load photos for each pet
    if pets:
        pet_ids = [d.id for d in pets]
        result = await db.execute(
            select(Pet)
            .options(
                selectinload(Pet.photos),
                selectinload(Pet.breeds),
                selectinload(Pet.owner).selectinload(User.rescue_profile),
            )
            .where(Pet.id.in_(pet_ids))
        )
        dogs_with_photos = result.scalars().all()
        return [_pet_to_out(d) for d in dogs_with_photos]

    return []
