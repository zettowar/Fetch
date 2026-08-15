import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class LostReport(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "lost_reports"
    __table_args__ = (
        # Proximity search always narrows to open reports inside a bounding box.
        Index("ix_lost_reports_status_lat_lng", "status", "last_seen_lat", "last_seen_lng"),
    )

    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pets.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # missing | found
    status: Mapped[str] = mapped_column(
        String(20), default="open", nullable=False, index=True
    )  # open | resolved | closed
    # Opt-in public share page. When True, GET /lost/{id} renders a public,
    # crawlable, shareable page (OG tags + Nextdoor/Facebook/X buttons) and the
    # report is listed in sitemap.xml. New reports default True via the create
    # schema + a (pre-checked, explainable) UI toggle; the DB server_default is
    # False so pre-existing rows are NOT retroactively exposed off-platform —
    # the owner has to opt each older report in. Coordinates stay fuzzed either
    # way; this flag only controls whether the shareable page exists at all.
    is_public: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, server_default="false"
    )
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
    pet = relationship("Pet", foreign_keys=[pet_id])
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
    photo_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_content_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    report = relationship("LostReport", back_populates="sightings")
    reporter = relationship("User", foreign_keys=[reporter_id])


class LostReportSubscription(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "lost_report_subscriptions"
    __table_args__ = (
        # create/get/patch all treat this as one-row-per-user and call
        # scalar_one_or_none(), which raises on a second row. Enforce the
        # assumption in the schema rather than hoping.
        UniqueConstraint("user_id", name="uq_lost_sub_user"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    home_lat: Mapped[float] = mapped_column(Float, nullable=False)
    home_lng: Mapped[float] = mapped_column(Float, nullable=False)
    radius_km: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
