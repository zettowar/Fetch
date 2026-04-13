import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_report(client: AsyncClient, auth_headers: dict):
    # First create a dog to report
    dog_res = await client.post("/api/v1/dogs", json={"name": "BadDog"}, headers=auth_headers)
    dog_id = dog_res.json()["id"]

    # Create a second user to file the report
    email2 = f"reporter-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email2, "password": "password123", "display_name": "Reporter"
    })
    reporter_token = signup_res.json()["tokens"]["access_token"]
    reporter_headers = {"Authorization": f"Bearer {reporter_token}"}

    res = await client.post("/api/v1/reports", json={
        "target_type": "dog",
        "target_id": dog_id,
        "reason": "Inappropriate content",
    }, headers=reporter_headers)
    assert res.status_code == 201
    assert res.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_create_report_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/reports", json={
        "target_type": "dog",
        "target_id": str(uuid.uuid4()),
        "reason": "test",
    })
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_cannot_self_report(client: AsyncClient, auth_headers: dict):
    # Get current user ID
    me_res = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me_res.json()["id"]

    res = await client.post("/api/v1/reports", json={
        "target_type": "user",
        "target_id": user_id,
        "reason": "test",
    }, headers=auth_headers)
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_duplicate_report_rejected(client: AsyncClient, auth_headers: dict):
    dog_res = await client.post("/api/v1/dogs", json={"name": "DupReport"}, headers=auth_headers)
    dog_id = dog_res.json()["id"]

    email2 = f"dupreporter-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email2, "password": "password123", "display_name": "Dup Reporter"
    })
    reporter_headers = {"Authorization": f"Bearer {signup_res.json()['tokens']['access_token']}"}

    await client.post("/api/v1/reports", json={
        "target_type": "dog", "target_id": dog_id, "reason": "first report"
    }, headers=reporter_headers)

    res = await client.post("/api/v1/reports", json={
        "target_type": "dog", "target_id": dog_id, "reason": "second report"
    }, headers=reporter_headers)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_my_reports(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/reports/mine", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_invalid_target_type(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/reports", json={
        "target_type": "invalid",
        "target_id": str(uuid.uuid4()),
        "reason": "test",
    }, headers=auth_headers)
    assert res.status_code == 422
