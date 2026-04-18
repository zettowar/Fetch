from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.breed import Breed
from app.models.user import User
from app.schemas.breed import BreedOut

router = APIRouter()


@router.get("", response_model=list[BreedOut])
async def list_breeds(
    q: str = Query(default=""),
    include_inactive: bool = Query(False),
    limit: int = Query(500, ge=1, le=1000),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List breeds alphabetically. Supports case-insensitive prefix/contains search via ?q="""
    query = select(Breed).order_by(Breed.name.asc()).limit(limit)
    if not include_inactive:
        query = query.where(Breed.is_active == True)  # noqa: E712
    if q:
        query = query.where(Breed.name.ilike(f"%{q.strip()}%"))
    result = await db.execute(query)
    return list(result.scalars().all())
