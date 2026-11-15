import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_missing_report(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Lost golden retriever near the park",
        "last_seen_lat": 37.7749,
        "last_seen_lng": -122.4194,
    }, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["kind"] == "missing"
    assert data["status"] == "open"
    assert data["description"] == "Lost golden retriever near the park"


@pytest.mark.asyncio
async def test_create_found_report_new_account_blocked(client: AsyncClient):
    """New accounts (< 7 days old) cannot report found pets."""
    email = f"newuser-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "New User"
    })
    token = signup_res.json()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.post("/api/v1/lost/reports", json={
        "kind": "found",
        "description": "Found a small brown pet",
        "last_seen_lat": 37.77,
        "last_seen_lng": -122.42,
    }, headers=headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_get_report(client: AsyncClient, auth_headers: dict):
    # Create
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Test pet missing",
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    # Get
    res = await client.get(f"/api/v1/lost/reports/{report_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["id"] == report_id


@pytest.mark.asyncio
async def test_resolve_report(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Will resolve this",
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    res = await client.post(f"/api/v1/lost/reports/{report_id}/resolve", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "resolved"


@pytest.mark.asyncio
async def test_add_sighting(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Missing pet with sighting",
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    # Add sighting as another user
    email = f"sighter-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Sighter"
    })
    sighter_headers = {"Authorization": f"Bearer {signup_res.json()['tokens']['access_token']}"}

    res = await client.post(
        f"/api/v1/lost/reports/{report_id}/sightings",
        data={
            "lat": "37.78",
            "lng": "-122.41",
            "note": "Saw this pet near the coffee shop",
        },
        headers=sighter_headers,
    )
    assert res.status_code == 201
    assert res.json()["note"] == "Saw this pet near the coffee shop"
    assert res.json()["photo_url"] is None


@pytest.mark.asyncio
async def test_nearby_reports(client: AsyncClient, auth_headers: dict):
    # Create a report with coordinates
    await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Near test",
        "last_seen_lat": 37.7749,
        "last_seen_lng": -122.4194,
    }, headers=auth_headers)

    res = await client.get(
        "/api/v1/lost/reports/nearby",
        params={"lat": 37.77, "lng": -122.42, "radius_km": 10},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    # Should find at least our report
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_create_subscription(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/lost/subscriptions", json={
        "home_lat": 37.7749,
        "home_lng": -122.4194,
        "radius_km": 15,
    }, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["radius_km"] == 15


@pytest.mark.asyncio
async def test_get_my_subscription(client: AsyncClient, auth_headers: dict):
    # Create first
    await client.post("/api/v1/lost/subscriptions", json={
        "home_lat": 37.77, "home_lng": -122.42, "radius_km": 10,
    }, headers=auth_headers)

    res = await client.get("/api/v1/lost/subscriptions/mine", headers=auth_headers)
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_contact_reporter_relays_email(client: AsyncClient, auth_headers: dict, monkeypatch):
    from app.config import settings
    import app.routers.lost as lost_router

    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing", "description": "Contact test"
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    # Contact as another user
    email = f"contacter-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Contacter"
    })
    other_headers = {"Authorization": f"Bearer {signup_res.json()['tokens']['access_token']}"}

    sent: list[dict] = []

    async def fake_relay(to, **kwargs):
        sent.append({"to": to, **kwargs})
        return True

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(lost_router, "send_contact_relay_email", fake_relay)

    res = await client.post(f"/api/v1/lost/reports/{report_id}/contact", json={
        "message": "I think I saw your pet!"
    }, headers=other_headers)
    assert res.status_code == 200

    assert len(sent) == 1
    assert sent[0]["sender_email"] == email
    assert sent[0]["message"] == "I think I saw your pet!"
    # The reporter's address is the recipient, never surfaced to the sender.
    assert sent[0]["to"] != email


@pytest.mark.asyncio
async def test_contact_reporter_503_when_email_unconfigured(
    client: AsyncClient, auth_headers: dict
):
    """No provider — the relay is honestly down instead of pretending to send."""
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing", "description": "Contact 503 test"
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    email = f"contacter-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Contacter"
    })
    other_headers = {"Authorization": f"Bearer {signup_res.json()['tokens']['access_token']}"}

    res = await client.post(f"/api/v1/lost/reports/{report_id}/contact", json={
        "message": "I think I saw your pet!"
    }, headers=other_headers)
    assert res.status_code == 503


@pytest.mark.asyncio
async def test_cannot_contact_self(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing", "description": "Self contact test"
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    res = await client.post(f"/api/v1/lost/reports/{report_id}/contact", json={
        "message": "Trying to contact myself"
    }, headers=auth_headers)
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_list_sightings_returns_added_sightings(
    client: AsyncClient, auth_headers: dict
):
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing", "description": "Sightings list test",
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    # A different user adds two sightings.
    email = f"witness-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    s = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Witness",
    })
    witness_headers = {"Authorization": f"Bearer {s.json()['tokens']['access_token']}"}
    for note in ("First", "Second"):
        await client.post(
            f"/api/v1/lost/reports/{report_id}/sightings",
            data={"lat": "37.78", "lng": "-122.41", "note": note},
            headers=witness_headers,
        )

    res = await client.get(
        f"/api/v1/lost/reports/{report_id}/sightings", headers=auth_headers,
    )
    assert res.status_code == 200
    notes = [s["note"] for s in res.json()]
    assert "First" in notes
    assert "Second" in notes


@pytest.mark.asyncio
async def test_patch_subscription_updates_radius(
    client: AsyncClient, auth_headers: dict
):
    # New user so we don't collide with subscription state from earlier tests.
    email = f"subpatch-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    s = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "SubPatcher",
    })
    headers = {"Authorization": f"Bearer {s.json()['tokens']['access_token']}"}

    await client.post("/api/v1/lost/subscriptions", json={
        "home_lat": 37.77, "home_lng": -122.42, "radius_km": 10,
    }, headers=headers)

    res = await client.patch(
        "/api/v1/lost/subscriptions/mine",
        json={"radius_km": 25},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["radius_km"] == 25


@pytest.mark.asyncio
async def test_patch_subscription_404_when_none(client: AsyncClient):
    email = f"nosub-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    s = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "NoSub",
    })
    headers = {"Authorization": f"Bearer {s.json()['tokens']['access_token']}"}
    res = await client.patch(
        "/api/v1/lost/subscriptions/mine",
        json={"radius_km": 5},
        headers=headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_lost_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/lost/reports/nearby", params={"lat": 37, "lng": -122, "radius_km": 5})
    assert res.status_code in (401, 403)


async def _new_user(client: AsyncClient, name: str) -> dict:
    res = await client.post("/api/v1/auth/signup", json={
        "email": f"{name}-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "password123", "display_name": name.title(),
    })
    return {"Authorization": f"Bearer {res.json()['tokens']['access_token']}"}


async def _inbox_titles(client: AsyncClient, headers: dict) -> list[str]:
    res = await client.get("/api/v1/notifications/inbox", headers=headers)
    assert res.status_code == 200
    body = res.json()
    items = body["items"] if isinstance(body, dict) else body
    return [n["title"] for n in items if n["type"] == "lost_reunited"]


@pytest.mark.asyncio
async def test_reunion_thanks_each_helper_once(client: AsyncClient):
    """When a missing pet is marked home, everyone who reported a sighting is
    told — once, by the pet's name — and the owner is not told about their own
    reunion. A second resolve says nothing new."""
    owner = await _new_user(client, "owner")
    pet = await client.post("/api/v1/pets", json={"name": "Biscuit"}, headers=owner)
    report = await client.post("/api/v1/lost/reports", json={
        "kind": "missing", "pet_id": pet.json()["id"], "description": "Small tan terrier",
        "last_seen_lat": 43.65, "last_seen_lng": -79.38,
    }, headers=owner)
    report_id = report.json()["id"]

    helper = await _new_user(client, "helper")
    for _ in range(2):  # two sightings, one person
        res = await client.post(
            f"/api/v1/lost/reports/{report_id}/sightings",
            data={"lat": "43.651", "lng": "-79.381"}, headers=helper,
        )
        assert res.status_code == 201

    assert (await client.post(f"/api/v1/lost/reports/{report_id}/resolve", headers=owner)).status_code == 200
    assert await _inbox_titles(client, helper) == ["Biscuit is home"]
    assert await _inbox_titles(client, owner) == []

    assert (await client.post(f"/api/v1/lost/reports/{report_id}/resolve", headers=owner)).status_code == 200
    assert await _inbox_titles(client, helper) == ["Biscuit is home"]


@pytest.mark.asyncio
async def test_reunion_share_page_names_the_pet(client: AsyncClient):
    owner = await _new_user(client, "owner")
    pet = await client.post("/api/v1/pets", json={"name": "Pickle"}, headers=owner)
    report = await client.post("/api/v1/lost/reports", json={
        "kind": "missing", "pet_id": pet.json()["id"], "description": "Grey cat",
        "last_seen_lat": 43.65, "last_seen_lng": -79.38, "is_public": True,
    }, headers=owner)
    report_id = report.json()["id"]
    await client.post(f"/api/v1/lost/reports/{report_id}/resolve", headers=owner)

    page = await client.get(f"/lost/{report_id}")
    assert page.status_code == 200
    assert "Pickle is home safe." in page.text
    assert "Thank you to everyone who looked and shared." in page.text
