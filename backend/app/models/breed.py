from sqlalchemy import Boolean, Column, ForeignKey, String, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


dog_breeds = Table(
    "dog_breeds",
    Base.metadata,
    Column(
        "dog_id",
        UUID(as_uuid=True),
        ForeignKey("dogs.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "breed_id",
        UUID(as_uuid=True),
        ForeignKey("breeds.id", ondelete="RESTRICT"),
        primary_key=True,
    ),
)


class Breed(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "breeds"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    group: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    dogs = relationship("Dog", secondary=dog_breeds, back_populates="breeds")
