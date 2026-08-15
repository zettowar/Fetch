from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


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
    digest_mode: str | None = None


class NotificationOut(BaseModel):
    id: UUID
    type: str
    title: str
    body: str | None = None
    link: str | None = None
    read_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
