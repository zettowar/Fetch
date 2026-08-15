"""A rescue transferring a pet to an adopter used to be a silent dead letter.

No email was sent, and under INVITE_REQUIRED the recipient could not sign up to
discover the transfer either — it just expired.
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

import app.routers.rescues as rescues_router
from app.config import settings
from app.models.beta import InviteCode
from app.models.pet import Pet
from app.models.rescue import RescueProfile


@pytest.fixture
def sent_mail(monkeypatch):
    sent: list[dict] = []

    async def fake_send(to, **kwargs):
        sent.append({"to": to, **kwargs})
        return True

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(rescues_router, "send_transfer_invite_email", fake_send)
    return sent


async def _approved_rescue(client: AsyncClient, db_session):
    """A rescue account with an approved profile and one adoptable pet."""
    email = f"rescue-{uuid.uuid4().hex[:8]}@t.dev"
    res = await client.post("/api/v1/auth/signup-rescue", json={
        "email": email, "password": "testpass123", "display_name": "Rescue",
        "org_name": "Happy Tails", "description": "We rehome pets.",
        "contact_email": email,
    })
    assert res.status_code == 201, res.text
    headers = {"Authorization": f"Bearer {res.json()['tokens']['access_token']}"}

    user_id = uuid.UUID(res.json()["user"]["id"])
    profile = (await db_session.execute(
        select(RescueProfile).where(RescueProfile.user_id == user_id)
    )).scalar_one()
    profile.status = "approved"
    pet = Pet(id=uuid.uuid4(), owner_id=user_id, name="Biscuit", species="dog",
              is_active=True)
    db_session.add(pet)
    await db_session.commit()
    return headers, pet


@pytest.mark.asyncio
async def test_emails_a_brand_new_adopter_with_a_working_invite(
    client: AsyncClient, db_session, sent_mail
):
    headers, pet = await _approved_rescue(client, db_session)
    adopter_email = f"adopter-{uuid.uuid4().hex[:8]}@t.dev"

    res = await client.post(
        f"/api/v1/rescues/pets/{pet.id}/transfer",
        json={"invited_email": adopter_email}, headers=headers,
    )
    assert res.status_code == 201

    assert len(sent_mail) == 1
    mail = sent_mail[0]
    assert mail["to"] == adopter_email
    assert mail["pet_name"] == "Biscuit"
    assert mail["rescue_name"] == "Happy Tails"

    # The code must exist, be unused, and be bound to the invited address.
    code = (await db_session.execute(
        select(InviteCode).where(InviteCode.code == mail["signup_code"])
    )).scalar_one()
    assert code.is_used is False
    assert code.invited_email == adopter_email


@pytest.mark.asyncio
async def test_existing_member_is_emailed_without_an_invite_code(
    client: AsyncClient, auth_headers: dict, db_session, sent_mail
):
    headers, pet = await _approved_rescue(client, db_session)
    me = (await client.get("/api/v1/users/me", headers=auth_headers)).json()

    res = await client.post(
        f"/api/v1/rescues/pets/{pet.id}/transfer",
        json={"invited_email": me["email"]}, headers=headers,
    )
    assert res.status_code == 201
    assert len(sent_mail) == 1
    assert sent_mail[0]["to"] == me["email"]
    # They already have an account; minting a seat would be wrong.
    assert sent_mail[0]["signup_code"] is None


@pytest.mark.asyncio
async def test_bound_code_only_works_for_the_invited_address(
    client: AsyncClient, db_session, sent_mail, monkeypatch
):
    """Forwarding the email must not hand someone else a way past the gate."""
    headers, pet = await _approved_rescue(client, db_session)
    adopter_email = f"adopter-{uuid.uuid4().hex[:8]}@t.dev"
    await client.post(
        f"/api/v1/rescues/pets/{pet.id}/transfer",
        json={"invited_email": adopter_email}, headers=headers,
    )
    code = sent_mail[0]["signup_code"]

    monkeypatch.setattr(settings, "INVITE_REQUIRED", True)

    stolen = await client.post("/api/v1/auth/signup", json={
        "email": f"someone-else-{uuid.uuid4().hex[:6]}@t.dev",
        "password": "testpass123", "display_name": "Interloper",
        "invite_code": code,
    })
    assert stolen.status_code == 400

    intended = await client.post("/api/v1/auth/signup", json={
        "email": adopter_email, "password": "testpass123",
        "display_name": "Adopter", "invite_code": code,
    })
    assert intended.status_code == 201


@pytest.mark.asyncio
async def test_general_codes_stay_usable_by_anyone(
    client: AsyncClient, db_session, monkeypatch
):
    """Admin/member invites carry no address and must keep working as before."""
    code = InviteCode(code=f"FETCH-{uuid.uuid4().hex[:8].upper()}")
    db_session.add(code)
    await db_session.commit()

    monkeypatch.setattr(settings, "INVITE_REQUIRED", True)
    res = await client.post("/api/v1/auth/signup", json={
        "email": f"anyone-{uuid.uuid4().hex[:6]}@t.dev",
        "password": "testpass123", "display_name": "Anyone",
        "invite_code": code.code,
    })
    assert res.status_code == 201


@pytest.mark.asyncio
async def test_invite_lookup_prefills_the_transfer_address(
    client: AsyncClient, db_session, sent_mail
):
    headers, pet = await _approved_rescue(client, db_session)
    adopter_email = f"adopter-{uuid.uuid4().hex[:8]}@t.dev"
    await client.post(
        f"/api/v1/rescues/pets/{pet.id}/transfer",
        json={"invited_email": adopter_email}, headers=headers,
    )
    code = sent_mail[0]["signup_code"]

    res = await client.get(f"/api/v1/public/invite/{code}")
    assert res.status_code == 200
    assert res.json() == {"status": "valid", "email": adopter_email}


@pytest.mark.asyncio
async def test_no_email_provider_does_not_break_the_transfer(
    client: AsyncClient, db_session
):
    """The transfer row must still be created when email is unconfigured."""
    assert settings.RESEND_API_KEY == ""
    headers, pet = await _approved_rescue(client, db_session)
    res = await client.post(
        f"/api/v1/rescues/pets/{pet.id}/transfer",
        json={"invited_email": f"x-{uuid.uuid4().hex[:6]}@t.dev"}, headers=headers,
    )
    assert res.status_code == 201
