from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models.rescue import RescueProfile
from app.models.user import EmailVerificationToken, PasswordResetToken, RefreshToken, User
from app.config import settings
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse
from app.schemas.rescue import RescueSignupRequest
from app.schemas.user import UserOut
from app.security import (
    create_access_token,
    generate_refresh_token,
    generate_reset_token,
    hash_password,
    hash_refresh_token,
    hash_reset_token,
    verify_password,
)

logger = structlog.stdlib.get_logger()

router = APIRouter()


async def _create_tokens(user: User, db: AsyncSession) -> TokenResponse:
    access_token = create_access_token(str(user.id))
    raw_refresh = generate_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS),
    )
    db.add(rt)
    await db.commit()
    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


@router.post("/signup", response_model=dict, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(request: Request, body: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    await db.flush()

    tokens = await _create_tokens(user, db)
    return {"tokens": tokens.model_dump(), "user": UserOut.model_validate(user).model_dump()}


@router.post("/signup-rescue", response_model=dict, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def signup_rescue(
    request: Request, body: RescueSignupRequest, db: AsyncSession = Depends(get_db),
):
    """Create a rescue account. The user can log in immediately but cannot
    post dogs or run adoption flows until an admin approves their profile."""
    existing = await db.execute(select(User).where(User.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        display_name=body.org_name,
        role="rescue",
    )
    db.add(user)
    await db.flush()

    profile = RescueProfile(
        user_id=user.id,
        org_name=body.org_name,
        description=body.description,
        location=body.location,
        website=body.website,
        donation_url=body.donation_url,
        proof_details=body.proof_details,
        status="pending",
    )
    db.add(profile)
    await db.flush()

    tokens = await _create_tokens(user, db)
    return {
        "tokens": tokens.model_dump(),
        "user": UserOut.model_validate(user).model_dump(),
        "rescue_profile": {
            "id": str(profile.id),
            "status": profile.status,
            "org_name": profile.org_name,
        },
    }


@router.post("/login", response_model=dict)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.email == body.email.lower(), User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    tokens = await _create_tokens(user, db)
    return {"tokens": tokens.model_dump(), "user": UserOut.model_validate(user).model_dump()}


@router.post("/refresh", response_model=dict)
async def refresh(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    raw_token = body.get("refresh_token")
    if not raw_token:
        raise HTTPException(status_code=400, detail="refresh_token required")

    token_hash = hash_refresh_token(raw_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    rt = result.scalar_one_or_none()
    if not rt:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Revoke old token
    rt.revoked = True

    # Load user
    user_result = await db.execute(select(User).where(User.id == rt.user_id, User.is_active == True))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    tokens = await _create_tokens(user, db)
    return {"tokens": tokens.model_dump()}


@router.post("/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    raw_token = body.get("refresh_token")
    if raw_token:
        token_hash = hash_refresh_token(raw_token)
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        rt = result.scalar_one_or_none()
        if rt:
            rt.revoked = True
            await db.commit()
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    email = body.get("email", "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="email required")

    result = await db.execute(select(User).where(User.email == email, User.is_active == True))
    user = result.scalar_one_or_none()

    # Always return 200 to avoid email enumeration
    if not user:
        return {"detail": "If that email is registered, a reset link has been sent."}

    # Invalidate any existing reset tokens for this user
    existing = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False,
        )
    )
    for old_token in existing.scalars().all():
        old_token.used = True

    raw_token = generate_reset_token()
    prt = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.RESET_TOKEN_TTL_MIN),
    )
    db.add(prt)
    await db.commit()

    logger.info("password_reset_requested", user_id=str(user.id), email=user.email)

    response: dict = {"detail": "If that email is registered, a reset link has been sent."}
    if settings.DEBUG_RESET_TOKEN:
        response["debug_token"] = raw_token
    return response


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    raw_token = body.get("token", "").strip()
    new_password = body.get("password", "")

    if not raw_token or not new_password:
        raise HTTPException(status_code=400, detail="token and password required")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    token_hash = hash_reset_token(raw_token)
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
    )
    prt = result.scalar_one_or_none()
    if not prt:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user_result = await db.execute(select(User).where(User.id == prt.user_id, User.is_active == True))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.password_hash = hash_password(new_password)
    prt.used = True
    await db.commit()

    logger.info("password_reset_completed", user_id=str(user.id))
    return {"detail": "Password updated successfully"}


# --- Email verification ---

@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Issue a fresh email-verification token for the current user."""
    if user.is_verified:
        return {"detail": "Email already verified"}

    # Invalidate any previous unused tokens for this user.
    existing = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used == False,  # noqa: E712
        )
    )
    for old in existing.scalars().all():
        old.used = True

    raw_token = generate_reset_token()
    evt = EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        expires_at=datetime.now(timezone.utc)
        + timedelta(hours=settings.VERIFICATION_TOKEN_TTL_HOURS),
    )
    db.add(evt)
    await db.commit()

    logger.info("verification_email_requested", user_id=str(user.id), email=user.email)

    response: dict = {"detail": "Verification email sent."}
    if settings.DEBUG_VERIFY_TOKEN:
        response["debug_token"] = raw_token
    return response


@router.post("/verify-email")
@limiter.limit("10/minute")
async def verify_email(request: Request, db: AsyncSession = Depends(get_db)):
    """Consume a verification token and mark the user's email verified."""
    body = await request.json()
    raw_token = body.get("token", "").strip()
    if not raw_token:
        raise HTTPException(status_code=400, detail="token required")

    token_hash = hash_reset_token(raw_token)
    result = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash,
            EmailVerificationToken.used == False,  # noqa: E712
            EmailVerificationToken.expires_at > datetime.now(timezone.utc),
        )
    )
    evt = result.scalar_one_or_none()
    if not evt:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user_result = await db.execute(
        select(User).where(User.id == evt.user_id, User.is_active == True)  # noqa: E712
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user.is_verified = True
    evt.used = True
    await db.commit()

    logger.info("email_verified", user_id=str(user.id))
    return {"detail": "Email verified successfully"}
