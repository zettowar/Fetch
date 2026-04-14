from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, field_validator


class AuditLogOut(BaseModel):
    id: UUID
    actor_id: UUID | None = None
    action: str
    target_type: str | None = None
    target_id: UUID | None = None
    metadata_: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminDogOut(BaseModel):
    id: UUID
    name: str
    breed: str | None = None
    is_active: bool
    owner_id: UUID
    owner_name: str | None = None
    owner_email: str | None = None
    photo_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminLostReportOut(BaseModel):
    id: UUID
    kind: str
    status: str
    description: str
    reporter_id: UUID
    reporter_name: str | None = None
    dog_id: UUID | None = None
    dog_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total_users: int = 0
    active_users: int = 0
    suspended_users: int = 0
    users_last_7d: int = 0
    total_dogs: int = 0
    pending_reports: int = 0
    open_tickets: int = 0
    unverified_rescues: int = 0
    unused_invites: int = 0
    total_feedback: int = 0
    reports_last_7d: int = 0
    oldest_pending_report_hours: float | None = None
    oldest_open_ticket_hours: float | None = None


class AdminUserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    location_rough: str | None = None
    is_active: bool
    is_verified: bool
    role: str
    created_at: datetime
    dog_count: int = 0
    strike_count: int = 0

    model_config = {"from_attributes": True}


class TicketStatusUpdate(BaseModel):
    status: str
    admin_notes: str | None = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in ("in_progress", "resolved", "closed"):
            raise ValueError("Status must be in_progress, resolved, or closed")
        return v


class FAQCreate(BaseModel):
    question: str
    answer: str
    category: str
    sort_order: int = 0

    @field_validator("question")
    @classmethod
    def question_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Question is required")
        return v.strip()


class FAQUpdate(BaseModel):
    question: str | None = None
    answer: str | None = None
    category: str | None = None
    sort_order: int | None = None
