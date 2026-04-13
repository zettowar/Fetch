from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


# --- Follows ---

class FollowOut(BaseModel):
    id: UUID
    follower_id: UUID
    dog_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class FollowToggle(BaseModel):
    dog_id: UUID


# --- Comments ---

class CommentCreate(BaseModel):
    target_type: str
    target_id: UUID
    body: str

    @field_validator("target_type")
    @classmethod
    def valid_target(cls, v: str) -> str:
        if v not in ("photo", "post", "dog"):
            raise ValueError("target_type must be 'photo', 'post', or 'dog'")
        return v

    @field_validator("body")
    @classmethod
    def body_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Comment body is required")
        if len(v) > 1000:
            raise ValueError("Comment must be 1000 characters or less")
        return v.strip()


class CommentOut(BaseModel):
    id: UUID
    author_id: UUID
    author_name: str | None = None
    target_type: str
    target_id: UUID
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Reactions ---

class ReactionToggle(BaseModel):
    target_type: str
    target_id: UUID
    kind: str

    @field_validator("target_type")
    @classmethod
    def valid_target(cls, v: str) -> str:
        if v not in ("photo", "post", "dog"):
            raise ValueError("target_type must be 'photo', 'post', or 'dog'")
        return v

    @field_validator("kind")
    @classmethod
    def valid_kind(cls, v: str) -> str:
        if v not in ("like", "cute", "woof"):
            raise ValueError("kind must be 'like', 'cute', or 'woof'")
        return v


class ReactionCounts(BaseModel):
    like: int = 0
    cute: int = 0
    woof: int = 0
    user_reaction: str | None = None  # What the current user reacted with


# --- User Profile ---

class UserProfileOut(BaseModel):
    id: UUID
    display_name: str
    location_rough: str | None = None
    created_at: datetime
    dog_count: int = 0
    follower_count: int = 0

    model_config = {"from_attributes": True}
