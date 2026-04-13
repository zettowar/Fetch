import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class PushSubscription(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "push_subscriptions"

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
    weekly_winner: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    comments_on_dogs: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    new_followers: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    digest_mode: Mapped[str] = mapped_column(
        String(20), default="off", nullable=False
    )  # off | daily | weekly

    user = relationship("User", foreign_keys=[user_id])
