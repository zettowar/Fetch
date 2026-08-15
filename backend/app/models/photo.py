import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Photo(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "photos"

    pet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Unique-indexed: the public file endpoint looks photos up by key on
    # every image request.
    storage_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Indexed: the feed's "pets with an approved photo" subquery and the admin
    # flagged-review queue both filter on this across every photo row.
    moderation_status: Mapped[str] = mapped_column(
        String(20), default="approved", nullable=False, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    pet = relationship("Pet", back_populates="photos")
