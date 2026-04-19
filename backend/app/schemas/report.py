from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ReportCreate(BaseModel):
    target_type: str
    target_id: UUID
    reason: str = Field(..., max_length=500)

    @field_validator("target_type")
    @classmethod
    def valid_target_type(cls, v: str) -> str:
        if v not in ("photo", "dog", "user", "comment"):
            raise ValueError("target_type must be one of: photo, dog, user, comment")
        return v

    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Reason must be at least 3 characters")
        return v


class ReportOut(BaseModel):
    id: UUID
    reporter_id: UUID
    target_type: str
    target_id: UUID
    reason: str
    status: str
    admin_notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportReview(BaseModel):
    status: str  # reviewed | dismissed
    admin_notes: str | None = Field(default=None, max_length=1000)
    apply_strike: bool = False
    strike_reason: str | None = Field(default=None, max_length=500)

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in ("reviewed", "dismissed"):
            raise ValueError("Status must be 'reviewed' or 'dismissed'")
        return v


class StrikeOut(BaseModel):
    id: UUID
    user_id: UUID
    report_id: UUID | None = None
    reason: str
    created_at: datetime

    model_config = {"from_attributes": True}
