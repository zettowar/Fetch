from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class FeedbackCreate(BaseModel):
    body: str
    screen_name: str | None = None

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
    count: int = 10
