from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.services.traits import TRAIT_SPECIES, TRAIT_STATUSES, normalize_trait


def _validate_species(v: str) -> str:
    if v not in TRAIT_SPECIES:
        raise ValueError(f"species must be one of {sorted(TRAIT_SPECIES)}")
    return v


def _validate_status(v: str) -> str:
    if v not in TRAIT_STATUSES:
        raise ValueError(f"status must be one of {sorted(TRAIT_STATUSES)}")
    return v


class PetTraitOut(BaseModel):
    """A suggestion chip in the pet editor."""

    label: str
    slug: str
    species: str

    model_config = {"from_attributes": True}


class PetTraitAdminOut(BaseModel):
    id: UUID
    label: str
    slug: str
    species: str
    status: str
    sort_order: int
    # How many active pets carry the label right now.
    pet_count: int = 0
    # Display name of whoever first typed it; None for the seeded vocabulary.
    created_by_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PetTraitCreate(BaseModel):
    label: str
    species: str = "both"
    status: str = "approved"
    sort_order: int = 0

    @field_validator("label")
    @classmethod
    def clean_label(cls, v: str) -> str:
        return normalize_trait(v)

    @field_validator("species")
    @classmethod
    def valid_species(cls, v: str) -> str:
        return _validate_species(v)

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        return _validate_status(v)


class PetTraitUpdate(BaseModel):
    label: str | None = None
    species: str | None = None
    status: str | None = None
    sort_order: int | None = None

    @field_validator("label")
    @classmethod
    def clean_label(cls, v: str | None) -> str | None:
        return None if v is None else normalize_trait(v)

    @field_validator("species")
    @classmethod
    def valid_species(cls, v: str | None) -> str | None:
        return None if v is None else _validate_species(v)

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str | None) -> str | None:
        return None if v is None else _validate_status(v)
