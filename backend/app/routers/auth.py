from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models.beta import InviteCode
from app.models.rescue import RescueProfile
from app.models.user import EmailVerificationToken, PasswordResetToken, RefreshToken, User
from app.config import settings
from app.schemas.auth import (
    AuthResponse,
    DetailResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RefreshResponse,
    RescueProfileBrief,
    RescueSignupResponse,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.schemas.rescue import RescueSignupRequest
from app.schemas.user import UserOut
from app.services.email import send_password_reset_email, send_verification_email
from app.security import (
    DUMMY_PASSWORD_HASH,
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


async def _issue_verification_token(user: User, db: AsyncSession) -> str:
    """Invalidate prior unused verification tokens and mint a fresh one.

    Adds to the session without committing — the caller owns the transaction.
    """
    existing = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used == False,  # noqa: E712
        )
    )
    for old in existing.scalars().all():
        old.used = True

    raw_token = generate_reset_token()
    db.add(EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        expires_at=datetime.now(timezone.utc)
        + timedelta(hours=settings.VERIFICATION_TOKEN_TTL_HOURS),
    ))
    return raw_token


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


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(
    request: Request,
    body: SignupRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    invite_code = (body.invite_code or "").strip().upper()
    if settings.INVITE_REQUIRED and not invite_code:
        raise HTTPException(
            status_code=400, detail="An invite code is required while Fetch is in beta"
        )

    existing = await db.execute(select(User).where(User.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        # Two concurrent signups can both pass the SELECT above; the unique
        # constraint decides, and the loser gets the same 409 as the fast path.
        raise HTTPException(status_code=409, detail="Email already registered")

    if settings.INVITE_REQUIRED:
        # Atomic claim: the WHERE on is_used makes concurrent signups with the
        # same code race safely — exactly one UPDATE wins.
        claimed = await db.execute(
            update(InviteCode)
            .where(InviteCode.code == invite_code, InviteCode.is_used == False)
            .values(is_used=True, used_by=user.id, used_at=datetime.now(timezone.utc))
        )
        if claimed.rowcount == 0:
            raise HTTPException(
                status_code=400, detail="Invalid or already-used invite code"
            )

    # Kick off email verification right away when a provider is configured;
    # without one, the resend-verification + DEBUG_VERIFY_TOKEN dev flow
    # remains the only path and no token row is minted here.
    verify_token: str | None = None
    if settings.RESEND_API_KEY:
        verify_token = await _issue_verification_token(user, db)

    tokens = await _create_tokens(user, db)
    if verify_token:
        background_tasks.add_task(send_verification_email, user.email, verify_token)
    return AuthResponse(tokens=tokens, user=UserOut.model_validate(user))


@router.post(
    "/signup-rescue",
    response_model=RescueSignupResponse,
    status_code=status.HTTP_201_CREATED,
)
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
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Email already registered")

    profile = RescueProfile(
        user_id=user.id,
        org_name=body.org_name,
        description=body.description,
        location=body.location,
        lat=body.lat,
        lng=body.lng,
        website=body.website,
        donation_url=body.donation_url,
        proof_details=body.proof_details,
        status="pending",
    )
    db.add(profile)
    await db.flush()

    tokens = await _create_tokens(user, db)
    return RescueSignupResponse(
        tokens=tokens,
        user=UserOut.model_validate(user),
        rescue_profile=RescueProfileBrief(
            id=str(profile.id),
            status=profile.status,
            org_name=profile.org_name,
        ),
    )


@router.post("/login", response_model=AuthResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.email == body.email.lower(), User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if user is None:
        # Run a throwaway verify so response time doesn't reveal whether the
        # email exists (constant-time-ish enumeration defense).
        verify_password(body.password, DUMMY_PASSWORD_HASH)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    tokens = await _create_tokens(user, db)
    return AuthResponse(tokens=tokens, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit("30/minute")
async def refresh(request: Request, body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hash_refresh_token(body.refresh_token)
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
    return RefreshResponse(tokens=tokens)


@router.post("/logout", response_model=DetailResponse)
@limiter.limit("30/minute")
async def logout(request: Request, body: LogoutRequest, db: AsyncSession = Depends(get_db)):
    if body.refresh_token:
        token_hash = hash_refresh_token(body.refresh_token)
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        rt = result.scalar_one_or_none()
        if rt:
            rt.revoked = True
            await db.commit()
    return DetailResponse(detail="Logged out")


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    email = body.email.lower().strip()
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
    # Sent after the response so timing stays flat vs the unknown-email path.
    background_tasks.add_task(send_password_reset_email, user.email, raw_token)

    response: dict = {"detail": "If that email is registered, a reset link has been sent."}
    if settings.DEBUG_RESET_TOKEN:
        response["debug_token"] = raw_token
    return response


@router.post("/reset-password", response_model=DetailResponse)
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    raw_token = body.token.strip()
    new_password = body.password
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
    # A password reset usually means the old credentials can't be trusted —
    # kill every live session so a stolen refresh token dies with them.
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked == False)
        .values(revoked=True)
    )
    await db.commit()

    logger.info("password_reset_completed", user_id=str(user.id))
    return {"detail": "Password updated successfully"}


# --- Email verification ---

@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Issue a fresh email-verification token for the current user."""
    if user.is_verified:
        return {"detail": "Email already verified"}

    raw_token = await _issue_verification_token(user, db)
    await db.commit()

    logger.info("verification_email_requested", user_id=str(user.id), email=user.email)
    background_tasks.add_task(send_verification_email, user.email, raw_token)

    response: dict = {"detail": "Verification email sent."}
    if settings.DEBUG_VERIFY_TOKEN:
        response["debug_token"] = raw_token
    return response


@router.post("/verify-email", response_model=DetailResponse)
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    body: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    """Consume a verification token and mark the user's email verified."""
    raw_token = body.token.strip()
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
