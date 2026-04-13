from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class RescueCreate(BaseModel):
    name: str
    description: str
    location: str | None = None
    website: str | None = None
    donation_url: str | None = None


class RescueOut(BaseModel):
    id: UUID
    name: str
    description: str
    location: str | None = None
    website: str | None = None
    donation_url: str | None = None
    verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}
