from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import STAFF_ROLES, get_current_user
from app.limiter import limiter
from app.models.audit_log import AuditLog
from app.models.beta import InviteCode
from app.models.rescue import RescueProfile
from app.models.user import (
    EmailChangeToken,
    EmailVerificationToken,
    PasswordResetToken,
    RefreshToken,
    User,
)
from app.config import settings
from app.schemas.auth import (
    AuthResponse,
    ChangeEmailRequest,
    ChangePasswordRequest,
    ConfirmEmailChangeRequest,
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
    TotpDisableRequest,
    TotpEnableRequest,
    TotpSetupResponse,
    VerifyEmailRequest,
)
from app.schemas.rescue import RescueSignupRequest
from app.schemas.user import UserOut
from app.services import settings_service, totp
from app.services.email import (
    send_email_change_email,
    send_password_reset_email,
    send_verification_email,
)
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


def _client_ip(request: Request) -> str | None:
    """Best-effort source IP. The backend runs behind nginx/caddy with
    --proxy-headers, so X-Forwarded-For's first hop is the real client."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(
    request: Request,
    body: SignupRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Runtime kill-switch (admin-toggleable, distinct from the INVITE_REQUIRED
    # env gate). Rescue signups go through a separate endpoint and stay open.
    if await settings_service.get_setting(db, "signups_paused"):
        raise HTTPException(status_code=403, detail="New signups are temporarily paused")

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
    post pets or run adoption flows until an admin approves their profile."""
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

    # Second factor: only gates accounts that opted in. 401 with a distinct
    # code so the client knows to prompt for a code rather than re-ask the
    # password.
    if user.totp_enabled:
        if not body.otp:
            raise HTTPException(status_code=401, detail="2FA code required", headers={"X-2FA-Required": "1"})
        if not totp.verify(user.totp_secret or "", body.otp):
            raise HTTPException(status_code=401, detail="Invalid 2FA code", headers={"X-2FA-Required": "1"})

    # Audit staff logins (with source IP) — normal-user logins are too noisy
    # to record and aren't a security-review concern.
    if user.role in STAFF_ROLES:
        db.add(AuditLog(
            actor_id=user.id, action="auth.login", target_type="user", target_id=user.id,
            metadata_={"role": user.role, "ip": _client_ip(request)},
        ))

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


# --- Two-factor auth (TOTP) ---

@router.post("/2fa/setup", response_model=TotpSetupResponse)
@limiter.limit("10/minute")
async def totp_setup(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate (or reveal, if enrollment is mid-flight) a TOTP secret and the
    otpauth URI to load into an authenticator app. Not active until /2fa/enable
    confirms a code, so re-calling before enabling just rotates the secret."""
    if user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled")
    user.totp_secret = totp.generate_secret()
    await db.commit()
    return TotpSetupResponse(
        secret=user.totp_secret,
        otpauth_uri=totp.provisioning_uri(user.totp_secret, account=user.email),
    )


@router.post("/2fa/enable", response_model=DetailResponse)
@limiter.limit("10/minute")
async def totp_enable(
    request: Request,
    body: TotpEnableRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled")
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="Start with /2fa/setup first")
    if not totp.verify(user.totp_secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid code")
    user.totp_enabled = True
    db.add(AuditLog(actor_id=user.id, action="auth.2fa_enable", target_type="user", target_id=user.id))
    await db.commit()
    return DetailResponse(detail="Two-factor authentication enabled")


@router.post("/2fa/disable", response_model=DetailResponse)
@limiter.limit("10/minute")
async def totp_disable(
    request: Request,
    body: TotpDisableRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Turn 2FA off. Requires re-proving identity with either the account
    password or a current TOTP code."""
    if not user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    authorized = (
        (body.password and verify_password(body.password, user.password_hash))
        or (body.code and totp.verify(user.totp_secret or "", body.code))
    )
    if not authorized:
        raise HTTPException(status_code=400, detail="Password or valid 2FA code required")
    user.totp_enabled = False
    user.totp_secret = None
    db.add(AuditLog(actor_id=user.id, action="auth.2fa_disable", target_type="user", target_id=user.id))
    await db.commit()
    return DetailResponse(detail="Two-factor authentication disabled")


@router.post("/change-password", response_model=TokenResponse)
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change password while logged in. All existing sessions are revoked and
    a fresh token pair is returned so this one continues seamlessly."""
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.password_hash = hash_password(body.new_password)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked == False)  # noqa: E712
        .values(revoked=True)
    )
    tokens = await _create_tokens(user, db)
    logger.info("password_changed", user_id=str(user.id))
    return tokens


@router.post("/change-email")
@limiter.limit("3/hour")
async def change_email(
    request: Request,
    body: ChangeEmailRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start an email change: a confirmation link goes to the NEW address, and
    nothing switches until that address proves it can receive it."""
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Password is incorrect")

    new_email = body.new_email.lower().strip()
    if new_email == user.email:
        raise HTTPException(status_code=400, detail="That is already your email address")
    taken = await db.execute(select(User).where(User.email == new_email))
    if taken.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    if not settings.RESEND_API_KEY and not settings.DEBUG_VERIFY_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Email changes are unavailable — email delivery is not configured",
        )

    # Invalidate any previous pending change.
    existing = await db.execute(
        select(EmailChangeToken).where(
            EmailChangeToken.user_id == user.id,
            EmailChangeToken.used == False,  # noqa: E712
        )
    )
    for old in existing.scalars().all():
        old.used = True

    raw_token = generate_reset_token()
    db.add(EmailChangeToken(
        user_id=user.id,
        new_email=new_email,
        token_hash=hash_reset_token(raw_token),
        expires_at=datetime.now(timezone.utc)
        + timedelta(hours=settings.VERIFICATION_TOKEN_TTL_HOURS),
    ))
    await db.commit()

    logger.info("email_change_requested", user_id=str(user.id))
    background_tasks.add_task(send_email_change_email, new_email, raw_token)

    response: dict = {"detail": f"Confirmation link sent to {new_email}"}
    if settings.DEBUG_VERIFY_TOKEN:
        response["debug_token"] = raw_token
    return response


@router.post("/confirm-email-change", response_model=DetailResponse)
@limiter.limit("10/minute")
async def confirm_email_change(
    request: Request,
    body: ConfirmEmailChangeRequest,
    db: AsyncSession = Depends(get_db),
):
    token_hash = hash_reset_token(body.token.strip())
    result = await db.execute(
        select(EmailChangeToken).where(
            EmailChangeToken.token_hash == token_hash,
            EmailChangeToken.used == False,  # noqa: E712
            EmailChangeToken.expires_at > datetime.now(timezone.utc),
        )
    )
    token = result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=400, detail="Invalid or expired confirmation token")

    # The address must still be free — someone may have registered it since.
    taken = await db.execute(select(User).where(User.email == token.new_email))
    if taken.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user_result = await db.execute(
        select(User).where(User.id == token.user_id, User.is_active == True)  # noqa: E712
    )
    target = user_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=400, detail="Invalid or expired confirmation token")

    old_email = target.email
    target.email = token.new_email
    target.is_verified = True  # the new address just proved itself
    token.used = True
    await db.commit()

    logger.info("email_changed", user_id=str(target.id), old_email=old_email)
    return {"detail": "Email address updated"}


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
