import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class UserIdentity(Base, UUIDPrimaryKey, TimestampMixin):
    """A linked external identity (Google, GitHub, …) for a user.

    One row per (provider, provider_account_id) — that pair is the stable key an
    SSO login resolves on. `email` is a snapshot for display/debugging only; the
    account link is keyed on the provider's immutable account id, not the email.
    """

    __tablename__ = "user_identities"
    __table_args__ = (
        UniqueConstraint("provider", "provider_account_id", name="uq_identity_provider_account"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # google | github | ...
    provider_account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
