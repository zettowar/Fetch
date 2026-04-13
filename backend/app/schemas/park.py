from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class ParkCreate(BaseModel):
    name: str
    address: str | None = None
    lat: float
    lng: float
    attributes: dict | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name is required")
        return v.strip()


class ParkUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    attributes: dict | None = None
    verified: bool | None = None


class ParkOut(BaseModel):
    id: UUID
    name: str
    address: str | None = None
    lat: float
    lng: float
    verified: bool
    attributes: dict | None = None
    avg_rating: float | None = None
    review_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class ParkReviewCreate(BaseModel):
    rating: int
    body: str | None = None
    visit_time_of_day: str | None = None
    crowd_level: str | None = None

    @field_validator("rating")
    @classmethod
    def valid_rating(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return v


class ParkReviewOut(BaseModel):
    id: UUID
    park_id: UUID
    author_id: UUID
    author_name: str | None = None
    rating: int
    body: str | None = None
    visit_time_of_day: str | None = None
    crowd_level: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ParkIncidentCreate(BaseModel):
    kind: str
    description: str

    @field_validator("kind")
    @classmethod
    def valid_kind(cls, v: str) -> str:
        if v not in ("aggressive_dog", "wildlife", "hazard", "other"):
            raise ValueError("kind must be aggressive_dog, wildlife, hazard, or other")
        return v


class ParkIncidentOut(BaseModel):
    id: UUID
    park_id: UUID
    reporter_id: UUID
    kind: str
    description: str
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class CheckinCreate(BaseModel):
    dog_id: UUID


class ParkCheckinOut(BaseModel):
    id: UUID
    park_id: UUID
    dog_id: UUID | None
    dog_name: str | None = None
    dog_breed: str | None = None
    dog_photo_url: str | None = None
    checked_in_at: datetime
    checked_out_at: datetime | None = None

    model_config = {"from_attributes": True}
