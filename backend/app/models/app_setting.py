import uuid

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class AppSetting(Base, UUIDPrimaryKey, TimestampMixin):
    """Runtime, admin-editable configuration — the DB-backed complement to the
    env-var `Settings`. Read through `app.services.settings_service.get_setting`
    (cached) so hot paths don't hit the DB per request. One row per key."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    # Arbitrary JSON so a flag can be a bool, number, string, or object.
    value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
