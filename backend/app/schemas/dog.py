from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.schemas.photo import PhotoSummary


VALID_TRAITS = {
    "Playful", "Calm", "Energetic", "Good with kids", "Good with dogs",
    "Loves fetch", "Couch potato", "Swimmer", "Cuddly", "Independent", "Senior",
}
# Keep in sync with frontend/src/api/dogs.ts DOG_TRAITS


def _validate_traits(v: list[str]) -> list[str]:
    for t in v:
        if t not in VALID_TRAITS:
            raise ValueError(f"Unknown trait: {t}")
    return list(dict.fromkeys(v))  # deduplicate, preserve order


class DogCreate(BaseModel):
    name: str
    breed: str | None = None
    birthday: date | None = None
    bio: str | None = None
    location_rough: str | None = None
    traits: list[str] = []

    @field_validator("traits")
    @classmethod
    def valid_traits(cls, v: list[str]) -> list[str]:
        return _validate_traits(v)

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
    traits: list[str] | None = None

    @field_validator("traits")
    @classmethod
    def valid_traits(cls, v: list[str] | None) -> list[str] | None:
        return None if v is None else _validate_traits(v)


class DogOut(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    breed: str | None = None
    birthday: date | None = None
    bio: str | None = None
    location_rough: str | None = None
    traits: list[str] = []
    primary_photo_id: UUID | None = None
    primary_photo_url: str | None = None
    is_active: bool
    created_at: datetime
    photos: list[PhotoSummary] = []

    model_config = {"from_attributes": True}
