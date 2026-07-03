from sqlalchemy import Boolean, Column, ForeignKey, Index, String, Table, UniqueConstraint
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
    Index("ix_dog_breeds_breed_id", "breed_id"),
)


class Breed(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "breeds"
    # The initial migration created both a unique constraint (column-level
    # unique=True) and the explicit ix_breeds_slug unique index; declare both
    # so the migrated schema and create_all agree.
    __table_args__ = (
        UniqueConstraint("slug"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    group: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    dogs = relationship("Dog", secondary=dog_breeds, back_populates="breeds")
