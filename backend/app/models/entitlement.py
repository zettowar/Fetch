import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Entitlement(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "entitlements"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    entitlement_key: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )  # e.g. "ads_removed", "premium"
    source: Mapped[str] = mapped_column(
        String(200), nullable=False
    )  # e.g. "stripe_sub_xxx", "manual_grant", "beta_tester"
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
