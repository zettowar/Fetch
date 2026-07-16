"""SSO / OAuth login (Google, GitHub, …).

Flow: /{provider}/start → provider → /{provider}/callback → the SPA gets a
single-use handoff code → POST /exchange returns the normal {tokens, user}
envelope. The whole provider round-trip is same-origin with the backend, so the
signed `oauth_state` cookie (CSRF binding) works regardless of the frontend
origin; the exchange is a normal CORS POST.

Gated by the admin `sso_enabled` flag AND per-provider credentials — off ⇒ 404.
"""
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.limiter import limiter
from app.models.oauth_handoff import OAuthHandoff
from app.models.user import User
from app.models.user_identity import UserIdentity
from app.routers.auth import _create_tokens
from app.schemas.auth import AuthResponse
from app.schemas.user import UserOut
from app.security import (
    create_signed_state,
    decode_signed_state,
    generate_handoff_token,
    hash_handoff_token,
)
from app.services import settings_service
from app.services.oauth import (
    NormalizedIdentity,
    OAuthError,
    enabled_provider_names,
    get_provider,
)

logger = structlog.stdlib.get_logger()
router = APIRouter()

STATE_COOKIE = "oauth_state"
STATE_TTL_S = 600
HANDOFF_TTL_S = 120


def _cookie_secure() -> bool:
    # Secure cookies aren't sent over http, so allow http in dev.
    return settings.ENVIRONMENT.lower() == "production"


def _redirect_uri(provider: str) -> str:
    return f"{settings.OAUTH_REDIRECT_BASE}/api/v1/auth/oauth/{provider}/callback"


def _safe_return(path: str) -> str:
    # Only same-site absolute paths — blocks open redirects / protocol-relative.
    if not path.startswith("/") or path.startswith("//"):
        return "/app/home"
    return path


def _frontend_url(**params: str) -> str:
    query = "&".join(f"{k}={quote(v)}" for k, v in params.items())
    return f"{settings.FRONTEND_BASE_URL}/auth/callback?{query}"


async def _sso_enabled(db: AsyncSession) -> bool:
    return bool(await settings_service.get_setting(db, "sso_enabled"))


async def resolve_oauth_user(db: AsyncSession, identity: NormalizedIdentity) -> User:
    """Map a provider identity to a Fetchpawz user: existing link → that user;
    else verified-email → link to / create the matching account. Raises
    OAuthError for anything we won't sign in."""
    linked = (await db.execute(
        select(UserIdentity).where(
            UserIdentity.provider == identity.provider,
            UserIdentity.provider_account_id == identity.account_id,
        )
    )).scalar_one_or_none()
    if linked is not None:
        user = (await db.execute(
            select(User).where(User.id == linked.user_id)
        )).scalar_one_or_none()
        if not user or not user.is_active:
            raise OAuthError("linked user missing/inactive", "This account is unavailable.")
        if identity.email and linked.email != identity.email:
            linked.email = identity.email  # keep the snapshot fresh
        return user

    # New link — only trust a provider-verified email (blocks takeover via an
    # unverified email claiming someone else's address).
    if not identity.email or not identity.email_verified:
        raise OAuthError(
            "email missing/unverified",
            f"Your {identity.provider.title()} email isn't verified, so we can't sign you in.",
        )
    email = identity.email.lower().strip()

    existing = (await db.execute(
        select(User).where(User.email == email)
    )).scalar_one_or_none()
    if existing is not None:
        if not existing.is_active:
            raise OAuthError("email belongs to inactive user", "This account is unavailable.")
        db.add(UserIdentity(
            user_id=existing.id, provider=identity.provider,
            provider_account_id=identity.account_id, email=identity.email,
        ))
        if not existing.is_verified:
            existing.is_verified = True
        return existing

    # Brand-new user. SSO skips the invite gate but honors the pause switch.
    if await settings_service.get_setting(db, "signups_paused"):
        raise OAuthError("signups paused", "New sign-ups are paused right now.")
    user = User(
        email=email,
        password_hash=None,
        display_name=(identity.display_name or "Fetchpawz user")[:100],
        role="user",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()  # need user.id for the identity + handoff rows
    db.add(UserIdentity(
        user_id=user.id, provider=identity.provider,
        provider_account_id=identity.account_id, email=identity.email,
    ))
    return user


@router.get("/providers")
async def list_providers(db: AsyncSession = Depends(get_db)) -> list[str]:
    """Providers the SPA should show buttons for: configured AND sso_enabled.
    Returns [] when the feature is off, which self-hides the UI."""
    if not await _sso_enabled(db):
        return []
    return enabled_provider_names()


@router.get("/{provider}/start")
@limiter.limit("15/minute")
async def oauth_start(
    request: Request,
    provider: str,
    return_to: str = Query("/app/home", alias="return"),
    db: AsyncSession = Depends(get_db),
):
    if not await _sso_enabled(db):
        raise HTTPException(status_code=404, detail="SSO is not enabled")
    p = get_provider(provider)
    if p is None or not p.enabled():
        raise HTTPException(status_code=404, detail="Unknown or disabled provider")

    state = create_signed_state(
        {"nonce": secrets.token_urlsafe(16), "return_to": _safe_return(return_to), "provider": provider},
        ttl_seconds=STATE_TTL_S,
    )
    resp = RedirectResponse(p.authorize_url(state, _redirect_uri(provider)), status_code=302)
    resp.set_cookie(
        STATE_COOKIE, state, max_age=STATE_TTL_S, httponly=True,
        samesite="lax", secure=_cookie_secure(), path="/api/v1/auth/oauth",
    )
    return resp


@router.get("/{provider}/callback")
@limiter.limit("15/minute")
async def oauth_callback(
    request: Request,
    provider: str,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    def fail(user_message: str) -> RedirectResponse:
        r = RedirectResponse(_frontend_url(error=user_message), status_code=302)
        r.delete_cookie(STATE_COOKIE, path="/api/v1/auth/oauth")
        return r

    if error:
        return fail("Sign-in was cancelled.")
    if not await _sso_enabled(db):
        raise HTTPException(status_code=404, detail="SSO is not enabled")

    # CSRF: the state must be present, match the browser's cookie, and verify.
    cookie_state = request.cookies.get(STATE_COOKIE)
    if not code or not state or not cookie_state or state != cookie_state:
        return fail("Sign-in expired or was tampered with. Please try again.")
    decoded = decode_signed_state(state)
    if not decoded or decoded.get("provider") != provider:
        return fail("Sign-in expired or was tampered with. Please try again.")

    p = get_provider(provider)
    if p is None or not p.enabled():
        return fail("This sign-in provider is unavailable.")

    try:
        token = await p.exchange_code(code, _redirect_uri(provider))
        identity = await p.fetch_identity(token)
        user = await resolve_oauth_user(db, identity)
        raw = generate_handoff_token()
        db.add(OAuthHandoff(
            user_id=user.id,
            token_hash=hash_handoff_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=HANDOFF_TTL_S),
        ))
        await db.commit()
    except OAuthError as e:
        await db.rollback()
        logger.warning("oauth_callback_failed", provider=provider, error=str(e))
        return fail(e.user_message)
    except Exception:
        await db.rollback()
        logger.exception("oauth_callback_error", provider=provider)
        return fail("Something went wrong signing you in. Please try again.")

    resp = RedirectResponse(
        _frontend_url(code=raw, next=_safe_return(decoded.get("return_to", "/app/home"))),
        status_code=302,
    )
    resp.delete_cookie(STATE_COOKIE, path="/api/v1/auth/oauth")
    return resp


class OAuthExchangeRequest(BaseModel):
    code: str


@router.post("/exchange", response_model=AuthResponse)
@limiter.limit("30/minute")
async def oauth_exchange(
    request: Request,
    body: OAuthExchangeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trade the one-time handoff code for a real token pair."""
    row = (await db.execute(
        select(OAuthHandoff).where(
            OAuthHandoff.token_hash == hash_handoff_token(body.code),
            OAuthHandoff.used == False,  # noqa: E712
            OAuthHandoff.expires_at > datetime.now(timezone.utc),
        )
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=400, detail="Invalid or expired sign-in code")
    row.used = True

    user = (await db.execute(
        select(User).where(User.id == row.user_id, User.is_active == True)  # noqa: E712
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="Account unavailable")

    tokens = await _create_tokens(user, db)  # commits (marks the handoff used too)
    return AuthResponse(tokens=tokens, user=UserOut.model_validate(user))
