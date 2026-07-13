import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


# Audience segments a broadcast can target. Kept in code (not the DB) because
# each maps to a query the fan-out task runs.
ANNOUNCEMENT_SEGMENTS = ("all", "active", "with_pets", "rescues", "staff")


class Announcement(Base, UUIDPrimaryKey, TimestampMixin):
    """An admin broadcast. Creating one fans out an inbox `Notification` to
    every user in `segment` (via a Celery task) and optionally emails them.
    The row itself is the send history / audit record."""

    __tablename__ = "announcements"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    link: Mapped[str | None] = mapped_column(String(300), nullable=True)
    segment: Mapped[str] = mapped_column(String(20), nullable=False)
    send_email: Mapped[bool] = mapped_column(
        default=False, nullable=False, server_default="false",
    )
    # Rough fan-out size, filled in by the dispatch task when it completes.
    recipient_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Set NULL so the history survives the sender's account deletion.
    sent_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
