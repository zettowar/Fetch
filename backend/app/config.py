from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://fetch:fetch@db:5432/fetch"
    JWT_SECRET: str = "change-me-in-production"
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

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
