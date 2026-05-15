"""Adoption inquiry — submitted by a prospective adopter to a rescue.

A user lands on a rescue profile and submits the form. The rescue then sees
the inquiry on their dashboard and can change status (new → contacted → closed).
"""
import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


ADOPTION_INQUIRY_STATUSES = ("new", "contacted", "closed")


class AdoptionInquiry(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "adoption_inquiries"

    rescue_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rescue_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dog_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dogs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Whoever signed in when submitting. Anonymous inquiries are not allowed.
    inquirer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[str] = mapped_column(
        String(20), default="new", server_default="new", nullable=False
    )

    rescue = relationship("RescueProfile")
    dog = relationship("Dog")
    inquirer = relationship("User")
