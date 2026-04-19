from pydantic import BaseModel, EmailStr, field_validator

from app.schemas.user import UserOut


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("display_name")
    @classmethod
    def display_name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Display name is required")
        if len(v) > 80:
            raise ValueError("Display name must be 80 characters or fewer")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

    model_config = {"from_attributes": True}


class RescueProfileBrief(BaseModel):
    id: str
    status: str
    org_name: str

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Standard response shape for signup/login."""
    tokens: TokenResponse
    user: UserOut

    model_config = {"from_attributes": True}


class RescueSignupResponse(AuthResponse):
    rescue_profile: RescueProfileBrief


class RefreshResponse(BaseModel):
    tokens: TokenResponse

    model_config = {"from_attributes": True}


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class DetailResponse(BaseModel):
    detail: str

    model_config = {"from_attributes": True}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class VerifyEmailRequest(BaseModel):
    token: str
