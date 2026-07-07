from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, model_validator


class PetTransferCreate(BaseModel):
    """Rescue initiates a transfer. Provide either a target_user_id (they
    already have Fetch) or invited_email (we'll match on signup)."""
    target_user_id: UUID | None = None
    invited_email: EmailStr | None = None

    @model_validator(mode="after")
    def one_of(self) -> "PetTransferCreate":
        if not self.target_user_id and not self.invited_email:
            raise ValueError("Provide target_user_id or invited_email")
        if self.target_user_id and self.invited_email:
            raise ValueError("Provide only one of target_user_id or invited_email")
        return self


class PetTransferOut(BaseModel):
    id: UUID
    pet_id: UUID
    pet_name: str | None = None
    pet_photo_url: str | None = None
    from_user_id: UUID
    from_rescue_name: str | None = None
    to_user_id: UUID | None = None
    invited_email: str | None = None
    status: str
    expires_at: datetime
    responded_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
