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


class TicketMessageCreate(BaseModel):
    body: str = Field(..., max_length=4000)

    @field_validator("body")
    @classmethod
    def body_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message is required")
        return v.strip()


class StaffReplyCreate(TicketMessageCreate):
    """A staff reply, optionally resolving the ticket in the same action.

    Bundling them matters: resolving separately from replying is two clicks that
    send two notifications for one event, and the common case — answer the
    question and close it out — should be a single deliberate action.
    """

    status: str | None = Field(default=None)

    @field_validator("status")
    @classmethod
    def known_status(cls, v: str | None) -> str | None:
        if v is not None and v not in {"open", "in_progress", "resolved", "closed"}:
            raise ValueError("Unknown status")
        return v


class TicketMessageOut(BaseModel):
    """One reply, as shown to the *reporter*.

    Carries no author id or name. Which staff member answered is internal: the
    reporter is talking to Fetchpawz support, not to a named individual whose
    profile they could then go and find.
    """

    id: UUID
    author_role: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class StaffTicketMessageOut(TicketMessageOut):
    """The same reply with the author attached, for the staff queue only."""

    author_id: UUID | None = None
    author_name: str | None = None


class TicketMineOut(BaseModel):
    """What the *reporter* may see about their own ticket.

    Deliberately excludes admin_notes: that field is internal triage and must
    never reach the person being triaged. Replies live in `messages` instead.
    """

    id: UUID
    subject: str
    body: str
    source_screen: str | None = None
    status: str
    ticket_number: str
    created_at: datetime
    last_message_at: datetime | None = None
    # Staff replies the reporter has not opened yet — drives the badge on the
    # support tab, which is the only way they learn an answer arrived without
    # checking their email.
    unread_count: int = 0
    reply_count: int = 0

    model_config = {"from_attributes": True}


class TicketThreadOut(TicketMineOut):
    messages: list[TicketMessageOut] = []


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
    last_message_at: datetime | None = None
    awaiting_staff: bool = True
    reply_count: int = 0

    model_config = {"from_attributes": True}


class StaffTicketThreadOut(TicketOut):
    messages: list[StaffTicketMessageOut] = []
    # Shown beside the reply box so an operator knows whether their answer will
    # also be emailed, or only land in the in-app inbox.
    reporter_email: str | None = None
