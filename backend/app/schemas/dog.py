from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.schemas.breed import BreedSummary
from app.schemas.photo import PhotoSummary


def _not_future_date(v: date | None) -> date | None:
    if v is not None and v > date.today():
        raise ValueError("Date cannot be in the future")
    return v


VALID_TRAITS = {
    "Playful", "Calm", "Energetic", "Good with kids", "Good with dogs",
    "Loves fetch", "Couch potato", "Swimmer", "Cuddly", "Independent", "Senior",
}
# Keep in sync with frontend/src/api/dogs.ts DOG_TRAITS

VALID_MIX_TYPES = {"purebred", "cross", "mixed", "mystery_mutt"}
MAX_BREEDS_PER_DOG = 3


def _validate_traits(v: list[str]) -> list[str]:
    for t in v:
        if t not in VALID_TRAITS:
            raise ValueError(f"Unknown trait: {t}")
    return list(dict.fromkeys(v))  # deduplicate, preserve order


def _validate_mix_type(v: str) -> str:
    if v not in VALID_MIX_TYPES:
        raise ValueError(f"mix_type must be one of {sorted(VALID_MIX_TYPES)}")
    return v


def _validate_breed_ids(v: list[UUID]) -> list[UUID]:
    if len(v) > MAX_BREEDS_PER_DOG:
        raise ValueError(f"At most {MAX_BREEDS_PER_DOG} breeds allowed")
    # deduplicate, preserve order
    seen: set[UUID] = set()
    out: list[UUID] = []
    for bid in v:
        if bid in seen:
            continue
        seen.add(bid)
        out.append(bid)
    return out


class DogCreate(BaseModel):
    name: str
    mix_type: str = "mystery_mutt"
    breed_ids: list[UUID] = []
    birthday: date | None = None
    bio: str | None = None
    location_rough: str | None = None
    traits: list[str] = []

    @field_validator("mix_type")
    @classmethod
    def valid_mix_type(cls, v: str) -> str:
        return _validate_mix_type(v)

    @field_validator("breed_ids")
    @classmethod
    def valid_breed_ids(cls, v: list[UUID]) -> list[UUID]:
        return _validate_breed_ids(v)

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

    @field_validator("birthday")
    @classmethod
    def birthday_not_future(cls, v: date | None) -> date | None:
        return _not_future_date(v)


class DogUpdate(BaseModel):
    name: str | None = None
    mix_type: str | None = None
    breed_ids: list[UUID] | None = None
    birthday: date | None = None
    bio: str | None = None
    location_rough: str | None = None
    traits: list[str] | None = None

    @field_validator("mix_type")
    @classmethod
    def valid_mix_type(cls, v: str | None) -> str | None:
        return None if v is None else _validate_mix_type(v)

    @field_validator("breed_ids")
    @classmethod
    def valid_breed_ids(cls, v: list[UUID] | None) -> list[UUID] | None:
        return None if v is None else _validate_breed_ids(v)

    @field_validator("traits")
    @classmethod
    def valid_traits(cls, v: list[str] | None) -> list[str] | None:
        return None if v is None else _validate_traits(v)

    @field_validator("birthday")
    @classmethod
    def birthday_not_future(cls, v: date | None) -> date | None:
        return _not_future_date(v)


class DogOut(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    mix_type: str
    breeds: list[BreedSummary] = []
    breed_display: str
    birthday: date | None = None
    bio: str | None = None
    location_rough: str | None = None
    traits: list[str] = []
    primary_photo_id: UUID | None = None
    primary_photo_url: str | None = None
    is_active: bool
    created_at: datetime
    photos: list[PhotoSummary] = []

    # Adoption signals. `adoptable` is True iff the owner is an approved
    # rescue account and the dog has not yet been marked adopted.
    adoptable: bool = False
    adopted_at: datetime | None = None
    rescue_name: str | None = None
    rescue_id: UUID | None = None

    model_config = {"from_attributes": True}
