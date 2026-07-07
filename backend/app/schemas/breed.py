from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class BreedOut(BaseModel):
    id: UUID
    name: str
    slug: str
    group: str | None = None
    species: str = "dog"
    is_active: bool = True

    model_config = {"from_attributes": True}


class BreedSummary(BaseModel):
    id: UUID
    name: str
    slug: str

    model_config = {"from_attributes": True}


class BreedCreate(BaseModel):
    name: str
    group: str | None = None
    species: str = "dog"
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        if len(v) > 100:
            raise ValueError("Name too long")
        return v

    @field_validator("species")
    @classmethod
    def valid_species(cls, v: str) -> str:
        if v not in ("dog", "cat"):
            raise ValueError("species must be 'dog' or 'cat'")
        return v


class BreedUpdate(BaseModel):
    name: str | None = None
    group: str | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        return v


class BreedAdminOut(BreedOut):
    pet_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
