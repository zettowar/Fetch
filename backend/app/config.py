from pydantic import field_validator
from pydantic_settings import BaseSettings


JWT_SECRET_PLACEHOLDER = "change-me-in-production"
JWT_SECRET_MIN_LEN = 32


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://fetch:fetch@db:5432/fetch"
    JWT_SECRET: str = JWT_SECRET_PLACEHOLDER
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_TTL_MIN: int = 15
    REFRESH_TOKEN_TTL_DAYS: int = 30
    STORAGE_BACKEND: str = "local"
    STORAGE_LOCAL_PATH: str = "/app/uploads"
    CORS_ORIGINS: str = "http://localhost:3174"
    RATE_LIMIT_ENABLED: bool = True

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # Observability
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    # Moderation (Sightengine)
    SIGHTENGINE_API_USER: str = ""
    SIGHTENGINE_API_SECRET: str = ""
    MODERATION_TIMEOUT_S: int = 10

    # Password reset (set to True in dev/staging to return token in response)
    RESET_TOKEN_TTL_MIN: int = 30
    DEBUG_RESET_TOKEN: bool = False

    # Email verification
    VERIFICATION_TOKEN_TTL_HOURS: int = 48
    DEBUG_VERIFY_TOKEN: bool = False

    model_config = {"env_file": ".env", "extra": "ignore"}

    @field_validator("JWT_SECRET")
    @classmethod
    def strong_jwt_secret(cls, v: str) -> str:
        if v == JWT_SECRET_PLACEHOLDER:
            raise ValueError(
                "JWT_SECRET is set to the default placeholder. "
                "Set it to a unique value of at least 32 characters in your .env."
            )
        if len(v) < JWT_SECRET_MIN_LEN:
            raise ValueError(
                f"JWT_SECRET must be at least {JWT_SECRET_MIN_LEN} characters "
                f"(got {len(v)})."
            )
        return v


settings = Settings()
