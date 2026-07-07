from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    rank: int
    pet_id: str
    pet_name: str
    species: str = "dog"
    breed: str | None = None
    score: int
    total_votes: int


class WeeklyWinnerOut(BaseModel):
    id: UUID
    week_bucket: date
    species: str = "dog"
    pet_id: UUID
    pet_name: str | None = None
    breed: str | None = None
    score: int
    primary_photo_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PetStats(BaseModel):
    likes: int
    passes: int
    week_score: int | None = None
    week_rank: int | None = None
    week_total: int = 0
    crown_weeks: list[date] = []
