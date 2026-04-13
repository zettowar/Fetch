from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.schemas.photo import PhotoSummary


class DogCreate(BaseModel):
    name: str
    breed: str | None = None
    birthday: date | None = None
    bio: str | None = None
    location_rough: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name is required")
        return v.strip()

    @field_validator("bio")
    @classmethod
    def bio_max_length(cls, v: str | None) -> str | None:
        if v and len(v) > 500:
            raise ValueError("Bio must be 500 characters or less")
        return v


class DogUpdate(BaseModel):
    name: str | None = None
    breed: str | None = None
    birthday: date | None = None
    bio: str | None = None
    location_rough: str | None = None


class DogOut(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    breed: str | None = None
    birthday: date | None = None
    bio: str | None = None
    location_rough: str | None = None
    primary_photo_id: UUID | None = None
    primary_photo_url: str | None = None
    is_active: bool
    created_at: datetime
    photos: list[PhotoSummary] = []

    model_config = {"from_attributes": True}
