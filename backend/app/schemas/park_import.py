from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class ParkImportRequest(BaseModel):
    """Admin-triggered Overpass import. `bbox` is (south, west, north, east) in
    decimal degrees; omit for a worldwide import (slow but complete)."""
    bbox: tuple[float, float, float, float] | None = None

    @field_validator("bbox")
    @classmethod
    def valid_bbox(cls, v):
        if v is None:
            return v
        south, west, north, east = v
        if not (-90 <= south < north <= 90):
            raise ValueError("south must be < north, both in [-90, 90]")
        if not (-180 <= west < east <= 180):
            raise ValueError("west must be < east, both in [-180, 180]")
        return v


class ParkImportResponse(BaseModel):
    created: int
    updated: int
    total_fetched: int
    errors: list[str]

    model_config = {"from_attributes": True}


class ParkImportHistoryEntry(BaseModel):
    id: UUID
    actor_id: UUID | None = None
    actor_name: str | None = None
    created: int
    updated: int
    total_fetched: int
    bbox: tuple[float, float, float, float] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
