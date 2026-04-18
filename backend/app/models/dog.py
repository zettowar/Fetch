import uuid
from datetime import date, datetime

from sqlalchemy import ARRAY, Boolean, Date, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey
from app.models.breed import dog_breeds


MIX_TYPES = ("purebred", "cross", "mixed", "mystery_mutt")


class Dog(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "dogs"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    mix_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="mystery_mutt", server_default="mystery_mutt"
    )
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    bio: Mapped[str | None] = mapped_column(String(500), nullable=True)
    location_rough: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tag_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    primary_photo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    traits: Mapped[list[str]] = mapped_column(ARRAY(String(50)), default=list, nullable=False, server_default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    adopted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    adopted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    owner = relationship("User", back_populates="dogs", foreign_keys=[owner_id])
    photos = relationship("Photo", back_populates="dog", cascade="all, delete-orphan")
    breeds = relationship("Breed", secondary=dog_breeds, back_populates="dogs", order_by="Breed.name")
