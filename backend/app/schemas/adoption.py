from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


VALID_STATUSES = {"new", "contacted", "closed"}


class AdoptionInquiryCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    message: str
    pet_id: UUID | None = None

    @field_validator("name", "message")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Required")
        return v

    @field_validator("message")
    @classmethod
    def message_max(cls, v: str) -> str:
        if len(v) > 2000:
            raise ValueError("Message must be 2000 characters or less")
        return v

    @field_validator("phone", mode="before")
    @classmethod
    def normalise_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        return v or None


class AdoptionInquiryStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_STATUSES)}")
        return v


class AdoptionInquiryOut(BaseModel):
    id: UUID
    rescue_id: UUID
    pet_id: UUID | None = None
    inquirer_id: UUID
    name: str
    email: str
    phone: str | None = None
    message: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
