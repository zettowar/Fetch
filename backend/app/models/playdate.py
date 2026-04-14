import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class PlayDate(Base, UUIDPrimaryKey, TimestampMixin):
    """A scheduled meetup at a park."""

    __tablename__ = "play_dates"

    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    park_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parks.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_for: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="scheduled", nullable=False
    )  # scheduled | cancelled

    host = relationship("User", foreign_keys=[host_id])
    park = relationship("Park", foreign_keys=[park_id])
    rsvps = relationship(
        "PlayDateRsvp", back_populates="playdate", cascade="all, delete-orphan"
    )


class PlayDateRsvp(Base, UUIDPrimaryKey, TimestampMixin):
    """One RSVP per dog per play date."""

    __tablename__ = "play_date_rsvps"
    __table_args__ = (
        UniqueConstraint("playdate_id", "dog_id", name="uq_playdate_rsvp"),
    )

    playdate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("play_dates.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    dog_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dogs.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), default="going", nullable=False
    )  # going | maybe | declined

    playdate = relationship("PlayDate", back_populates="rsvps")
    user = relationship("User", foreign_keys=[user_id])
    dog = relationship("Dog", foreign_keys=[dog_id])
