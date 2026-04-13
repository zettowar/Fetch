import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_list_reports(client: AsyncClient, admin_headers: dict):
    res = await client.get("/api/v1/admin/reports", headers=admin_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_admin_list_reports_requires_admin(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/admin/reports", headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_suspend_user(client: AsyncClient, admin_headers: dict):
    # Create a user to suspend
    email = f"suspend-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "To Suspend"
    })
    user_id = signup_res.json()["user"]["id"]

    res = await client.post(f"/api/v1/admin/users/{user_id}/suspend", headers=admin_headers)
    assert res.status_code == 200

    # Verify suspended user can't access API
    user_token = signup_res.json()["tokens"]["access_token"]
    me_res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {user_token}"})
    assert me_res.status_code == 401


@pytest.mark.asyncio
async def test_admin_reinstate_user(client: AsyncClient, admin_headers: dict):
    email = f"reinstate-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "To Reinstate"
    })
    user_id = signup_res.json()["user"]["id"]

    await client.post(f"/api/v1/admin/users/{user_id}/suspend", headers=admin_headers)
    res = await client.post(f"/api/v1/admin/users/{user_id}/reinstate", headers=admin_headers)
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_admin_review_report(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    # Create a dog to report
    dog_res = await client.post("/api/v1/dogs", json={"name": "ReportedDog"}, headers=auth_headers)
    dog_id = dog_res.json()["id"]

    # Create a reporter
    email = f"reviewer-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Reviewer"
    })
    reporter_headers = {"Authorization": f"Bearer {signup_res.json()['tokens']['access_token']}"}

    # File a report
    report_res = await client.post("/api/v1/reports", json={
        "target_type": "dog", "target_id": dog_id, "reason": "test report"
    }, headers=reporter_headers)
    report_id = report_res.json()["id"]

    # Admin reviews it
    res = await client.post(f"/api/v1/admin/reports/{report_id}/review", json={
        "status": "reviewed",
        "admin_notes": "Confirmed violation",
        "apply_strike": True,
        "strike_reason": "Violated community guidelines",
    }, headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "reviewed"
