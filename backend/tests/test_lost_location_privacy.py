"""The published location of a lost pet must not lead back to the real one.

For a missing-pet report the true point is normally the owner's home, the share
page is public by default, and it is emitted with `index,follow` and listed in
sitemap.xml — so a disclosure here is permanent the moment it is crawled.

The bug these tests exist for: the published point was computed on read as
`random.Random(str(report.id))`. The seed was the report id, which is the public
URL, so replaying the draw recovered the true coordinates to ~26 cm.
"""
import math
import random

import pytest
from httpx import AsyncClient

# A real address-sized coordinate; the attacks below are scale-sensitive.
TRUE_LAT = 43.6532000
TRUE_LNG = -79.3831999
M_PER_DEG_LAT = 111_320.0


def _metres_apart(lat1, lng1, lat2, lng2) -> float:
    dlat = (lat1 - lat2) * M_PER_DEG_LAT
    dlng = (lng1 - lng2) * M_PER_DEG_LAT * math.cos(math.radians(lat1))
    return math.hypot(dlat, dlng)


async def _file_report(client: AsyncClient, headers: dict, *, fuzz_m: int = 500) -> dict:
    pet = await client.post(
        "/api/v1/pets", json={"name": "Scout", "species": "dog"}, headers=headers
    )
    assert pet.status_code == 201, pet.text
    res = await client.post(
        "/api/v1/lost/reports",
        json={
            "pet_id": pet.json()["id"],
            "kind": "missing",
            "last_seen_lat": TRUE_LAT,
            "last_seen_lng": TRUE_LNG,
            "location_fuzz_m": fuzz_m,
            "description": "Scout slipped his collar near home",
            "is_public": True,
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _published_point(client: AsyncClient, report_id: str, headers: dict):
    """What a NON-owner sees. Uses a second account, not the reporter."""
    res = await client.get(f"/api/v1/lost/reports/{report_id}", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    return body["last_seen_lat"], body["last_seen_lng"]


@pytest.mark.asyncio
async def test_replaying_the_report_id_as_a_seed_no_longer_finds_the_true_point(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """The exact attack, executed the way an outsider would.

    Everything used here is public: the report id (it is the URL) and the fuzz
    radius (the share page prints it). Against the old code this recovered the
    true coordinates to within a metre.
    """
    report = await _file_report(client, auth_headers, fuzz_m=500)
    pub_lat, pub_lng = await _published_point(client, report["id"], admin_headers)
    assert pub_lat is not None, "a public point must exist"

    rng = random.Random(str(report["id"]))
    angle = rng.uniform(0, 2 * math.pi)
    distance = rng.uniform(0, 500)
    guess_lat = pub_lat - (distance * math.cos(angle)) / M_PER_DEG_LAT
    guess_lng = pub_lng - (distance * math.sin(angle)) / (
        M_PER_DEG_LAT * math.cos(math.radians(pub_lat))
    )

    error_m = _metres_apart(guess_lat, guess_lng, TRUE_LAT, TRUE_LNG)
    assert error_m > 50, (
        f"the seed replay landed {error_m:.2f} m from the true point — the "
        "published coordinates are still derived from the public report id"
    )


@pytest.mark.asyncio
async def test_the_published_point_is_inside_the_radius_it_advertises(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """It has to be honest as well as unrecoverable: the page says 'within ~N m'."""
    report = await _file_report(client, auth_headers, fuzz_m=500)
    pub_lat, pub_lng = await _published_point(client, report["id"], admin_headers)
    offset = _metres_apart(pub_lat, pub_lng, TRUE_LAT, TRUE_LNG)
    assert 0 < offset <= 500, f"published point sits {offset:.0f} m away, radius is 500 m"


@pytest.mark.asyncio
async def test_the_point_does_not_move_between_reads(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """A point that is re-rolled per request can be averaged back to the centre."""
    report = await _file_report(client, auth_headers)
    first = await _published_point(client, report["id"], admin_headers)
    for _ in range(4):
        assert await _published_point(client, report["id"], admin_headers) == first


@pytest.mark.asyncio
async def test_raising_the_fuzz_radius_does_not_publish_a_second_point(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """Two published points for one true point solve for the true point.

    P1 = T + u·f1·(cos a, sin a) and P2 = T + u·f2·(cos a, sin a) are two
    equations in two unknowns. The owner who triggers it is the one RAISING
    their radius to get more privacy, which makes it the worst possible leak to
    ship. So a radius increase must keep the existing point.
    """
    report = await _file_report(client, auth_headers, fuzz_m=500)
    before = await _published_point(client, report["id"], admin_headers)

    res = await client.patch(
        f"/api/v1/lost/reports/{report['id']}",
        json={"location_fuzz_m": 4000},
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text

    after = await _published_point(client, report["id"], admin_headers)
    assert after == before, (
        "raising the fuzz radius republished the location; an observer with "
        "both points can solve for the true coordinates"
    )


@pytest.mark.asyncio
async def test_shrinking_the_radius_below_the_offset_republishes_honestly(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """The one case where moving the point is right: keeping it would make the
    advertised radius a lie. Reducing the radius is the owner asking for less
    privacy, not more."""
    report = await _file_report(client, auth_headers, fuzz_m=4000)
    before = await _published_point(client, report["id"], admin_headers)

    await client.patch(
        f"/api/v1/lost/reports/{report['id']}",
        json={"location_fuzz_m": 50},
        headers=auth_headers,
    )
    after = await _published_point(client, report["id"], admin_headers)

    offset = _metres_apart(after[0], after[1], TRUE_LAT, TRUE_LNG)
    assert offset <= 50, f"published point is {offset:.0f} m out but claims 50 m"
    assert after != before or offset <= 50


@pytest.mark.asyncio
async def test_the_owner_still_sees_their_own_true_coordinates(
    client: AsyncClient, auth_headers: dict
):
    """The fuzz is for everyone else; the reporter needs the real pin."""
    report = await _file_report(client, auth_headers)
    res = await client.get(f"/api/v1/lost/reports/{report['id']}", headers=auth_headers)
    body = res.json()
    assert body["last_seen_lat"] == pytest.approx(TRUE_LAT)
    assert body["last_seen_lng"] == pytest.approx(TRUE_LNG)


@pytest.mark.asyncio
async def test_nearby_search_cannot_be_used_as_a_true_location_oracle(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """`/reports/nearby` lets the caller pick the centre and radius.

    Matching on the true coordinates made it a membership oracle — "is the true
    point inside this circle?" — and three bisections trilaterate the exact
    stored location without ever opening the share page. It must match on the
    same point it is willing to display.
    """
    report = await _file_report(client, auth_headers, fuzz_m=2000)
    pub_lat, pub_lng = await _published_point(client, report["id"], admin_headers)

    async def visible_from(lat, lng, radius_km) -> bool:
        res = await client.get(
            "/api/v1/lost/reports/nearby",
            params={"lat": lat, "lng": lng, "radius_km": radius_km},
            headers=admin_headers,
        )
        assert res.status_code == 200, res.text
        return report["id"] in [r["id"] for r in res.json()]

    # A tight circle on the PUBLISHED point finds it — the endpoint still works.
    assert await visible_from(pub_lat, pub_lng, 1)

    # The oracle test: walk a circle 1 km around the TRUE point, at a radius too
    # small to reach the published point. If any probe hits, the endpoint is
    # still answering questions about the true location.
    leaked = []
    for bearing in range(0, 360, 30):
        rad = math.radians(bearing)
        probe_lat = TRUE_LAT + (1000 * math.cos(rad)) / M_PER_DEG_LAT
        probe_lng = TRUE_LNG + (1000 * math.sin(rad)) / (
            M_PER_DEG_LAT * math.cos(math.radians(TRUE_LAT))
        )
        if _metres_apart(probe_lat, probe_lng, pub_lat, pub_lng) > 1100:
            if await visible_from(probe_lat, probe_lng, 1.0):
                leaked.append(bearing)

    assert not leaked, (
        f"nearby matched on the true point at bearings {leaked}; the endpoint "
        "is an oracle for the unfuzzed location"
    )
