from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    rank: int
    dog_id: str
    dog_name: str
    breed: str | None = None
    score: int
    total_votes: int


class WeeklyWinnerOut(BaseModel):
    id: UUID
    week_bucket: date
    dog_id: UUID
    dog_name: str | None = None
    breed: str | None = None
    score: int
    primary_photo_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DogStats(BaseModel):
    likes: int
    passes: int
