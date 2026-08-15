import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Notification(Base, UUIDPrimaryKey, TimestampMixin):
    """One inbox entry. Title/body/link are rendered at emission time so the
    list endpoint and the client stay dumb; no FKs to the subject entities,
    so deleting a pet or comment never orphans or cascades the inbox."""

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "read_at"),
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # follow | comment | sighting | transfer_received | transfer_resolved |
    # inquiry_received | inquiry_status | weekly_winner | photo_moderated
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    # In-app path (/app/...) the entry links to.
    link: Mapped[str | None] = mapped_column(String(300), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", foreign_keys=[user_id])


class PushSubscription(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "push_subscriptions"
    __table_args__ = (
        UniqueConstraint("user_id", "endpoint", name="uq_push_sub_user_endpoint"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh: Mapped[str] = mapped_column(Text, nullable=False)
    auth: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user = relationship("User", foreign_keys=[user_id])


class NotificationPreference(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "notification_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True,
    )
    lost_dog_alerts: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Admin broadcasts are commercial electronic messages, so they need their
    # own opt-out that the one-click unsubscribe link can flip.
    announcement_emails: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, server_default="true"
    )
    weekly_winner: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    comments_on_dogs: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    new_followers: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    digest_mode: Mapped[str] = mapped_column(
        String(20), default="off", nullable=False
    )  # off | daily | weekly

    user = relationship("User", foreign_keys=[user_id])
