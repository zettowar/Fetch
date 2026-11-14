from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, model_validator

from app.schemas.common import reject_explicit_nulls


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class PushSubscriptionOut(BaseModel):
    id: UUID
    endpoint: str
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationPrefsOut(BaseModel):
    lost_dog_alerts: bool = True
    announcement_emails: bool = True
    weekly_winner: bool = True
    # Governs the weekly recap EMAIL only; the in-app entry always lands.
    weekly_recap: bool = True
    comments_on_dogs: bool = True
    new_followers: bool = True
    digest_mode: str = "off"

    model_config = {"from_attributes": True}


class NotificationPrefsUpdate(BaseModel):
    lost_dog_alerts: bool | None = None
    announcement_emails: bool | None = None
    weekly_winner: bool | None = None
    weekly_recap: bool | None = None
    comments_on_dogs: bool | None = None
    new_followers: bool | None = None
    # The three values the digest job understands. As a bare `str` anything
    # was stored (and silently never matched), and over 20 chars was a 500.
    digest_mode: Literal["off", "daily", "weekly"] | None = None

    @model_validator(mode="after")
    def no_null_preferences(self) -> "NotificationPrefsUpdate":
        # Every preference column is NOT NULL: omit a field to leave it alone.
        reject_explicit_nulls(
            self, "lost_dog_alerts", "announcement_emails", "weekly_winner",
            "weekly_recap", "comments_on_dogs", "new_followers", "digest_mode",
        )
        return self


class NotificationOut(BaseModel):
    id: UUID
    type: str
    title: str
    body: str | None = None
    link: str | None = None
    read_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
