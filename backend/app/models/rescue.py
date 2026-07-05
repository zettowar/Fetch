import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


RESCUE_STATUSES = ("pending", "approved", "rejected")


class RescueProfile(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "rescue_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )
    org_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    donation_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    proof_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Stripe Connect (Express) — in-app donations. charges_enabled mirrors the
    # connected account's state (synced on read + via account.updated webhook).
    stripe_account_id: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True
    )
    stripe_charges_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    user = relationship("User", back_populates="rescue_profile", foreign_keys=[user_id])

    @property
    def donations_enabled(self) -> bool:
        """Can this rescue take in-app donations? Surfaces on public schemas."""
        return bool(self.stripe_account_id) and self.stripe_charges_enabled
