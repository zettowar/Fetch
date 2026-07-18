import time
import uuid

import pytest
from httpx import AsyncClient

from app.services import totp


async def _signup(client: AsyncClient, prefix: str) -> dict:
    email = f"{prefix}-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": prefix.title(),
    })
    assert res.status_code == 201, res.text
    j = res.json()
    return {"id": j["user"]["id"], "email": email,
            "headers": {"Authorization": f"Bearer {j['tokens']['access_token']}"}}


async def _set_role(client: AsyncClient, admin_headers: dict, user_id: str, role: str):
    res = await client.post(
        f"/api/v1/admin/users/{user_id}/set-role",
        params={"role": role}, headers=admin_headers,
    )
    assert res.status_code == 200, res.text


# --- Ticket notes (defect #2) ---

@pytest.mark.asyncio
async def test_ticket_admin_notes_persisted(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    created = await client.post("/api/v1/support/tickets", json={
        "subject": "Help", "body": "Something broke",
    }, headers=auth_headers)
    ticket_id = created.json()["id"]

    upd = await client.post(f"/api/v1/admin/tickets/{ticket_id}/update", json={
        "status": "resolved", "admin_notes": "Fixed by clearing cache",
    }, headers=admin_headers)
    assert upd.status_code == 200
    assert upd.json()["admin_notes"] == "Fixed by clearing cache"

    # And it survives a re-fetch through the list.
    listing = await client.get("/api/v1/support/tickets", params={"status_filter": "resolved"}, headers=admin_headers)
    match = [t for t in listing.json() if t["id"] == ticket_id]
    assert match and match[0]["admin_notes"] == "Fixed by clearing cache"


@pytest.mark.asyncio
async def test_ticket_search_and_pagination(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    marker = uuid.uuid4().hex[:10]
    await client.post("/api/v1/support/tickets", json={
        "subject": f"unique {marker}", "body": "body",
    }, headers=auth_headers)
    res = await client.get("/api/v1/support/tickets", params={"status_filter": "all", "q": marker}, headers=admin_headers)
    assert res.status_code == 200
    assert res.headers.get("x-total-count") == "1"
    assert len(res.json()) == 1


# --- Tiered roles ---

@pytest.mark.asyncio
async def test_moderator_can_moderate_but_not_delete(client: AsyncClient, admin_headers: dict):
    mod = await _signup(client, "mod")
    await _set_role(client, admin_headers, mod["id"], "moderator")

    # Staff surface: reports list — allowed.
    reports = await client.get("/api/v1/admin/reports", headers=mod["headers"])
    assert reports.status_code == 200
    # Admin-only surface: delete a user — forbidden.
    victim = await _signup(client, "victim")
    dele = await client.delete(f"/api/v1/admin/users/{victim['id']}", headers=mod["headers"])
    assert dele.status_code == 403
    # Admin-only: set roles — forbidden for a moderator.
    forbidden = await client.post(
        f"/api/v1/admin/users/{victim['id']}/set-role",
        params={"role": "moderator"}, headers=mod["headers"])
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_set_role_cannot_target_self(client: AsyncClient, admin_headers: dict):
    me = await client.get("/api/v1/auth/me", headers=admin_headers)
    res = await client.post(
        f"/api/v1/admin/users/{me.json()['id']}/set-role",
        params={"role": "user"}, headers=admin_headers)
    assert res.status_code == 400


# --- Login audit ---

@pytest.mark.asyncio
async def test_staff_login_is_audited(client: AsyncClient, admin_headers: dict):
    staff = await _signup(client, "staff")
    await _set_role(client, admin_headers, staff["id"], "moderator")
    login = await client.post("/api/v1/auth/login", json={
        "email": staff["email"], "password": "password123",
    })
    assert login.status_code == 200
    audit = await client.get("/api/v1/admin/audit", params={
        "action": "auth.login", "actor_id": staff["id"],
    }, headers=admin_headers)
    assert len(audit.json()) >= 1


# --- 2FA ---

@pytest.mark.asyncio
async def test_2fa_full_lifecycle(client: AsyncClient):
    u = await _signup(client, "twofa")

    setup = await client.post("/api/v1/auth/2fa/setup", headers=u["headers"])
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    assert setup.json()["otpauth_uri"].startswith("otpauth://totp/")

    # Wrong code rejected.
    bad = await client.post("/api/v1/auth/2fa/enable", json={"code": "000000"}, headers=u["headers"])
    assert bad.status_code == 400

    code = totp._hotp(secret, int(time.time() // 30))
    good = await client.post("/api/v1/auth/2fa/enable", json={"code": code}, headers=u["headers"])
    assert good.status_code == 200

    # Login now needs the second factor.
    no_otp = await client.post("/api/v1/auth/login", json={"email": u["email"], "password": "password123"})
    assert no_otp.status_code == 401
    assert no_otp.headers.get("x-2fa-required") == "1"

    with_otp = await client.post("/api/v1/auth/login", json={
        "email": u["email"], "password": "password123",
        "otp": totp._hotp(secret, int(time.time() // 30)),
    })
    assert with_otp.status_code == 200

    # Disable with password.
    off = await client.post("/api/v1/auth/2fa/disable", json={"password": "password123"}, headers=u["headers"])
    assert off.status_code == 200
    plain = await client.post("/api/v1/auth/login", json={"email": u["email"], "password": "password123"})
    assert plain.status_code == 200


# --- Admin user actions ---

@pytest.mark.asyncio
async def test_admin_edit_user_and_email_conflict(client: AsyncClient, admin_headers: dict):
    a = await _signup(client, "edita")
    b = await _signup(client, "editb")

    ok = await client.patch(f"/api/v1/admin/users/{a['id']}", json={"display_name": "Renamed"}, headers=admin_headers)
    assert ok.status_code == 200
    detail = await client.get(f"/api/v1/admin/users/{a['id']}", headers=admin_headers)
    assert detail.json()["display_name"] == "Renamed"

    # Taking b's email must 409.
    conflict = await client.patch(f"/api/v1/admin/users/{a['id']}", json={"email": b["email"]}, headers=admin_headers)
    assert conflict.status_code == 409


@pytest.mark.asyncio
async def test_admin_mark_verified_and_resend(client: AsyncClient, admin_headers: dict):
    u = await _signup(client, "verify")
    detail = await client.get(f"/api/v1/admin/users/{u['id']}", headers=admin_headers)
    assert detail.json()["is_verified"] is False

    resend = await client.post(f"/api/v1/admin/users/{u['id']}/resend-verification", headers=admin_headers)
    assert resend.status_code == 200

    mark = await client.post(f"/api/v1/admin/users/{u['id']}/mark-verified", headers=admin_headers)
    assert mark.status_code == 200
    detail2 = await client.get(f"/api/v1/admin/users/{u['id']}", headers=admin_headers)
    assert detail2.json()["is_verified"] is True

    reset = await client.post(f"/api/v1/admin/users/{u['id']}/send-password-reset", headers=admin_headers)
    assert reset.status_code == 200


@pytest.mark.asyncio
async def test_impersonate_guards_and_token(client: AsyncClient, admin_headers: dict):
    target = await _signup(client, "imp")
    res = await client.post(f"/api/v1/admin/users/{target['id']}/impersonate", headers=admin_headers)
    assert res.status_code == 200
    token = res.json()["access_token"]
    # The issued token authenticates as the target.
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["id"] == target["id"]

    # Cannot impersonate a staff member.
    staff = await _signup(client, "impstaff")
    await _set_role(client, admin_headers, staff["id"], "moderator")
    blocked = await client.post(f"/api/v1/admin/users/{staff['id']}/impersonate", headers=admin_headers)
    assert blocked.status_code == 400


# --- Rescue oversight ---

@pytest.mark.asyncio
async def test_rescue_set_status_rereview_and_edit(client: AsyncClient, admin_headers: dict):
    email = f"resc-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup-rescue", json={
        "email": email, "password": "password123",
        "org_name": "Happy Tails", "description": "We rescue pets",
    })
    assert signup.status_code == 201, signup.text
    profile_id = signup.json()["rescue_profile"]["id"]

    approve = await client.post(f"/api/v1/admin/rescue-profiles/{profile_id}/set-status", json={
        "status": "approved", "note": "verified",
    }, headers=admin_headers)
    assert approve.status_code == 200
    # Re-review of an already-approved rescue (impossible via the one-shot /review).
    revoke = await client.post(f"/api/v1/admin/rescue-profiles/{profile_id}/set-status", json={
        "status": "rejected", "note": "revoked",
    }, headers=admin_headers)
    assert revoke.status_code == 200
    assert revoke.json()["status"] == "rejected"

    edit = await client.patch(f"/api/v1/admin/rescue-profiles/{profile_id}", json={
        "org_name": "Happy Tails Rescue",
    }, headers=admin_headers)
    assert edit.status_code == 200
    assert edit.json()["org_name"] == "Happy Tails Rescue"


@pytest.mark.asyncio
async def test_adoption_inquiries_list(client: AsyncClient, admin_headers: dict):
    res = await client.get("/api/v1/admin/adoption-inquiries", headers=admin_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert "x-total-count" in {k.lower() for k in res.headers.keys()}


# --- Announcements ---

@pytest.mark.asyncio
async def test_create_and_list_announcement(client: AsyncClient, admin_headers: dict):
    res = await client.post("/api/v1/admin/announcements", json={
        "title": "Scheduled maintenance", "body": "We'll be down at 2am.", "segment": "staff",
    }, headers=admin_headers)
    assert res.status_code == 201, res.text
    ann_id = res.json()["id"]
    listing = await client.get("/api/v1/admin/announcements", headers=admin_headers)
    assert any(a["id"] == ann_id for a in listing.json())


# --- Settings / feature flags ---

@pytest.mark.asyncio
async def test_settings_toggle_pauses_signups(client: AsyncClient, admin_headers: dict):
    get = await client.get("/api/v1/admin/settings", headers=admin_headers)
    assert get.status_code == 200
    keys = {s["key"] for s in get.json()}
    assert "signups_paused" in keys

    try:
        put = await client.put("/api/v1/admin/settings/signups_paused", json={"value": True}, headers=admin_headers)
        assert put.status_code == 200

        blocked = await client.post("/api/v1/auth/signup", json={
            "email": f"paused-{uuid.uuid4().hex[:8]}@fetchapp.dev",
            "password": "password123", "display_name": "Nope",
        })
        assert blocked.status_code == 403
    finally:
        await client.put("/api/v1/admin/settings/signups_paused", json={"value": False}, headers=admin_headers)

    # Signups work again after unpausing.
    ok = await client.post("/api/v1/auth/signup", json={
        "email": f"resumed-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "password123", "display_name": "Yes",
    })
    assert ok.status_code == 201


@pytest.mark.asyncio
async def test_unknown_setting_rejected(client: AsyncClient, admin_headers: dict):
    res = await client.put("/api/v1/admin/settings/not_a_real_flag", json={"value": 1}, headers=admin_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_public_flags_reflect_explore_toggle(client: AsyncClient, admin_headers: dict):
    # Public, unauthenticated, and defaults to enabled.
    res = await client.get("/api/v1/public/flags")
    assert res.status_code == 200
    assert res.json()["explore_enabled"] is True
    assert "explore_shop_enabled" in res.json()

    try:
        put = await client.put(
            "/api/v1/admin/settings/explore_enabled", json={"value": False}, headers=admin_headers
        )
        assert put.status_code == 200
        res = await client.get("/api/v1/public/flags")
        assert res.json()["explore_enabled"] is False
    finally:
        await client.put(
            "/api/v1/admin/settings/explore_enabled", json={"value": True}, headers=admin_headers
        )


# --- System / jobs ---

@pytest.mark.asyncio
async def test_system_jobs_reports_registered_tasks(client: AsyncClient, admin_headers: dict):
    res = await client.get("/api/v1/admin/system/jobs", headers=admin_headers)
    assert res.status_code == 200
    body = res.json()
    # Scheduled jobs moved to the editable /admin/scheduled-tasks endpoint.
    assert "beat_jobs" not in body
    assert body["registered_tasks"], "expected registered app tasks"
    assert all(t.startswith("app.tasks.") for t in body["registered_tasks"])


# --- Donation refund ---

@pytest.mark.asyncio
async def test_refund_requires_stripe(client: AsyncClient, admin_headers: dict):
    # Stripe is unconfigured in tests, so refund should 503 rather than error.
    res = await client.post(f"/api/v1/admin/donations/{uuid.uuid4()}/refund", headers=admin_headers)
    assert res.status_code == 503
