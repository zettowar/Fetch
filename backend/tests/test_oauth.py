"""SSO/OAuth flow, with the provider's network calls mocked.

We drive the real HTTP endpoints (start → callback → exchange) but stub each
provider's `exchange_code` / `fetch_identity` so no real Google/GitHub call is
made. The `sso_enabled` / `signups_paused` flags are faked at the service layer
for isolation; one test exercises the real admin-flag → /providers path.
"""
import uuid
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient

import app.services.settings_service as settings_service
from app.config import settings
from app.services.oauth import NormalizedIdentity
from app.services.oauth.registry import PROVIDERS

CREDS = {
    "google": ("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"),
    "github": ("GITHUB_OAUTH_CLIENT_ID", "GITHUB_OAUTH_CLIENT_SECRET"),
}


def _identity(provider="google", email="new-sso@fetchpawz.com", verified=True, account_id=None):
    return NormalizedIdentity(
        provider=provider,
        account_id=account_id or f"{provider}-{uuid.uuid4().hex[:8]}",
        email=email,
        email_verified=verified,
        display_name="SSO User",
    )


def _enable_provider(monkeypatch, identity, provider="google", sso=True, paused=False, with_creds=True):
    """Fake the flags + provider network calls for a self-contained flow."""
    async def fake_get(db, key):
        if key == "sso_enabled":
            return sso
        if key == "signups_paused":
            return paused
        return await settings_service._orig_get(db, key)

    if not hasattr(settings_service, "_orig_get"):
        settings_service._orig_get = settings_service.get_setting
    monkeypatch.setattr(settings_service, "get_setting", fake_get)

    if with_creds:
        cid, secret = CREDS[provider]
        monkeypatch.setattr(settings, cid, "test-client-id")
        monkeypatch.setattr(settings, secret, "test-client-secret")

    async def fake_exchange(code, redirect_uri):
        return "fake-access-token"

    async def fake_identity(access_token):
        return identity

    monkeypatch.setattr(PROVIDERS[provider], "exchange_code", fake_exchange)
    monkeypatch.setattr(PROVIDERS[provider], "fetch_identity", fake_identity)


async def _run_callback(client: AsyncClient, provider="google"):
    """start → callback. Returns the parsed query of the final frontend redirect
    ({'code': [...]} on success, {'error': [...]} on failure)."""
    start = await client.get(f"/api/v1/auth/oauth/{provider}/start", follow_redirects=False)
    assert start.status_code == 302, start.text
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]

    cb = await client.get(
        f"/api/v1/auth/oauth/{provider}/callback",
        params={"code": "auth-code", "state": state},
        cookies={"oauth_state": state},
        follow_redirects=False,
    )
    assert cb.status_code == 302, cb.text
    return parse_qs(urlparse(cb.headers["location"]).query), state


@pytest.mark.asyncio
async def test_providers_reflects_real_flag(client: AsyncClient, admin_headers: dict, monkeypatch):
    # Real admin flag → /providers path (no service-layer fake here).
    monkeypatch.setattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "id")
    monkeypatch.setattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "secret")

    off = await client.get("/api/v1/auth/oauth/providers")
    assert off.json() == []  # sso_enabled defaults off

    try:
        await client.put("/api/v1/admin/settings/sso_enabled", json={"value": True}, headers=admin_headers)
        on = await client.get("/api/v1/auth/oauth/providers")
        assert "google" in on.json()
    finally:
        await client.put("/api/v1/admin/settings/sso_enabled", json={"value": False}, headers=admin_headers)


@pytest.mark.asyncio
async def test_sso_new_user_created_verified_without_password(client: AsyncClient, monkeypatch):
    from sqlalchemy import select
    from app.models.user import User
    from tests.conftest import test_session_factory

    ident = _identity(email=f"newuser-{uuid.uuid4().hex[:6]}@fetchpawz.com")
    _enable_provider(monkeypatch, ident)

    q, _ = await _run_callback(client)
    assert "code" in q, q

    ex = await client.post("/api/v1/auth/oauth/exchange", json={"code": q["code"][0]})
    assert ex.status_code == 200, ex.text
    body = ex.json()
    assert body["user"]["email"] == ident.email
    assert body["tokens"]["access_token"] and body["tokens"]["refresh_token"]

    async with test_session_factory() as db:
        u = (await db.execute(select(User).where(User.email == ident.email))).scalar_one()
        assert u.is_verified is True
        assert u.password_hash is None  # SSO-only account


@pytest.mark.asyncio
async def test_sso_returning_user_same_account(client: AsyncClient, monkeypatch):
    ident = _identity(email=f"returning-{uuid.uuid4().hex[:6]}@fetchpawz.com")
    _enable_provider(monkeypatch, ident)

    q1, _ = await _run_callback(client)
    u1 = (await client.post("/api/v1/auth/oauth/exchange", json={"code": q1["code"][0]})).json()["user"]["id"]
    q2, _ = await _run_callback(client)
    u2 = (await client.post("/api/v1/auth/oauth/exchange", json={"code": q2["code"][0]})).json()["user"]["id"]
    assert u1 == u2


@pytest.mark.asyncio
async def test_sso_autolinks_existing_verified_email(client: AsyncClient, monkeypatch):
    # A password account exists; SSO with the same verified email links to it.
    email = f"link-{uuid.uuid4().hex[:6]}@fetchpawz.com"
    signup = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Has Password",
    })
    existing_id = signup.json()["user"]["id"]

    _enable_provider(monkeypatch, _identity(email=email))
    q, _ = await _run_callback(client)
    linked = await client.post("/api/v1/auth/oauth/exchange", json={"code": q["code"][0]})
    assert linked.json()["user"]["id"] == existing_id


@pytest.mark.asyncio
async def test_sso_rejects_unverified_email(client: AsyncClient, monkeypatch):
    _enable_provider(monkeypatch, _identity(email="unverified@fetchpawz.com", verified=False))
    q, _ = await _run_callback(client)
    assert "error" in q and "code" not in q


@pytest.mark.asyncio
async def test_sso_disabled_returns_404(client: AsyncClient, monkeypatch):
    _enable_provider(monkeypatch, _identity(), sso=False)
    res = await client.get("/api/v1/auth/oauth/google/start", follow_redirects=False)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_signups_paused_blocks_new_sso_user(client: AsyncClient, monkeypatch):
    _enable_provider(monkeypatch, _identity(email=f"paused-{uuid.uuid4().hex[:6]}@fetchpawz.com"), paused=True)
    q, _ = await _run_callback(client)
    assert "error" in q and "code" not in q


@pytest.mark.asyncio
async def test_handoff_code_is_single_use(client: AsyncClient, monkeypatch):
    _enable_provider(monkeypatch, _identity(email=f"once-{uuid.uuid4().hex[:6]}@fetchpawz.com"))
    q, _ = await _run_callback(client)
    code = q["code"][0]
    first = await client.post("/api/v1/auth/oauth/exchange", json={"code": code})
    assert first.status_code == 200
    second = await client.post("/api/v1/auth/oauth/exchange", json={"code": code})
    assert second.status_code == 400


@pytest.mark.asyncio
async def test_callback_rejects_state_mismatch(client: AsyncClient, monkeypatch):
    _enable_provider(monkeypatch, _identity())
    start = await client.get("/api/v1/auth/oauth/google/start", follow_redirects=False)
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    # Cookie present but the returned state param doesn't match → rejected.
    cb = await client.get(
        "/api/v1/auth/oauth/google/callback",
        params={"code": "auth-code", "state": "tampered"},
        cookies={"oauth_state": state},
        follow_redirects=False,
    )
    q = parse_qs(urlparse(cb.headers["location"]).query)
    assert "error" in q and "code" not in q


@pytest.mark.asyncio
async def test_github_flow_works(client: AsyncClient, monkeypatch):
    ident = _identity(provider="github", email=f"gh-{uuid.uuid4().hex[:6]}@fetchpawz.com")
    _enable_provider(monkeypatch, ident, provider="github")
    q, _ = await _run_callback(client, provider="github")
    ex = await client.post("/api/v1/auth/oauth/exchange", json={"code": q["code"][0]})
    assert ex.status_code == 200
    assert ex.json()["user"]["email"] == ident.email
