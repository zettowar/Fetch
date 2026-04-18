from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    location_rough: str | None = None
    date_of_birth: date | None = None
    is_verified: bool
    role: str
    show_adoption_prompt: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name: str | None = None
    location_rough: str | None = None
    date_of_birth: date | None = None
    show_adoption_prompt: bool | None = None
