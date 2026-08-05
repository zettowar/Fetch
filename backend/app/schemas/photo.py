from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PhotoOut(BaseModel):
    id: UUID
    pet_id: UUID
    storage_key: str
    width: int
    height: int
    content_type: str
    moderation_status: str
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PhotoSummary(BaseModel):
    """Lightweight photo schema for embedding in pet responses."""

    id: UUID
    storage_key: str
    url: str | None = None
    width: int
    height: int
    content_type: str
    sort_order: int
    created_at: datetime
    # Always "approved" for anyone but the owner — non-approved photos are
    # withheld from every other payload. Owners see their own in-review photos
    # so an upload awaiting moderation doesn't look like a failed one; those
    # come back with `url` unset and must be fetched via
    # GET /photos/{id}/file (authenticated).
    moderation_status: str = "approved"

    model_config = {"from_attributes": True}


class SetPrimaryPhotoRequest(BaseModel):
    photo_id: UUID
