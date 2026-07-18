import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class NewsPost(Base, UUIDPrimaryKey, TimestampMixin):
    """A marketing-site news article, managed from the admin panel.

    Drafts (is_published=false) are visible only to admins; publishing stamps
    published_at, which drives both public ordering and the displayed
    month-year chip (editable afterwards for backdating).
    """

    __tablename__ = "news_posts"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    tag: Mapped[str] = mapped_column(String(50), nullable=False)
    # Optional trailing CTA link; a relative path renders as an internal link
    # on the site, an http(s) URL as an external one.
    link_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    link_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false",
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # SET NULL so the article survives the author's account deletion.
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
