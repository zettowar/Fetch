from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


RESCUE_STATUSES = {"pending", "approved", "rejected"}


def _normalise_url(v: str | None) -> str | None:
    if v is None:
        return v
    v = v.strip()
    if not v:
        return None
    if not v.startswith(("http://", "https://")):
        return f"https://{v}"
    return v


class RescueSignupRequest(BaseModel):
    """Payload for POST /api/v1/auth/signup-rescue.

    Creates a user with role='rescue' plus a pending RescueProfile.
    """
    email: EmailStr
    password: str
    org_name: str
    description: str
    location: str | None = None
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
    """Fields a rescue can edit on their own profile."""
    org_name: str | None = None
    description: str | None = None
    location: str | None = None
    website: str | None = None
    donation_url: str | None = None

    @field_validator("website", "donation_url", mode="before")
    @classmethod
    def normalise(cls, v: str | None) -> str | None:
        return _normalise_url(v)


class RescueProfileOut(BaseModel):
    """Rescue self-view. Includes status + review note."""
    id: UUID
    user_id: UUID
    org_name: str
    description: str
    location: str | None = None
    website: str | None = None
    donation_url: str | None = None
    proof_details: str | None = None
    status: str
    review_note: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RescuePublicOut(BaseModel):
    """Public directory view (approved only). No internal review details."""
    id: UUID
    org_name: str
    description: str
    location: str | None = None
    website: str | None = None
    donation_url: str | None = None

    model_config = {"from_attributes": True}


class RescueReviewRequest(BaseModel):
    """Admin approve/reject payload."""
    approve: bool
    note: str | None = None
