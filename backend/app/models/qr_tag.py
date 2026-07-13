import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class QRTag(Base, UUIDPrimaryKey, TimestampMixin):
    """A pre-generated QR tag. Admins mint a batch (each with a printable
    `code`); the physical tag is later linked to a specific pet by its owner or
    an admin. Scanning `/t/{code}` resolves to the linked pet's public page.

    A tag with `pet_id` NULL is printed-but-unassigned. `pet_id` is SET NULL on
    pet deletion, so a tag returns to the unassigned pool if its pet is removed.
    """

    __tablename__ = "qr_tags"

    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)
    pet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    pet = relationship("Pet", foreign_keys=[pet_id])
