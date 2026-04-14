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


@pytest.mark.asyncio
async def test_admin_users_search_pagination(client: AsyncClient, admin_headers: dict):
    """Pagination on /admin/users/search returns X-Total-Count and honors offset."""
    # Seed a handful of signups so pagination is meaningful.
    for _ in range(4):
        await client.post("/api/v1/auth/signup", json={
            "email": f"page-{uuid.uuid4().hex[:8]}@fetchapp.dev",
            "password": "password123",
            "display_name": "Paginated",
        })

    first = await client.get(
        "/api/v1/admin/users/search", params={"limit": 2, "offset": 0}, headers=admin_headers
    )
    assert first.status_code == 200
    assert "x-total-count" in {k.lower() for k in first.headers.keys()}
    total = int(first.headers["x-total-count"])
    assert total >= 4
    first_ids = [u["id"] for u in first.json()]
    assert len(first_ids) == 2

    second = await client.get(
        "/api/v1/admin/users/search", params={"limit": 2, "offset": 2}, headers=admin_headers
    )
    assert second.status_code == 200
    second_ids = [u["id"] for u in second.json()]
    assert set(first_ids).isdisjoint(second_ids)


@pytest.mark.asyncio
async def test_admin_user_reports_filed(client: AsyncClient, admin_headers: dict):
    """Reports-filed endpoint returns only reports created by the target user."""
    # Create two users. User A files the report.
    a = await client.post("/api/v1/auth/signup", json={
        "email": f"filer-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "password123", "display_name": "Filer",
    })
    b = await client.post("/api/v1/auth/signup", json={
        "email": f"filee-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "password123", "display_name": "Filee",
    })
    a_id = a.json()["user"]["id"]
    b_id = b.json()["user"]["id"]
    a_headers = {"Authorization": f"Bearer {a.json()['tokens']['access_token']}"}
    b_headers = {"Authorization": f"Bearer {b.json()['tokens']['access_token']}"}

    # B creates a dog, A reports it.
    dog = await client.post("/api/v1/dogs", json={"name": "SubjectDog"}, headers=b_headers)
    dog_id = dog.json()["id"]
    await client.post("/api/v1/reports", json={
        "target_type": "dog", "target_id": dog_id, "reason": "test"
    }, headers=a_headers)

    # A's reports-filed should contain the report; B's should not.
    res_a = await client.get(f"/api/v1/admin/users/{a_id}/reports-filed", headers=admin_headers)
    assert res_a.status_code == 200
    assert len(res_a.json()) >= 1
    assert all(r["reporter_id"] == a_id for r in res_a.json())

    res_b = await client.get(f"/api/v1/admin/users/{b_id}/reports-filed", headers=admin_headers)
    assert res_b.status_code == 200
    assert all(r["reporter_id"] == b_id for r in res_b.json())


@pytest.mark.asyncio
async def test_admin_stats_timeseries(client: AsyncClient, admin_headers: dict):
    """Stats timeseries returns aligned arrays of length `days`."""
    res = await client.get(
        "/api/v1/admin/stats/timeseries", params={"days": 7}, headers=admin_headers
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["dates"]) == 7
    assert len(body["new_users"]) == 7
    assert len(body["new_reports"]) == 7
    assert len(body["new_dogs"]) == 7
    # All counts must be non-negative integers.
    for key in ("new_users", "new_reports", "new_dogs"):
        assert all(isinstance(n, int) and n >= 0 for n in body[key])
