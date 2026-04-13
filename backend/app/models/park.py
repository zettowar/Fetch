import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Park(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "parks"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    attributes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # attributes: fenced, off_leash_legal, water, shade, small_dog_area, lights, restrooms, parking

    reviews = relationship("ParkReview", back_populates="park", cascade="all, delete-orphan")
    incidents = relationship("ParkIncident", back_populates="park", cascade="all, delete-orphan")


class ParkReview(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "park_reviews"

    park_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parks.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    visit_time_of_day: Mapped[str | None] = mapped_column(String(20), nullable=True)  # morning|afternoon|evening
    crowd_level: Mapped[str | None] = mapped_column(String(20), nullable=True)  # empty|quiet|moderate|busy|packed

    park = relationship("Park", back_populates="reviews")
    author = relationship("User", foreign_keys=[author_id])


class ParkIncident(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "park_incidents"

    park_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parks.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(30), nullable=False)  # aggressive_dog|wildlife|hazard|other
    description: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    park = relationship("Park", back_populates="incidents")
    reporter = relationship("User", foreign_keys=[reporter_id])


class ParkCheckin(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "park_checkins"

    park_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parks.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    park = relationship("Park", foreign_keys=[park_id])
    user = relationship("User", foreign_keys=[user_id])
