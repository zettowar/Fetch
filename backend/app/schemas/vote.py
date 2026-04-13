from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class VoteCreate(BaseModel):
    dog_id: UUID
    value: int

    @field_validator("value")
    @classmethod
    def value_valid(cls, v: int) -> int:
        if v not in (1, -1):
            raise ValueError("Value must be 1 (like) or -1 (pass)")
        return v


class VoteOut(BaseModel):
    id: UUID
    voter_id: UUID
    dog_id: UUID
    value: int
    week_bucket: date
    created_at: datetime

    model_config = {"from_attributes": True}
