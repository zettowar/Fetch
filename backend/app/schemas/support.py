from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class FAQOut(BaseModel):
    id: UUID
    question: str
    answer: str
    category: str
    sort_order: int

    model_config = {"from_attributes": True}


class TicketCreate(BaseModel):
    subject: str = Field(..., max_length=200)
    body: str = Field(..., max_length=4000)
    source_screen: str | None = Field(default=None, max_length=100)

    @field_validator("subject")
    @classmethod
    def subject_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Subject is required")
        return v.strip()


class TicketMineOut(BaseModel):
    """What the *reporter* may see about their own ticket.

    Deliberately excludes admin_notes: the admin UI labels that field "Admin
    notes (optional)" and staff use it for internal triage, so it must never
    reach the person being triaged.
    """
    id: UUID
    subject: str
    body: str
    source_screen: str | None = None
    status: str
    ticket_number: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketOut(BaseModel):
    id: UUID
    user_id: UUID
    subject: str
    body: str
    source_screen: str | None = None
    status: str
    ticket_number: str
    assigned_to: UUID | None = None
    admin_notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
