import uuid

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class Follow(Base, UUIDPrimaryKey, TimestampMixin):
    """Users follow dogs (not other users)."""

    __tablename__ = "follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "dog_id", name="uq_follow"),
    )

    follower_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    dog_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dogs.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    follower = relationship("User", foreign_keys=[follower_id])
    dog = relationship("Dog", foreign_keys=[dog_id])


class Block(Base, UUIDPrimaryKey, TimestampMixin):
    """blocker never wants to see or hear from blocked again. Enforced in the
    feed/explore, comments, follows, and the lost-dog contact relay."""

    __tablename__ = "blocks"
    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_block"),
    )

    blocker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    blocked_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    blocker = relationship("User", foreign_keys=[blocker_id])
    blocked = relationship("User", foreign_keys=[blocked_id])


class Comment(Base, UUIDPrimaryKey, TimestampMixin):
    """One-level-deep comments on photos or posts."""

    __tablename__ = "comments"
    __table_args__ = (
        Index("ix_comments_target", "target_type", "target_id"),
    )

    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    target_type: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )  # photo | post
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)

    author = relationship("User", foreign_keys=[author_id])


class Reaction(Base, UUIDPrimaryKey, TimestampMixin):
    """Reactions on photos or posts: like, cute, woof."""

    __tablename__ = "reactions"
    __table_args__ = (
        UniqueConstraint("user_id", "target_type", "target_id", name="uq_reaction"),
        Index("ix_reactions_target", "target_type", "target_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)  # photo | post
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # like | cute | woof

    user = relationship("User", foreign_keys=[user_id])
