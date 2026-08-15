"""The QR collar tag's whole purpose: a finder can reach the owner.

Before this existed, scanning a tag showed the pet's bio and traits and gave
the finder no contact channel at all.
"""
import uuid

import pytest
from httpx import AsyncClient

import app.routers.public as public_router
from app.config import settings
from app.models.pet import Pet
from app.models.qr_tag import QRTag
from app.models.user import User


async def _tag_for_new_pet(db_session, *, is_public: bool = True, active: bool = True):
    owner = User(
        id=uuid.uuid4(), email=f"owner-{uuid.uuid4()}@t.dev",
        password_hash="x", display_name="Tag Owner", is_active=True,
    )
    pet = Pet(
        id=uuid.uuid4(), owner_id=owner.id, name="Rex", species="dog",
        is_active=active, is_public=is_public,
    )
    tag = QRTag(code=uuid.uuid4().hex[:8].upper(), pet_id=pet.id)
    db_session.add_all([owner, pet, tag])
    await db_session.commit()
    return tag, pet, owner


@pytest.fixture
def captured_mail(monkeypatch):
    """Pretend email is configured and record what would have been sent."""
    sent: list[dict] = []

    async def fake_send(to, **kwargs):
        sent.append({"to": to, **kwargs})
        return True

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(public_router, "send_tag_found_email", fake_send)
    return sent


BODY = {
    "finder_name": "Jane Passerby",
    "finder_contact": "555-0100",
    "message": "Found him on Queen St, he's safe with me.",
}


@pytest.mark.asyncio
async def test_finder_can_reach_owner_without_an_account(
    client: AsyncClient, db_session, captured_mail
):
    """No auth header — a stranger holding a lost dog will not sign up first."""
    tag, pet, owner = await _tag_for_new_pet(db_session)

    res = await client.post(f"/api/v1/public/tags/{tag.code}/contact", json=BODY)
    assert res.status_code == 200

    assert len(captured_mail) == 1
    mail = captured_mail[0]
    assert mail["to"] == owner.email
    assert mail["pet_name"] == pet.name
    assert mail["finder_contact"] == "555-0100"
    assert mail["tag_code"] == tag.code


@pytest.mark.asyncio
async def test_response_never_leaks_the_owner_address(
    client: AsyncClient, db_session, captured_mail
):
    tag, pet, owner = await _tag_for_new_pet(db_session)
    res = await client.post(f"/api/v1/public/tags/{tag.code}/contact", json=BODY)
    assert owner.email not in res.text


@pytest.mark.asyncio
async def test_private_pet_still_reachable(
    client: AsyncClient, db_session, captured_mail
):
    """Hiding the share page means "don't list me", not "don't tell me my pet
    was found" — the tag exists precisely for that message."""
    tag, _pet, owner = await _tag_for_new_pet(db_session, is_public=False)
    res = await client.post(f"/api/v1/public/tags/{tag.code}/contact", json=BODY)
    assert res.status_code == 200
    assert captured_mail[0]["to"] == owner.email


@pytest.mark.asyncio
async def test_lowercase_code_is_accepted(
    client: AsyncClient, db_session, captured_mail
):
    tag, _pet, _owner = await _tag_for_new_pet(db_session)
    res = await client.post(
        f"/api/v1/public/tags/{tag.code.lower()}/contact", json=BODY
    )
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_unknown_and_unassigned_tags_404(
    client: AsyncClient, db_session, captured_mail
):
    unassigned = QRTag(code=uuid.uuid4().hex[:8].upper(), pet_id=None)
    db_session.add(unassigned)
    await db_session.commit()

    assert (await client.post(
        "/api/v1/public/tags/NOSUCHTG/contact", json=BODY
    )).status_code == 404
    assert (await client.post(
        f"/api/v1/public/tags/{unassigned.code}/contact", json=BODY
    )).status_code == 404
    assert captured_mail == []


@pytest.mark.asyncio
async def test_deactivated_pet_is_not_reachable(
    client: AsyncClient, db_session, captured_mail
):
    tag, _pet, _owner = await _tag_for_new_pet(db_session, active=False)
    res = await client.post(f"/api/v1/public/tags/{tag.code}/contact", json=BODY)
    assert res.status_code == 404
    assert captured_mail == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {**BODY, "message": "   "},
        {**BODY, "finder_name": ""},
        {**BODY, "finder_contact": "x"},
        {**BODY, "message": "x" * 1001},
    ],
)
async def test_rejects_junk_payloads(
    client: AsyncClient, db_session, captured_mail, payload
):
    tag, _pet, _owner = await _tag_for_new_pet(db_session)
    res = await client.post(f"/api/v1/public/tags/{tag.code}/contact", json=payload)
    assert res.status_code == 422
    assert captured_mail == []


@pytest.mark.asyncio
async def test_503_when_email_unconfigured(client: AsyncClient, db_session):
    """Degrade honestly rather than pretending the message was delivered."""
    assert settings.RESEND_API_KEY == ""
    tag, _pet, _owner = await _tag_for_new_pet(db_session)
    res = await client.post(f"/api/v1/public/tags/{tag.code}/contact", json=BODY)
    assert res.status_code == 503


@pytest.mark.asyncio
async def test_unknown_tag_404s_even_without_email_configured(
    client: AsyncClient, db_session
):
    """Validation errors stay meaningful when the relay is down."""
    assert settings.RESEND_API_KEY == ""
    res = await client.post("/api/v1/public/tags/NOSUCHTG/contact", json=BODY)
    assert res.status_code == 404
