from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


# --- Lost Report ---

class LostReportCreate(BaseModel):
    dog_id: UUID | None = None
    kind: str
    last_seen_at: datetime | None = None
    last_seen_lat: float | None = None
    last_seen_lng: float | None = None
    location_fuzz_m: int = 500
    description: str
    contact_method: str = "in_app"
    contact_value: str | None = None

    @field_validator("kind")
    @classmethod
    def valid_kind(cls, v: str) -> str:
        if v not in ("missing", "found"):
            raise ValueError("kind must be 'missing' or 'found'")
        return v

    @field_validator("contact_method")
    @classmethod
    def valid_contact(cls, v: str) -> str:
        if v not in ("in_app", "email", "phone"):
            raise ValueError("contact_method must be 'in_app', 'email', or 'phone'")
        return v

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Description is required")
        return v.strip()


class LostReportUpdate(BaseModel):
    status: str | None = None
    description: str | None = None
    last_seen_lat: float | None = None
    last_seen_lng: float | None = None
    contact_method: str | None = None
    contact_value: str | None = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str | None) -> str | None:
        if v is not None and v not in ("open", "resolved", "closed"):
            raise ValueError("status must be 'open', 'resolved', or 'closed'")
        return v


class LostReportPhotoOut(BaseModel):
    id: UUID
    storage_key: str
    url: str | None = None
    width: int
    height: int
    content_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LostReportOut(BaseModel):
    id: UUID
    reporter_id: UUID
    dog_id: UUID | None = None
    kind: str
    status: str
    last_seen_at: datetime | None = None
    last_seen_lat: float | None = None
    last_seen_lng: float | None = None
    description: str
    contact_method: str
    resolved_at: datetime | None = None
    created_at: datetime
    photos: list[LostReportPhotoOut] = []
    sighting_count: int = 0
    # Dog info if linked
    dog_name: str | None = None
    dog_breed: str | None = None
    dog_photo_url: str | None = None

    model_config = {"from_attributes": True}


class NearbyReportOut(BaseModel):
    """Fuzzed coordinate version for map display."""
    id: UUID
    kind: str
    status: str
    fuzzed_lat: float
    fuzzed_lng: float
    dog_name: str | None = None
    dog_breed: str | None = None
    dog_photo_url: str | None = None
    description: str
    created_at: datetime


# --- Sightings ---

class SightingCreate(BaseModel):
    lat: float
    lng: float
    seen_at: datetime | None = None
    note: str | None = None

    @field_validator("lat")
    @classmethod
    def valid_lat(cls, v: float) -> float:
        if not -90 <= v <= 90:
            raise ValueError("lat must be between -90 and 90")
        return v

    @field_validator("lng")
    @classmethod
    def valid_lng(cls, v: float) -> float:
        if not -180 <= v <= 180:
            raise ValueError("lng must be between -180 and 180")
        return v


class SightingOut(BaseModel):
    id: UUID
    report_id: UUID
    reporter_id: UUID
    lat: float
    lng: float
    seen_at: datetime | None = None
    note: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Subscriptions ---

class SubscriptionCreate(BaseModel):
    home_lat: float
    home_lng: float
    radius_km: float = 10.0

    @field_validator("radius_km")
    @classmethod
    def valid_radius(cls, v: float) -> float:
        if v < 1 or v > 100:
            raise ValueError("radius_km must be between 1 and 100")
        return v


class SubscriptionOut(BaseModel):
    id: UUID
    home_lat: float
    home_lng: float
    radius_km: float
    enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SubscriptionUpdate(BaseModel):
    home_lat: float | None = None
    home_lng: float | None = None
    radius_km: float | None = None
    enabled: bool | None = None


# --- Contact Relay ---

class ContactRequest(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message is required")
        return v.strip()
