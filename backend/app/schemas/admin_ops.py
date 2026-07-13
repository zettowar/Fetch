from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.announcement import ANNOUNCEMENT_SEGMENTS


class AdminUserEdit(BaseModel):
    display_name: str | None = Field(default=None, max_length=80)
    email: EmailStr | None = None

    @field_validator("display_name")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Display name cannot be blank")
        return v


class ImpersonateResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    display_name: str


class RescueStatusUpdate(BaseModel):
    status: str
    note: str | None = None

    @field_validator("status")
    @classmethod
    def _valid(cls, v: str) -> str:
        if v not in ("pending", "approved", "rejected"):
            raise ValueError("status must be pending, approved, or rejected")
        return v


class RescueAdminEdit(BaseModel):
    org_name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    location: str | None = Field(default=None, max_length=200)
    website: str | None = Field(default=None, max_length=500)
    donation_url: str | None = Field(default=None, max_length=500)


class AdoptionInquiryOut(BaseModel):
    id: UUID
    rescue_id: UUID
    rescue_name: str | None = None
    pet_id: UUID | None = None
    inquirer_id: UUID
    name: str
    email: str
    phone: str | None = None
    message: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AnnouncementCreate(BaseModel):
    title: str = Field(..., max_length=200)
    body: str = Field(..., max_length=4000)
    link: str | None = Field(default=None, max_length=300)
    segment: str = "all"
    send_email: bool = False

    @field_validator("title", "body")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Required")
        return v.strip()

    @field_validator("segment")
    @classmethod
    def _valid_segment(cls, v: str) -> str:
        if v not in ANNOUNCEMENT_SEGMENTS:
            raise ValueError(f"segment must be one of {ANNOUNCEMENT_SEGMENTS}")
        return v


class AnnouncementOut(BaseModel):
    id: UUID
    title: str
    body: str
    link: str | None = None
    segment: str
    send_email: bool
    recipient_count: int
    sent_by: UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SettingOut(BaseModel):
    key: str
    value: Any = None
    default: Any = None
    description: str
    overridden: bool


class SettingUpdate(BaseModel):
    value: Any = None


class BeatJobStatus(BaseModel):
    name: str
    schedule: str
    registered: bool


class SystemJobsOut(BaseModel):
    broker_queue_depth: int | None = None
    beat_jobs: list[BeatJobStatus]
    registered_tasks: list[str]
