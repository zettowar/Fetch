from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.schemas.breed import BreedSummary
from app.schemas.photo import PhotoSummary


def _not_future_date(v: date | None) -> date | None:
    if v is not None and v > date.today():
        raise ValueError("Date cannot be in the future")
    return v


# Trait vocabularies are species-aware: a shared core plus species-specific
# extras. The frontend shows only the subset for the pet's species; the schema
# validates against the union.
# Keep in sync with frontend/src/api/pets.ts (DOG_TRAITS / CAT_TRAITS).
_SHARED_TRAITS = {
    "Playful", "Calm", "Energetic", "Good with kids", "Cuddly",
    "Independent", "Senior", "Couch potato", "House trained",
}
DOG_TRAITS = _SHARED_TRAITS | {
    "Good with dogs", "Good with cats", "Loves fetch", "Swimmer", "Leash trained",
}
CAT_TRAITS = _SHARED_TRAITS | {
    "Good with cats", "Good with dogs", "Lap cat", "Mouser", "Indoor only",
}
TRAITS_BY_SPECIES = {"dog": DOG_TRAITS, "cat": CAT_TRAITS}
VALID_TRAITS = DOG_TRAITS | CAT_TRAITS

VALID_SPECIES = {"dog", "cat"}
VALID_MIX_TYPES = {"purebred", "cross", "mixed", "mystery_mutt"}
MAX_BREEDS_PER_PET = 3


def _validate_traits(v: list[str]) -> list[str]:
    for t in v:
        if t not in VALID_TRAITS:
            raise ValueError(f"Unknown trait: {t}")
    return list(dict.fromkeys(v))  # deduplicate, preserve order


def _validate_mix_type(v: str) -> str:
    if v not in VALID_MIX_TYPES:
        raise ValueError(f"mix_type must be one of {sorted(VALID_MIX_TYPES)}")
    return v


def _validate_species(v: str) -> str:
    if v not in VALID_SPECIES:
        raise ValueError(f"species must be one of {sorted(VALID_SPECIES)}")
    return v


def _validate_breed_ids(v: list[UUID]) -> list[UUID]:
    if len(v) > MAX_BREEDS_PER_PET:
        raise ValueError(f"At most {MAX_BREEDS_PER_PET} breeds allowed")
    # deduplicate, preserve order
    seen: set[UUID] = set()
    out: list[UUID] = []
    for bid in v:
        if bid in seen:
            continue
        seen.add(bid)
        out.append(bid)
    return out


class PetCreate(BaseModel):
    name: str
    species: str = "dog"
    mix_type: str = "mystery_mutt"
    breed_ids: list[UUID] = []
    birthday: date | None = None
    bio: str | None = None
    location_rough: str | None = None
    traits: list[str] = []

    @field_validator("species")
    @classmethod
    def valid_species(cls, v: str) -> str:
        return _validate_species(v)

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


class PetUpdate(BaseModel):
    name: str | None = None
    mix_type: str | None = None
    breed_ids: list[UUID] | None = None
    birthday: date | None = None
    bio: str | None = None
    location_rough: str | None = None
    traits: list[str] | None = None
    is_public: bool | None = None

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


class PetOut(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    species: str
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
    is_public: bool = True
    created_at: datetime
    photos: list[PhotoSummary] = []

    # Adoption signals. `adoptable` is True iff the owner is an approved
    # rescue account and the pet has not yet been marked adopted.
    adoptable: bool = False
    adopted_at: datetime | None = None
    rescue_name: str | None = None
    rescue_id: UUID | None = None

    model_config = {"from_attributes": True}
