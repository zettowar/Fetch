import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class SwipeAllowance(Base, UUIDPrimaryKey, TimestampMixin):
    """Server-authoritative record of a user's earned bonus swipes for one UTC
    day. The free daily cap is a constant (see services/quota.py); this row only
    tracks reward-ad grants on top of it. Base usage is counted from Vote rows,
    so it can't be reset by clearing client storage."""

    __tablename__ = "swipe_allowances"
    __table_args__ = (
        UniqueConstraint("user_id", "day", name="uq_swipe_allowance_user_day"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    day: Mapped[date] = mapped_column(Date, nullable=False)
    bonus_swipes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    user = relationship("User", foreign_keys=[user_id])
