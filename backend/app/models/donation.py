import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


DONATION_STATUSES = ("pending", "succeeded", "failed", "refunded")
DONATION_RECIPIENT_TYPES = ("platform", "rescue")


class Donation(Base, UUIDPrimaryKey, TimestampMixin):
    """One Stripe Checkout donation, platform- or rescue-bound.

    Donor/rescue FKs are SET NULL so financial records outlive account
    deletion; recipient_name snapshots the display name for the same reason —
    render from it, never by joining.
    """

    __tablename__ = "donations"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    recipient_type: Mapped[str] = mapped_column(String(20), nullable=False)  # platform | rescue
    rescue_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rescue_profiles.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    recipient_name: Mapped[str] = mapped_column(String(200), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="usd", nullable=False)
    application_fee_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True
    )  # pending | succeeded | failed | refunded
    stripe_checkout_session_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )  # set on success; refund webhooks look donations up by it
    message: Mapped[str | None] = mapped_column(String(280), nullable=True)

    donor = relationship("User", foreign_keys=[user_id])
    rescue = relationship("RescueProfile", foreign_keys=[rescue_id])


class StripeEvent(Base, UUIDPrimaryKey, TimestampMixin):
    """Processed webhook event ids — the replay/idempotency ledger."""

    __tablename__ = "stripe_events"

    event_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    type: Mapped[str] = mapped_column(String(60), nullable=False)
