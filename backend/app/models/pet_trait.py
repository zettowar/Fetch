import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class PetTrait(Base, UUIDPrimaryKey, TimestampMixin):
    """The personality-trait vocabulary: the chips the pet editor suggests, plus
    the review queue for the free-form ones owners type in themselves.

    Pets store trait *labels* denormalized in `pets.traits` (a text array), not
    foreign keys — so this table is the canonical spelling and moderation state
    for a label, not its only home. Renaming or deleting a row here has to
    rewrite the label across `pets.traits` too (see `services/traits.py`).
    """

    __tablename__ = "pet_traits"

    # Display text, e.g. "Good with kids". Element type of `pets.traits` is
    # String(50), so a label can never be longer than one of its slots.
    label: Mapped[str] = mapped_column(String(50), nullable=False)
    # Normalized dedup key — "Good With Kids" and "good with kids" collapse to
    # one row rather than becoming two near-identical chips.
    slug: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    # "dog" | "cat" | "both" — which species' editors suggest this chip. It
    # scopes *suggestions* only; a label already on a pet is never stripped for
    # being off-species.
    species: Mapped[str] = mapped_column(
        String(20), nullable=False, default="both", server_default="both", index=True
    )
    # "approved" = suggested to everyone; "pending" = owner-submitted, waiting
    # on Admin → Traits; "rejected" = kept as a tombstone so the next owner who
    # types it gets turned down instead of silently re-opening the queue item.
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", server_default="pending", index=True
    )
    # Lower sorts first; ties break alphabetically. Lets an admin float the
    # traits worth picking to the front of the chip list.
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    # Who first typed it. NULL for the seeded vocabulary and for admin-created
    # traits whose author has since deleted their account.
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
