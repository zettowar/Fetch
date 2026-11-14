import uuid
from datetime import date, datetime

from sqlalchemy import ARRAY, Boolean, Date, DateTime, ForeignKey, String, or_
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey
from app.models.breed import pet_breeds


MIX_TYPES = ("purebred", "cross", "mixed", "mystery_mutt")

# Supported pet species. The data model is N-species-ready — add a value here
# (and seed its breeds) to extend — while the product surfaces dog + cat only.
SPECIES = ("dog", "cat")


class Pet(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "pets"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    mix_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="mystery_mutt", server_default="mystery_mutt"
    )
    # Discriminator: "dog" | "cat" (see SPECIES). Indexed — the swipe feed and
    # per-species leaderboards filter on it.
    species: Mapped[str] = mapped_column(
        String(20), nullable=False, default="dog", server_default="dog", index=True
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
    # Whether the read-only share page (/pets/{id} on the public site) exists
    # for this pet. Owners can turn it off in the pet editor.
    is_public: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, server_default="true"
    )

    adopted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    adopted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    owner = relationship("User", back_populates="pets", foreign_keys=[owner_id])
    photos = relationship("Photo", back_populates="pet", cascade="all, delete-orphan")
    breeds = relationship("Breed", secondary=pet_breeds, back_populates="pets", order_by="Breed.name")


def pet_in_play():
    """SQL predicate: this pet takes part in the game — the swipe feed,
    Explore, the leaderboard, the weekly crown and the recap.

    `adopted_at` alone cannot decide that, because it is set in two different
    situations. A rescue marking a pet adopted keeps the profile on the
    rescue's account as a finished story: out of play. A rescue *transferring*
    a pet to its new family also stamps `adopted_at` (it is the pet's adoption
    date), but that pet now belongs to an ordinary member who is here to play
    — and every query that filtered on `adopted_at IS NULL` shut it out for
    good: never in a deck, never ranked, never able to win.

    The two cases differ in who owns the pet: a transferred pet is owned by
    the person who adopted it.
    """
    return or_(Pet.adopted_at.is_(None), Pet.adopted_by_user_id == Pet.owner_id)
