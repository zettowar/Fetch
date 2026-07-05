from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


JWT_SECRET_PLACEHOLDER = "change-me-in-production"
JWT_SECRET_MIN_LEN = 32


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"  # development | staging | production
    DATABASE_URL: str = "postgresql+asyncpg://fetch:fetch@db:5432/fetch"
    JWT_SECRET: str = JWT_SECRET_PLACEHOLDER
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_TTL_MIN: int = 15
    REFRESH_TOKEN_TTL_DAYS: int = 30
    STORAGE_BACKEND: str = "local"
    STORAGE_LOCAL_PATH: str = "/app/uploads"
    CORS_ORIGINS: str = "http://localhost:3174"
    RATE_LIMIT_ENABLED: bool = True
    # Beta gate: when True, /auth/signup requires an unused invite code
    # (admin-generated). Rescue signups stay open — they are approval-gated.
    INVITE_REQUIRED: bool = False
    # How many invite codes each member can mint for friends (lifetime).
    # 0 disables member invites entirely.
    MEMBER_INVITE_ALLOWANCE: int = 3

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

    # Transactional email via Resend's HTTPS API (no SMTP — works on hosts
    # that block outbound SMTP, e.g. DigitalOcean). Empty key = email
    # disabled: sends are logged and skipped, and email-dependent endpoints
    # degrade explicitly (contact relay returns 503, reset/verify fall back
    # to the DEBUG_* dev flows).
    RESEND_API_KEY: str = ""
    # Sender in "Name <addr>" form. The resend.dev sandbox sender works
    # without DNS setup but only delivers to your own Resend account email;
    # switch to a verified domain before launch.
    EMAIL_FROM: str = "Fetch <onboarding@resend.dev>"
    EMAIL_TIMEOUT_S: int = 10
    # Absolute origin used to build links inside emails.
    FRONTEND_BASE_URL: str = "http://localhost:3174"

    # Password reset (set to True in dev/staging to return token in response)
    RESET_TOKEN_TTL_MIN: int = 30
    DEBUG_RESET_TOKEN: bool = False

    # Email verification
    VERIFICATION_TOKEN_TTL_HOURS: int = 48
    DEBUG_VERIFY_TOKEN: bool = False

    # Donations via Stripe Checkout. Empty STRIPE_SECRET_KEY = donations
    # disabled: /donations endpoints return 503 and the UI shows the rescues'
    # external donation links only (same degrade-explicitly pattern as email).
    STRIPE_SECRET_KEY: str = ""
    # Signing secret for the platform webhook endpoint (whsec_...).
    STRIPE_WEBHOOK_SECRET: str = ""
    # Signing secret for the optional Connect (connected-accounts) webhook
    # endpoint — used for account.updated. Connect status also self-heals via
    # sync-on-read, so this may stay empty.
    STRIPE_CONNECT_WEBHOOK_SECRET: str = ""
    STRIPE_TIMEOUT_S: int = 20
    # Percent of a rescue donation kept by the platform (0 = pass everything
    # through). Applied as a Stripe application fee on destination charges.
    DONATION_PLATFORM_FEE_PERCENT: float = 0.0
    # Preset amounts offered in the UI, in cents, comma-separated.
    DONATION_PRESETS: str = "500,1000,2500,5000"
    DONATION_MIN_CENTS: int = 100
    DONATION_MAX_CENTS: int = 10_000_00

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

    @field_validator("CORS_ORIGINS")
    @classmethod
    def no_wildcard_origin(cls, v: str) -> str:
        # We respond with allow_credentials=True; a "*" origin is invalid per the
        # CORS spec and would be an exfiltration risk if a browser honored it.
        if "*" in [o.strip() for o in v.split(",")]:
            raise ValueError(
                "CORS_ORIGINS cannot contain '*' because credentials are allowed. "
                "List explicit origins instead."
            )
        return v

    @model_validator(mode="after")
    def no_debug_tokens_in_production(self) -> "Settings":
        if self.ENVIRONMENT.lower() == "production" and (
            self.DEBUG_RESET_TOKEN or self.DEBUG_VERIFY_TOKEN
        ):
            raise ValueError(
                "DEBUG_RESET_TOKEN / DEBUG_VERIFY_TOKEN must be False in "
                "production — they leak password-reset/verification tokens in API "
                "responses."
            )
        return self

    @model_validator(mode="after")
    def stripe_settings_sane(self) -> "Settings":
        if not 0 <= self.DONATION_PLATFORM_FEE_PERCENT <= 100:
            raise ValueError("DONATION_PLATFORM_FEE_PERCENT must be between 0 and 100.")
        if (
            self.ENVIRONMENT.lower() == "production"
            and self.STRIPE_SECRET_KEY
            and not self.STRIPE_WEBHOOK_SECRET
        ):
            # Without the webhook, payments would be taken but donations would
            # never be confirmed — they'd sit "pending" forever.
            raise ValueError(
                "STRIPE_WEBHOOK_SECRET is required in production when "
                "STRIPE_SECRET_KEY is set."
            )
        return self


settings = Settings()
