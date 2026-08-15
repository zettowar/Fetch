import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class FAQEntry(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "faq_entries"

    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class SupportTicket(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "support_tickets"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    source_screen: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="open", nullable=False, index=True
    )  # open | in_progress | resolved | closed
    ticket_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Internal triage note. NEVER reaches the reporter — that is what
    # SupportTicketMessage is for. The two are deliberately separate fields so
    # "this one is a scammer" and "here is your answer" cannot be confused for
    # one another by an operator in a hurry.
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Denormalised from the message thread so the queue can sort and filter
    # without a correlated subquery per row. Both are written in exactly two
    # places: SupportTicketMessage creation on the user side and on the staff
    # side. `last_message_at` starts at the ticket's own creation because the
    # opening body is the first message in the thread (see below).
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # True when the ball is in support's court. A brand-new ticket qualifies:
    # nobody has answered it yet. Any staff reply or status change clears it.
    awaiting_staff: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )
    # Watermark for the reporter's unread badge. Null = they have not opened the
    # thread since it grew, which is the correct default for a ticket that was
    # answered before this column existed.
    reporter_last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user = relationship("User", foreign_keys=[user_id])


class SupportTicketMessage(Base, UUIDPrimaryKey, TimestampMixin):
    """One reply in a ticket conversation.

    The ticket's own `body` is the opening message and is NOT copied in here —
    the thread a client renders is `[ticket.body] + messages`. Duplicating it
    would mean two sources of truth for the same paragraph and a backfill that
    could only ever drift.

    `author_role` rather than "is this user an admin right now": staff roles
    change, accounts get deleted, and a reply must keep reading as a reply from
    support five years after the person who wrote it left.
    """

    __tablename__ = "support_ticket_messages"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("support_tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # SET NULL, not CASCADE: deleting a staff account must not silently delete
    # half of a conversation the reporter can still see.
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    author_role: Mapped[str] = mapped_column(String(10), nullable=False)  # user | staff
    body: Mapped[str] = mapped_column(Text, nullable=False)

    author = relationship("User", foreign_keys=[author_id])
