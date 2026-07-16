import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.config import settings

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# Pre-computed hash used to equalize login timing when no account matches, so a
# non-existent email can't be distinguished from a wrong password by how long
# the response takes (bcrypt verify is the dominant cost on the happy path).
DUMMY_PASSWORD_HASH = pwd_ctx.hash("timing-equalization-placeholder")


def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)


def verify_password(plain: str, hashed: str | None) -> bool:
    # SSO-only accounts have no password (password_hash is NULL) — never a match.
    if not hashed:
        return False
    return pwd_ctx.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_TTL_MIN)
    payload = {"sub": subject, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# --- OAuth / SSO ---

def generate_handoff_token() -> str:
    """One-time code the browser trades for real tokens after an SSO round-trip
    (so tokens never appear in a URL)."""
    return secrets.token_urlsafe(32)


def hash_handoff_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_signed_state(payload: dict, ttl_seconds: int = 600) -> str:
    """Signed, expiring CSRF state carried through the OAuth redirect."""
    expire = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    return jwt.encode(
        {**payload, "exp": expire, "type": "oauth_state"},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_signed_state(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "oauth_state":
            return None
        return payload
    except jwt.PyJWTError:
        return None
