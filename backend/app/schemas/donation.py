from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, field_validator, model_validator

from app.config import settings


class DonationConfig(BaseModel):
    """What the client needs to render the donate UI."""
    enabled: bool
    currency: str = "usd"
    presets_cents: list[int]
    min_cents: int
    max_cents: int
    platform_fee_percent: float


class DonationCheckoutRequest(BaseModel):
    amount_cents: int
    recipient_type: Literal["platform", "rescue"]
    rescue_id: UUID | None = None
    message: str | None = None

    @field_validator("amount_cents")
    @classmethod
    def amount_in_bounds(cls, v: int) -> int:
        if not settings.DONATION_MIN_CENTS <= v <= settings.DONATION_MAX_CENTS:
            raise ValueError(
                f"Amount must be between {settings.DONATION_MIN_CENTS} and "
                f"{settings.DONATION_MAX_CENTS} cents"
            )
        return v

    @field_validator("message")
    @classmethod
    def trim_message(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 280:
            raise ValueError("Message must be 280 characters or fewer")
        return v or None

    @model_validator(mode="after")
    def rescue_id_iff_rescue(self) -> "DonationCheckoutRequest":
        if self.recipient_type == "rescue" and self.rescue_id is None:
            raise ValueError("rescue_id is required for rescue donations")
        if self.recipient_type == "platform" and self.rescue_id is not None:
            raise ValueError("rescue_id must be omitted for platform donations")
        return self


class DonationCheckoutResponse(BaseModel):
    donation_id: UUID
    checkout_url: str


class DonationOut(BaseModel):
    id: UUID
    recipient_type: str
    rescue_id: UUID | None = None
    recipient_name: str
    amount_cents: int
    currency: str
    status: str
    message: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConnectStatusOut(BaseModel):
    """Rescue's Stripe Connect onboarding state."""
    has_account: bool
    charges_enabled: bool
    details_submitted: bool | None = None
