from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.common import reject_explicit_nulls
from app.schemas.urls import normalise_url as _normalise_url

RESCUE_STATUSES = {"pending", "approved", "rejected"}


class RescueSignupRequest(BaseModel):
    """Payload for POST /api/v1/auth/signup-rescue.

    Creates a user with role='rescue' plus a pending RescueProfile.
    """
    email: EmailStr
    password: str
    org_name: str
    description: str
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    website: str | None = None
    donation_url: str | None = None
    proof_details: str | None = None

    @field_validator("password")
    @classmethod
    def password_len(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("org_name", "description")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Required")
        return v

    @field_validator("website", "donation_url", mode="before")
    @classmethod
    def normalise(cls, v: str | None) -> str | None:
        return _normalise_url(v)


class RescueProfileUpdate(BaseModel):
    """Fields a rescue can edit on their own profile.

    `location`, `lat`/`lng`, `website` and `donation_url` may be sent as null
    to clear them; the name, description and visibility are required columns.
    Bounds match the column sizes so a long value is a 422, not a 500.
    """
    org_name: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    location: str | None = Field(default=None, max_length=200)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    website: str | None = Field(default=None, max_length=500)
    donation_url: str | None = Field(default=None, max_length=500)
    is_public: bool | None = None

    @field_validator("website", "donation_url", mode="before")
    @classmethod
    def normalise(cls, v: str | None) -> str | None:
        return _normalise_url(v)

    @field_validator("org_name", "description")
    @classmethod
    def not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("This field can't be empty")
        return v.strip() if v is not None else v

    @model_validator(mode="after")
    def consistent(self) -> "RescueProfileUpdate":
        reject_explicit_nulls(self, "org_name", "description", "is_public")
        # A map pin is two numbers or none: half a coordinate is not a place.
        sent = self.model_fields_set & {"lat", "lng"}
        if sent and (sent != {"lat", "lng"} or (self.lat is None) != (self.lng is None)):
            raise ValueError("lat and lng must be set (or cleared) together")
        return self


class RescueProfileOut(BaseModel):
    """Rescue self-view. Includes status + review note."""
    id: UUID
    user_id: UUID
    org_name: str
    description: str
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    website: str | None = None
    donation_url: str | None = None
    proof_details: str | None = None
    status: str
    review_note: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    donations_enabled: bool = False  # model property: Connect account live
    slug: str | None = None
    is_public: bool = True
    logo_url: str | None = None   # model property, from logo_key
    cover_url: str | None = None  # model property, from cover_key

    model_config = {"from_attributes": True}


class RescuePublicOut(BaseModel):
    """Public directory view (approved only). No internal review details."""
    id: UUID
    slug: str | None = None
    org_name: str
    description: str
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    website: str | None = None
    donation_url: str | None = None
    donations_enabled: bool = False  # model property: Connect account live
    logo_url: str | None = None
    cover_url: str | None = None

    model_config = {"from_attributes": True}


class RescueReviewRequest(BaseModel):
    """Admin approve/reject payload."""
    approve: bool
    note: str | None = None
