from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user import User
from app.security import decode_access_token

bearer_scheme = HTTPBearer()


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    user_id = decode_access_token(creds.credentials)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


# Staff = anyone allowed into the admin console. "admin" is full privilege;
# "moderator" is scoped to moderation/read surfaces (see require_admin below
# for the privileged actions moderators are kept out of).
STAFF_ROLES = ("admin", "moderator")


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """Full-privilege gate: destructive/sensitive actions (delete accounts,
    change roles, grant entitlements, edit config, send broadcasts, refunds)."""
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return user


async def require_staff(user: User = Depends(get_current_user)) -> User:
    """Moderation/read gate: reports, tickets, content review, dashboards.
    Admins pass this too."""
    if user.role not in STAFF_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff access required")
    return user


async def require_approved_rescue(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Gatekeeper for rescue-only actions. Requires role='rescue' AND an
    approved rescue profile. Pending rescues cannot post pets yet."""
    from app.models.rescue import RescueProfile

    if user.role != "rescue":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Rescue account required")
    result = await db.execute(select(RescueProfile).where(RescueProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile or profile.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your rescue account is pending review",
        )
    return user
