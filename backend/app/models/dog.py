import uuid
from datetime import date

from sqlalchemy import ARRAY, Boolean, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Dog(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "dogs"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    breed: Mapped[str | None] = mapped_column(String(100), nullable=True)
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    bio: Mapped[str | None] = mapped_column(String(500), nullable=True)
    location_rough: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tag_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    primary_photo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    traits: Mapped[list[str]] = mapped_column(ARRAY(String(50)), default=list, nullable=False, server_default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    owner = relationship("User", back_populates="dogs")
    photos = relationship("Photo", back_populates="dog", cascade="all, delete-orphan")
