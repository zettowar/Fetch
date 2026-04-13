from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class EntitlementOut(BaseModel):
    id: UUID
    entitlement_key: str
    source: str
    expires_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ManualGrantRequest(BaseModel):
    user_id: UUID
    entitlement_key: str
    source: str = "manual_grant"


class PremiumStatus(BaseModel):
    is_premium: bool
    entitlement: str | None = None
