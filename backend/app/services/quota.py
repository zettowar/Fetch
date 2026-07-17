"""Server-authoritative swipe quota.

The daily cap is enforced here, not in the browser — clearing localStorage no
longer buys extra swipes. Base usage is the count of the user's Vote rows for
the current UTC day (both likes and passes persist as votes); reward-ad grants
are recorded per day in `swipe_allowances`; an active `ads_removed` entitlement
(Pack+) lifts the cap entirely.

Keep the constants in sync with the client mirror in
frontend/src/utils/swipeQuota.ts.
"""
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entitlement import Entitlement
from app.models.swipe_allowance import SwipeAllowance
from app.models.vote import Vote

FREE_DAILY = 50
REWARD_INCREMENT = 25
MAX_DAILY = 150
AD_FREE_KEY = "ads_removed"


@dataclass
class QuotaState:
    used: int
    cap: int
    remaining: int
    unlimited: bool


def _utc_day_start(now: datetime) -> datetime:
    return datetime.combine(now.date(), time.min, tzinfo=timezone.utc)


async def is_ad_free(db: AsyncSession, user_id: UUID, now: datetime) -> bool:
    """Whether the user holds an active (unexpired) ads_removed entitlement."""
    result = await db.execute(
        select(Entitlement.id).where(
            Entitlement.user_id == user_id,
            Entitlement.entitlement_key == AD_FREE_KEY,
            (Entitlement.expires_at.is_(None)) | (Entitlement.expires_at > now),
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _votes_today(db: AsyncSession, user_id: UUID, now: datetime) -> int:
    result = await db.execute(
        select(func.count(Vote.id)).where(
            Vote.voter_id == user_id,
            Vote.created_at >= _utc_day_start(now),
        )
    )
    return int(result.scalar() or 0)


async def _bonus_today(db: AsyncSession, user_id: UUID, today: date) -> int:
    result = await db.execute(
        select(SwipeAllowance.bonus_swipes).where(
            SwipeAllowance.user_id == user_id,
            SwipeAllowance.day == today,
        )
    )
    return int(result.scalar_one_or_none() or 0)


async def get_quota(db: AsyncSession, user_id: UUID, now: datetime) -> QuotaState:
    if await is_ad_free(db, user_id, now):
        used = await _votes_today(db, user_id, now)
        return QuotaState(used=used, cap=MAX_DAILY, remaining=MAX_DAILY, unlimited=True)
    used = await _votes_today(db, user_id, now)
    bonus = await _bonus_today(db, user_id, now.date())
    cap = min(MAX_DAILY, FREE_DAILY + bonus)
    return QuotaState(used=used, cap=cap, remaining=max(0, cap - used), unlimited=False)


async def can_swipe(db: AsyncSession, user_id: UUID, now: datetime) -> bool:
    q = await get_quota(db, user_id, now)
    return q.unlimited or q.remaining > 0


async def grant_reward(db: AsyncSession, user_id: UUID, now: datetime) -> QuotaState:
    """Add one reward increment to today's bonus, capped so the effective cap
    never exceeds MAX_DAILY. Commits the allowance row.

    NOTE: this is currently ungated — the rewarded-ad UI is a placeholder. The
    MAX_DAILY ceiling still bounds abuse. When a real ad network is wired, gate
    this behind server-side ad-completion verification.
    """
    today = now.date()
    max_bonus = MAX_DAILY - FREE_DAILY
    row = (await db.execute(
        select(SwipeAllowance).where(
            SwipeAllowance.user_id == user_id,
            SwipeAllowance.day == today,
        )
    )).scalar_one_or_none()
    if row is None:
        row = SwipeAllowance(user_id=user_id, day=today, bonus_swipes=0)
        db.add(row)
        try:
            await db.flush()
        except IntegrityError:
            # Concurrent first grant for the same day — reload the winner.
            await db.rollback()
            row = (await db.execute(
                select(SwipeAllowance).where(
                    SwipeAllowance.user_id == user_id,
                    SwipeAllowance.day == today,
                )
            )).scalar_one()
    row.bonus_swipes = min(max_bonus, row.bonus_swipes + REWARD_INCREMENT)
    await db.commit()
    return await get_quota(db, user_id, now)
