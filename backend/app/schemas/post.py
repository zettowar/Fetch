from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class PostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=10_000)
    kind: str = "community"
    tags: list[str] | None = None

    @field_validator("kind")
    @classmethod
    def valid_kind(cls, v: str) -> str:
        if v not in ("community", "sponsor", "rescue_spotlight"):
            raise ValueError("kind must be community, sponsor, or rescue_spotlight")
        return v


class PostOut(BaseModel):
    id: UUID
    author_id: UUID
    author_name: str | None = None
    kind: str
    title: str
    body: str
    tags: list[str] | None = None
    pinned: bool
    created_at: datetime

    model_config = {"from_attributes": True}
