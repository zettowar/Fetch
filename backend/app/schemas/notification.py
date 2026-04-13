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
    weekly_winner: bool = True
    comments_on_dogs: bool = True
    new_followers: bool = True
    digest_mode: str = "off"

    model_config = {"from_attributes": True}


class NotificationPrefsUpdate(BaseModel):
    lost_dog_alerts: bool | None = None
    weekly_winner: bool | None = None
    comments_on_dogs: bool | None = None
    new_followers: bool | None = None
    digest_mode: str | None = None
