import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class InviteCode(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "invite_codes"

    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    # Set when the code was minted for one specific person (currently: a rescue
    # transferring a pet to an adopter who has no account yet). Signup then
    # refuses the code for any other address, so a targeted invite can't be
    # forwarded to bypass the beta gate. Null = a general code, usable by
    # whoever holds it, which is how admin- and member-minted codes work.
    invited_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    used_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class WaitlistEntry(Base, UUIDPrimaryKey, TimestampMixin):
    """A pre-launch invite request from the marketing site (no account yet)."""

    __tablename__ = "waitlist_entries"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    # Which surface the signup came from (hero / closing / news) — for
    # judging which placement converts, nothing more.
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Set when an admin one-click-invites this person: the moment they were
    # invited and the invite code we minted + emailed them (matches a row in
    # invite_codes). Null = not yet invited.
    invited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    invite_code: Mapped[str | None] = mapped_column(String(50), nullable=True)


class Feedback(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "feedback"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    screen_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
