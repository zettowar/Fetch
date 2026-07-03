"""Veterinary clinics — a lightweight directory of nearby vets.

Vets are utility lookups (find a clinic), not social hangouts, so unlike
`Park` we intentionally skip reviews / check-ins / incidents for v1.
"""
import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Vet(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "vets"
    __table_args__ = (
        Index("ix_vets_source_external_id", "source", "external_id"),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    lng: Mapped[float] = mapped_column(Float, nullable=False, index=True)

    # Contact / hours come straight from OSM tags when present.
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Free-text "Mo-Fr 09:00-18:00; Sa 10:00-14:00" style. We don't try to
    # parse OSM's opening_hours grammar — just surface it as-is.
    hours: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # attributes: emergency, open_24_7, house_calls, boarding, grooming
    attributes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Same provenance pattern as Park: 'user' (in-app), 'osm' (Overpass), 'seed'.
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="user", server_default="user",
    )
    external_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
