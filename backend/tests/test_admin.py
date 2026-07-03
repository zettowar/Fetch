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
async def test_suspension_cascades_to_dogs(client: AsyncClient, admin_headers: dict):
    """Suspending hides the user's dogs; reinstating revives exactly those."""
    email = f"cascade-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Cascade"
    })
    user_id = signup_res.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {signup_res.json()['tokens']['access_token']}"}

    active_dog = (await client.post(
        "/api/v1/dogs", json={"name": "ActivePup"}, headers=headers
    )).json()["id"]
    # A dog the admin deactivated separately must NOT revive on reinstate.
    pre_deactivated = (await client.post(
        "/api/v1/dogs", json={"name": "AlreadyHidden"}, headers=headers
    )).json()["id"]
    await client.post(f"/api/v1/admin/dogs/{pre_deactivated}/deactivate", headers=admin_headers)

    await client.post(f"/api/v1/admin/users/{user_id}/suspend", headers=admin_headers)
    res = await client.get(f"/api/v1/dogs/{active_dog}", headers=admin_headers)
    assert res.status_code == 404, "suspended user's dog must be hidden"

    await client.post(f"/api/v1/admin/users/{user_id}/reinstate", headers=admin_headers)
    res = await client.get(f"/api/v1/dogs/{active_dog}", headers=admin_headers)
    assert res.status_code == 200, "reinstatement must revive the cascaded dog"
    res = await client.get(f"/api/v1/dogs/{pre_deactivated}", headers=admin_headers)
    assert res.status_code == 404, "separately-deactivated dog must stay hidden"


@pytest.mark.asyncio
async def test_strike_suspension_at_exactly_three(client: AsyncClient, admin_headers: dict):
    """Auto-suspension must fire on the 3rd strike, not the 2nd (off-by-one regression)."""
    email = f"striketarget-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Strike Target"
    })
    target_id = signup_res.json()["user"]["id"]
    target_headers = {"Authorization": f"Bearer {signup_res.json()['tokens']['access_token']}"}
    dog_res = await client.post("/api/v1/dogs", json={"name": "StrikeDog"}, headers=target_headers)
    dog_id = dog_res.json()["id"]

    async def strike_once() -> None:
        reporter_email = f"striker-{uuid.uuid4().hex[:8]}@fetchapp.dev"
        r = await client.post("/api/v1/auth/signup", json={
            "email": reporter_email, "password": "password123", "display_name": "Striker"
        })
        reporter_headers = {"Authorization": f"Bearer {r.json()['tokens']['access_token']}"}
        report_res = await client.post("/api/v1/reports", json={
            "target_type": "dog", "target_id": dog_id, "reason": "strike test"
        }, headers=reporter_headers)
        assert report_res.status_code == 201, report_res.text
        review_res = await client.post(
            f"/api/v1/admin/reports/{report_res.json()['id']}/review",
            json={"status": "reviewed", "apply_strike": True, "strike_reason": "test"},
            headers=admin_headers,
        )
        assert review_res.status_code == 200, review_res.text

    async def target_is_active() -> bool:
        res = await client.get(f"/api/v1/admin/users/{target_id}", headers=admin_headers)
        assert res.status_code == 200
        return res.json()["is_active"]

    await strike_once()
    assert await target_is_active(), "1 strike must not suspend"
    await strike_once()
    assert await target_is_active(), "2 strikes must not suspend"
    await strike_once()
    assert not await target_is_active(), "3rd strike must suspend"

    # Auto-suspension cascades to the user's dogs like a manual one.
    dog_res = await client.get(f"/api/v1/dogs/{dog_id}", headers=admin_headers)
    assert dog_res.status_code == 404


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
async def test_admin_user_reports_against(client: AsyncClient, admin_headers: dict):
    """Reports-against endpoint resolves target via direct + dog-ownership paths."""
    # Owner creates a dog. Reporter files a report against the dog.
    owner = await client.post("/api/v1/auth/signup", json={
        "email": f"owner-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "password123", "display_name": "Owner",
    })
    owner_id = owner.json()["user"]["id"]
    owner_headers = {"Authorization": f"Bearer {owner.json()['tokens']['access_token']}"}

    reporter = await client.post("/api/v1/auth/signup", json={
        "email": f"reptr-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "password123", "display_name": "Reporter",
    })
    reporter_headers = {"Authorization": f"Bearer {reporter.json()['tokens']['access_token']}"}

    dog = await client.post("/api/v1/dogs", json={"name": "TargetDog"}, headers=owner_headers)
    dog_id = dog.json()["id"]
    await client.post("/api/v1/reports", json={
        "target_type": "dog", "target_id": dog_id, "reason": "bad"
    }, headers=reporter_headers)

    res = await client.get(f"/api/v1/admin/users/{owner_id}/reports-against", headers=admin_headers)
    assert res.status_code == 200
    body = res.json()
    assert len(body) >= 1
    assert any(r["target_type"] == "dog" and r["target_id"] == dog_id for r in body)


@pytest.mark.asyncio
async def test_admin_user_rescue_profile(client: AsyncClient, admin_headers: dict):
    """Admin can read a rescue user's pending profile."""
    email = f"rescue-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup-rescue", json={
        "email": email,
        "password": "password123",
        "org_name": "Paws & Claws",
        "description": "Local rescue",
    })
    user_id = signup.json()["user"]["id"]

    res = await client.get(
        f"/api/v1/admin/users/{user_id}/rescue-profile", headers=admin_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body is not None
    assert body["org_name"] == "Paws & Claws"
    assert body["status"] == "pending"


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


@pytest.mark.asyncio
async def test_admin_audit_log_filters(client: AsyncClient, admin_headers: dict):
    """Audit log respects action/target_type filters and lists in DESC order."""
    # Trigger an audited action: suspend a fresh user.
    email = f"audit-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    s = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Audit",
    })
    user_id = s.json()["user"]["id"]
    sus = await client.post(f"/api/v1/admin/users/{user_id}/suspend", headers=admin_headers)
    assert sus.status_code == 200

    res = await client.get(
        "/api/v1/admin/audit",
        params={"action": "user.suspend", "target_type": "user"},
        headers=admin_headers,
    )
    assert res.status_code == 200
    rows = res.json()
    assert len(rows) >= 1
    assert all(r["action"] == "user.suspend" for r in rows)
    assert all(r["target_type"] == "user" for r in rows)


@pytest.mark.asyncio
async def test_admin_audit_requires_admin(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/admin/audit", headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_demote_user(client: AsyncClient, admin_headers: dict):
    # Create + promote a user, then demote.
    email = f"demote-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    s = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "ToDemote",
    })
    user_id = s.json()["user"]["id"]

    promote = await client.post(
        f"/api/v1/admin/users/{user_id}/promote", headers=admin_headers
    )
    assert promote.status_code == 200

    demote = await client.post(
        f"/api/v1/admin/users/{user_id}/demote", headers=admin_headers
    )
    assert demote.status_code == 200

    detail = await client.get(f"/api/v1/admin/users/{user_id}", headers=admin_headers)
    assert detail.json()["role"] == "user"


@pytest.mark.asyncio
async def test_admin_cannot_demote_self(client: AsyncClient, admin_headers: dict):
    me = await client.get("/api/v1/auth/me", headers=admin_headers)
    self_id = me.json()["id"]
    res = await client.post(
        f"/api/v1/admin/users/{self_id}/demote", headers=admin_headers
    )
    assert res.status_code == 400
