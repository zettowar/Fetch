import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_signup_success(client: AsyncClient):
    email = f"signup-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": "password123",
        "display_name": "New User",
    })
    assert res.status_code == 201
    data = res.json()
    assert "tokens" in data
    assert data["user"]["email"] == email


@pytest.mark.asyncio
async def test_signup_duplicate_email(client: AsyncClient):
    email = f"dup-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": "password123",
        "display_name": "User 1",
    })
    res = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": "password123",
        "display_name": "User 2",
    })
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_signup_short_password(client: AsyncClient):
    res = await client.post("/api/v1/auth/signup", json={
        "email": f"short-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "short",
        "display_name": "User",
    })
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    email = f"login-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": "password123",
        "display_name": "Login User",
    })
    res = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "password123",
    })
    assert res.status_code == 200
    assert "tokens" in res.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    email = f"wrong-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": "password123",
        "display_name": "Wrong User",
    })
    res = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "wrongpass",
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/auth/me")
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_me_with_token(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert "email" in res.json()


@pytest.mark.asyncio
async def test_resend_verification_returns_debug_token(client: AsyncClient):
    """A freshly-signed-up user can ask for a verification token."""
    email = f"verify-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Verifier",
    })
    headers = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}

    res = await client.post("/api/v1/auth/resend-verification", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert "debug_token" in body
    assert len(body["debug_token"]) > 20


@pytest.mark.asyncio
async def test_verify_email_flips_is_verified(client: AsyncClient):
    email = f"verify2-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "ToVerify",
    })
    headers = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}

    # Baseline: not verified
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.json()["is_verified"] is False

    resend = await client.post("/api/v1/auth/resend-verification", headers=headers)
    token = resend.json()["debug_token"]

    verify = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert verify.status_code == 200

    me2 = await client.get("/api/v1/auth/me", headers=headers)
    assert me2.json()["is_verified"] is True


@pytest.mark.asyncio
async def test_verify_email_rejects_bad_token(client: AsyncClient):
    res = await client.post("/api/v1/auth/verify-email", json={"token": "not-a-real-token"})
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_resend_verification_noop_when_already_verified(client: AsyncClient):
    email = f"already-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Already",
    })
    headers = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}

    # Verify once
    token = (await client.post("/api/v1/auth/resend-verification", headers=headers)).json()["debug_token"]
    await client.post("/api/v1/auth/verify-email", json={"token": token})

    # Second resend should return the "already verified" message (no new token).
    again = await client.post("/api/v1/auth/resend-verification", headers=headers)
    assert again.status_code == 200
    assert "debug_token" not in again.json()
    assert "already verified" in again.json()["detail"].lower()
