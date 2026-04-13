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
