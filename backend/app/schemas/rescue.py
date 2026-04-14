from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class RescueCreate(BaseModel):
    name: str
    description: str
    location: str | None = None
    website: str | None = None
    donation_url: str | None = None

    @field_validator("website", "donation_url", mode="before")
    @classmethod
    def normalise_url(cls, v: str | None) -> str | None:
        if v and not v.startswith(("http://", "https://")):
            return f"https://{v}"
        return v


class RescueOut(BaseModel):
    id: UUID
    name: str
    description: str
    location: str | None = None
    website: str | None = None
    donation_url: str | None = None
    verified: bool
    featured_until: datetime | None = None
    submitted_by: UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
