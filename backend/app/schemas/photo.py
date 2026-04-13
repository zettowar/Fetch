from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PhotoOut(BaseModel):
    id: UUID
    dog_id: UUID
    storage_key: str
    width: int
    height: int
    content_type: str
    moderation_status: str
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PhotoSummary(BaseModel):
    """Lightweight photo schema for embedding in dog responses."""

    id: UUID
    storage_key: str
    url: str | None = None
    width: int
    height: int
    content_type: str
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SetPrimaryPhotoRequest(BaseModel):
    photo_id: UUID
