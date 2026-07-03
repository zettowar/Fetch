"""Tests for the previously-uncovered auth flows: password reset, token
refresh/rotation, and logout."""
import uuid

import pytest
from httpx import AsyncClient

from app.config import settings


async def _signup(client: AsyncClient) -> tuple[str, dict]:
    email = f"flow-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": "password123",
        "display_name": "Flow User",
    })
    assert res.status_code == 201, res.text
    return email, res.json()["tokens"]


# --- Password reset ---

@pytest.mark.asyncio
async def test_forgot_password_does_not_leak_account_existence(client: AsyncClient):
    # Unknown email still returns 200 (no enumeration).
    res = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": f"nobody-{uuid.uuid4().hex[:6]}@fetchapp.dev"},
    )
    assert res.status_code == 200
    assert "debug_token" not in res.json()


@pytest.mark.asyncio
async def test_password_reset_end_to_end(client: AsyncClient, monkeypatch):
    # Surface the reset token in the response for the test only.
    monkeypatch.setattr(settings, "DEBUG_RESET_TOKEN", True)
    email, _ = await _signup(client)

    forgot = await client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert forgot.status_code == 200
    token = forgot.json()["debug_token"]

    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": "newpassword456"},
    )
    assert reset.status_code == 200, reset.text

    # New password works; old one no longer does.
    ok = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "newpassword456"}
    )
    assert ok.status_code == 200
    bad = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "password123"}
    )
    assert bad.status_code == 401

    # The token is single-use.
    reuse = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": "another789"},
    )
    assert reuse.status_code == 400


@pytest.mark.asyncio
async def test_password_reset_revokes_refresh_tokens(client: AsyncClient, monkeypatch):
    """A stolen refresh token must die when the victim resets their password."""
    monkeypatch.setattr(settings, "DEBUG_RESET_TOKEN", True)
    email, tokens = await _signup(client)
    old_refresh = tokens["refresh_token"]

    forgot = await client.post("/api/v1/auth/forgot-password", json={"email": email})
    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": forgot.json()["debug_token"], "password": "newpassword456"},
    )
    assert reset.status_code == 200, reset.text

    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": old_refresh}
    )
    assert refreshed.status_code == 401


@pytest.mark.asyncio
async def test_purge_dead_refresh_tokens(client: AsyncClient):
    """The reaper deletes revoked/expired tokens but leaves live ones usable."""
    from tests.conftest import test_session_factory
    from app.tasks.token_cleanup import purge_dead_refresh_tokens

    _, tokens = await _signup(client)
    # Rotation revokes the original token, leaving a dead row behind.
    rotated = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert rotated.status_code == 200, rotated.text
    live_refresh = rotated.json()["tokens"]["refresh_token"]

    async with test_session_factory() as db:
        purged = await purge_dead_refresh_tokens(db)
    assert purged >= 1

    still_works = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": live_refresh}
    )
    assert still_works.status_code == 200, still_works.text


@pytest.mark.asyncio
async def test_reset_with_invalid_token_rejected(client: AsyncClient):
    res = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "not-a-real-token", "password": "whatever123"},
    )
    assert res.status_code == 400


# --- Refresh rotation ---

@pytest.mark.asyncio
async def test_refresh_rotates_and_revokes_old_token(client: AsyncClient):
    _, tokens = await _signup(client)
    old_refresh = tokens["refresh_token"]

    first = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert first.status_code == 200, first.text
    new_refresh = first.json()["tokens"]["refresh_token"]
    assert new_refresh != old_refresh

    # Old token is revoked after rotation.
    reuse = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert reuse.status_code == 401

    # New token still works.
    second = await client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh})
    assert second.status_code == 200


@pytest.mark.asyncio
async def test_refresh_with_garbage_token_rejected(client: AsyncClient):
    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": "garbage"})
    assert res.status_code == 401


# --- Logout ---

@pytest.mark.asyncio
async def test_logout_revokes_refresh_token(client: AsyncClient):
    _, tokens = await _signup(client)
    refresh = tokens["refresh_token"]

    out = await client.post("/api/v1/auth/logout", json={"refresh_token": refresh})
    assert out.status_code == 200

    # The refresh token no longer works after logout.
    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert res.status_code == 401
