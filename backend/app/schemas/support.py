from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class FAQOut(BaseModel):
    id: UUID
    question: str
    answer: str
    category: str
    sort_order: int

    model_config = {"from_attributes": True}


class TicketCreate(BaseModel):
    subject: str
    body: str
    source_screen: str | None = None

    @field_validator("subject")
    @classmethod
    def subject_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Subject is required")
        return v.strip()


class TicketOut(BaseModel):
    id: UUID
    user_id: UUID
    subject: str
    body: str
    source_screen: str | None = None
    status: str
    ticket_number: str
    created_at: datetime

    model_config = {"from_attributes": True}
