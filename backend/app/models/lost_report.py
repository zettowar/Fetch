import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class LostReport(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "lost_reports"

    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dog_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dogs.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # missing | found
    status: Mapped[str] = mapped_column(
        String(20), default="open", nullable=False, index=True
    )  # open | resolved | closed
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_seen_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_fuzz_m: Mapped[int] = mapped_column(Integer, default=500, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    contact_method: Mapped[str] = mapped_column(
        String(20), default="in_app", nullable=False
    )  # in_app | email | phone
    contact_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Relationships
    reporter = relationship("User", foreign_keys=[reporter_id])
    dog = relationship("Dog", foreign_keys=[dog_id])
    photos = relationship("LostReportPhoto", back_populates="report", cascade="all, delete-orphan")
    sightings = relationship(
        "LostReportSighting", back_populates="report", cascade="all, delete-orphan"
    )


class LostReportPhoto(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "lost_report_photos"

    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lost_reports.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False)

    report = relationship("LostReport", back_populates="photos")


class LostReportSighting(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "lost_report_sightings"

    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lost_reports.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    report = relationship("LostReport", back_populates="sightings")
    reporter = relationship("User", foreign_keys=[reporter_id])


class LostReportSubscription(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "lost_report_subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    home_lat: Mapped[float] = mapped_column(Float, nullable=False)
    home_lng: Mapped[float] = mapped_column(Float, nullable=False)
    radius_km: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
