import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class WeeklyWinner(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "weekly_winners"
    # One crown per species per week (Top Dog AND Top Cat). Replaces the old
    # single global winner (week_bucket was UNIQUE on its own).
    __table_args__ = (
        UniqueConstraint("week_bucket", "species", name="uq_weekly_winner_week_species"),
    )

    week_bucket: Mapped[date] = mapped_column(Date, nullable=False)
    species: Mapped[str] = mapped_column(
        String(20), nullable=False, default="dog", server_default="dog"
    )
    pet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pets.id", ondelete="SET NULL"), nullable=True
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
