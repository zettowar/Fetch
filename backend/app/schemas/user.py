from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class UserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    location_rough: str | None = None
    date_of_birth: date | None = None
    is_verified: bool
    role: str
    show_adoption_prompt: bool = True
    species_preference: str = "both"
    totp_enabled: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name: str | None = None
    location_rough: str | None = Field(default=None, max_length=200)

    @field_validator("display_name")
    @classmethod
    def display_name_valid(cls, v: str | None) -> str | None:
        # Unvalidated, a blank name saved as "" (every avatar and comment
        # byline went empty) and one over the column size was a 500. The cap
        # is the column's 100, not signup's 80, so an account that already
        # holds a longer name (SSO-provided) can still save its profile.
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Display name is required")
        if len(v) > 100:
            raise ValueError("Display name must be 100 characters or fewer")
        return v
    date_of_birth: date | None = None
    show_adoption_prompt: bool | None = None
    species_preference: Literal["dog", "cat", "both"] | None = None


class BlockedUserOut(BaseModel):
    user_id: UUID
    display_name: str
    blocked_at: datetime
