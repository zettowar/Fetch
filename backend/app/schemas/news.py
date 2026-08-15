from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.urls import normalise_url


class NewsPostCreate(BaseModel):
    title: str = Field(..., max_length=200)
    body: str = Field(..., max_length=10000)
    tag: str = Field(default="Update", max_length=50)
    link_url: str | None = Field(default=None, max_length=300)
    link_label: str | None = Field(default=None, max_length=100)
    is_published: bool = True

    @field_validator("title", "body")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field is required")
        return v.strip()

    # Rendered straight into an <a href> on the public news page.
    @field_validator("link_url")
    @classmethod
    def clean_link(cls, v: str | None) -> str | None:
        return normalise_url(v)


class NewsPostUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    body: str | None = Field(default=None, max_length=10000)
    tag: str | None = Field(default=None, max_length=50)
    link_url: str | None = Field(default=None, max_length=300)
    link_label: str | None = Field(default=None, max_length=100)
    is_published: bool | None = None
    published_at: datetime | None = None

    @field_validator("link_url")
    @classmethod
    def clean_link(cls, v: str | None) -> str | None:
        return normalise_url(v)


class NewsPostOut(BaseModel):
    id: UUID
    title: str
    body: str
    tag: str
    link_url: str | None = None
    link_label: str | None = None
    is_published: bool
    published_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
