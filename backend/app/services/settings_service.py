"""Runtime, admin-editable settings backed by the `app_settings` table.

Known keys and their defaults live in `DEFAULTS`; anything not overridden in
the DB falls back there. Values are cached in-process with a short TTL so hot
paths (e.g. the signup gate) don't hit the DB on every request. The cache is a
best-effort read optimization — a write invalidates it in the writing worker;
other workers pick up the change within `_TTL_SECONDS`.
"""
import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_setting import AppSetting

# key -> (default_value, human description). The admin UI renders this list so
# operators see every available flag even before it's been set once.
DEFAULTS: dict[str, tuple[Any, str]] = {
    "signups_paused": (False, "Reject new member signups (rescue signups still allowed)."),
    "maintenance_banner": ("", "Site-wide banner text shown to all users. Empty = hidden."),
    "donations_paused": (False, "Hide donation calls-to-action and reject new checkouts."),
    # Explore section gating. `explore_enabled` off greys out the whole Explore
    # tab ("coming soon"); each sub-flag greys out one item inside the sheet.
    "explore_enabled": (True, "Show the Explore section. Off = greyed-out tab with 'Soon'."),
    "explore_parks_enabled": (True, "Show Parks inside Explore. Off = greyed 'Soon'."),
    "explore_pack_enabled": (True, "Show The Pack (pet discovery) inside Explore."),
    "explore_donate_enabled": (True, "Show Donate inside Explore."),
    "explore_shop_enabled": (True, "Show Shop inside Explore."),
    "explore_vets_enabled": (True, "Show Vets inside Explore."),
    "explore_community_enabled": (True, "Show Community posts inside Explore."),
    # SSO master switch — off hides the Google/GitHub buttons and 404s the OAuth
    # endpoints, so the feature stays invisible to real users until launch.
    # Off by default: this mails every active pet owner, so it should not
    # start sending the moment the code lands. Flip it in Admin → Settings once
    # there is enough weekly voting for a recap to be worth receiving.
    "weekly_recap_enabled": (
        False,
        "Email pet owners a Monday recap of last week's likes and rank.",
    ),
    "sso_enabled": (False, "Enable Sign in with Google/GitHub. Off = hidden from users."),
}

# The subset of settings safe to expose on the unauthenticated /public/flags
# endpoint (client-facing UI gates only — never operational flags).
PUBLIC_FLAG_KEYS = (
    "explore_enabled",
    "explore_parks_enabled",
    "explore_pack_enabled",
    "explore_donate_enabled",
    "explore_shop_enabled",
    "explore_vets_enabled",
    "explore_community_enabled",
)

_TTL_SECONDS = 30.0
_cache: dict[str, Any] = {}
_cache_at: float = 0.0


def _now() -> float:
    # time.monotonic is allowed; only wall-clock Date.now-style calls are banned
    # in workflow scripts, not in app code.
    return time.monotonic()


def invalidate_cache() -> None:
    global _cache_at
    _cache_at = 0.0


async def _load_all(db: AsyncSession) -> dict[str, Any]:
    global _cache, _cache_at
    if _cache and (_now() - _cache_at) < _TTL_SECONDS:
        return _cache
    rows = (await db.execute(select(AppSetting))).scalars().all()
    _cache = {r.key: r.value for r in rows}
    _cache_at = _now()
    return _cache


async def get_setting(db: AsyncSession, key: str) -> Any:
    """Current value for `key`: the DB override if present, else the default."""
    overrides = await _load_all(db)
    if key in overrides and overrides[key] is not None:
        return overrides[key]
    default, _desc = DEFAULTS.get(key, (None, ""))
    return default


async def all_settings(db: AsyncSession) -> list[dict[str, Any]]:
    """Every known key with its effective value + whether it's overridden.
    Used by the admin settings page."""
    overrides = await _load_all(db)
    out: list[dict[str, Any]] = []
    for key, (default, desc) in DEFAULTS.items():
        overridden = key in overrides and overrides[key] is not None
        out.append({
            "key": key,
            "value": overrides[key] if overridden else default,
            "default": default,
            "description": desc,
            "overridden": overridden,
        })
    return out
