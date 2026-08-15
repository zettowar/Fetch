from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.schemas.urls import normalise_url


class VetCreate(BaseModel):
    name: str
    address: str | None = None
    lat: float
    lng: float
    phone: str | None = None
    website: str | None = None
    hours: str | None = None
    attributes: dict | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name is required")
        return v.strip()


class VetUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    hours: str | None = None
    attributes: dict | None = None
    verified: bool | None = None

    @field_validator("website")
    @classmethod
    def clean_website(cls, v: str | None) -> str | None:
        return normalise_url(v)


class VetOut(BaseModel):
    id: UUID
    name: str
    address: str | None = None
    lat: float
    lng: float
    phone: str | None = None
    website: str | None = None
    hours: str | None = None
    verified: bool
    attributes: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
