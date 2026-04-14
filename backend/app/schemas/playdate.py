from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


RSVP_STATUSES = {"going", "maybe", "declined"}


class PlayDateCreate(BaseModel):
    park_id: UUID
    scheduled_for: datetime
    title: str | None = None
    notes: str | None = None
    host_dog_id: UUID  # host auto-RSVPs with this dog

    @field_validator("title")
    @classmethod
    def title_length(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if len(v) > 200:
            raise ValueError("Title must be 200 characters or less")
        return v

    @field_validator("notes")
    @classmethod
    def notes_length(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if len(v) > 1000:
            raise ValueError("Notes must be 1000 characters or less")
        return v


class PlayDateRsvpCreate(BaseModel):
    dog_id: UUID
    status: str = "going"

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in RSVP_STATUSES:
            raise ValueError(f"status must be one of {sorted(RSVP_STATUSES)}")
        return v


class PlayDateRsvpOut(BaseModel):
    id: UUID
    playdate_id: UUID
    user_id: UUID
    dog_id: UUID
    dog_name: str | None = None
    dog_photo_url: str | None = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PlayDateOut(BaseModel):
    id: UUID
    host_id: UUID
    host_name: str | None = None
    park_id: UUID
    park_name: str | None = None
    title: str | None = None
    notes: str | None = None
    scheduled_for: datetime
    status: str
    rsvp_count: int = 0
    going_count: int = 0
    rsvps: list[PlayDateRsvpOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}
