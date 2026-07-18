from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class FeedbackCreate(BaseModel):
    body: str = Field(..., max_length=4000)
    screen_name: str | None = Field(default=None, max_length=80)

    @field_validator("body")
    @classmethod
    def body_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Feedback body is required")
        return v.strip()


class FeedbackOut(BaseModel):
    id: UUID
    user_id: UUID
    screen_name: str | None = None
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class InviteCodeOut(BaseModel):
    id: UUID
    code: str
    is_used: bool
    used_by: UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class InviteCodeBatchCreate(BaseModel):
    count: int = Field(default=10, ge=1, le=100)


class WaitlistJoinRequest(BaseModel):
    email: EmailStr
    source: str | None = Field(default=None, max_length=50)


class WaitlistEntryOut(BaseModel):
    id: UUID
    email: str
    source: str | None = None
    created_at: datetime
    invited_at: datetime | None = None
    invite_code: str | None = None

    model_config = {"from_attributes": True}


class WaitlistInviteOut(BaseModel):
    """Result of one-click-inviting a waitlisted person."""
    email: str
    code: str
    signup_url: str
    # False when no email provider is configured — the caller can still copy the
    # signup_url and share it manually.
    email_sent: bool
