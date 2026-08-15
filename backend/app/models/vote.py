import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Index, SmallInteger, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Vote(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "votes"
    __table_args__ = (
        UniqueConstraint("voter_id", "pet_id", "week_bucket", name="uq_vote_per_pet_per_week"),
        # Leaderboard, crown and pet-stats all group this week's votes by pet;
        # the single-column week_bucket index still leaves a heap fetch per row.
        Index("ix_votes_week_pet", "week_bucket", "pet_id"),
        # The feed excludes pets this voter already saw this week.
        Index("ix_votes_voter_week", "voter_id", "week_bucket"),
    )

    voter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    value: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1=like, -1=pass
    week_bucket: Mapped[date] = mapped_column(Date, nullable=False, index=True)
