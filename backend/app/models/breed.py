from sqlalchemy import Boolean, Column, ForeignKey, Index, String, Table, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


pet_breeds = Table(
    "pet_breeds",
    Base.metadata,
    Column(
        "pet_id",
        UUID(as_uuid=True),
        ForeignKey("pets.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "breed_id",
        UUID(as_uuid=True),
        ForeignKey("breeds.id", ondelete="RESTRICT"),
        primary_key=True,
    ),
    Index("ix_pet_breeds_breed_id", "breed_id"),
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
    # Which species this breed belongs to ("dog" | "cat"). Breed lists are
    # filtered by species, and a pet's breeds must match its own species.
    species: Mapped[str] = mapped_column(
        String(20), nullable=False, default="dog", server_default="dog", index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    pets = relationship("Pet", secondary=pet_breeds, back_populates="breeds")
