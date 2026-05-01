"""Bulk-generate fake dog accounts for stress/demo testing.

Creates `fakeowner_NNNNN@fetchapp.test` users (password: password123) and dogs
distributed across them with photos sourced from dog.ceo. Writes directly to
the DB and the local storage path — bypasses the HTTP photo-upload flow.

Run inside the backend container:
    docker compose exec backend python -m app.scripts.generate_dogs
    docker compose exec backend python -m app.scripts.generate_dogs --owners 20 --dogs 50
    docker compose exec backend python -m app.scripts.generate_dogs --reset
"""
from __future__ import annotations

import argparse
import asyncio
import io
import random
import sys
import time
import uuid
from datetime import date
from pathlib import Path

import httpx
from PIL import Image
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import async_session
from app.models import Dog, User
from app.models.breed import Breed
from app.models.photo import Photo
from app.security import hash_password
from app.storage import generate_storage_key
from app.scripts.dog_data import (
    ACTIVITIES,
    ADOPTION_PHRASES,
    AGE_TRAITS,
    ANCHOR_ALL,
    BIO_ADJECTIVES,
    BIO_LOVES,
    BREED_TO_DOGCEO,
    CITIES,
    DOG_NAMES,
    ENERGY_TRAITS,
    FIRST_NAMES,
    LAST_INITIALS,
    LAST_NAMES,
    MIXED_PHRASE_TEMPLATES,
    MUTT_DESCRIPTORS,
    ORIGIN_TRAITS,
    TRAITS,
)

DOG_CEO = "https://dog.ceo/api"
EMAIL_PREFIX = "fakeowner_"
DEFAULT_OWNERS = 1280
DEFAULT_DOGS = 3200
HTTP_CONCURRENCY = 20
DOG_BATCH = 40  # dogs processed in parallel before a commit
MIX_TYPE_WEIGHTS = [("purebred", 35), ("cross", 25), ("mixed", 25), ("mystery_mutt", 15)]
DOG_COUNT_WEIGHTS = [
    (1, 0.35), (2, 0.25), (3, 0.18), (4, 0.10),
    (5, 0.06), (6, 0.03), (7, 0.02), (8, 0.01),
]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--owners", type=int, default=DEFAULT_OWNERS)
    p.add_argument("--dogs", type=int, default=DEFAULT_DOGS)
    p.add_argument("--reset", action="store_true", help="Delete all fakeowner_% users (cascades to dogs/photos) before generating")
    p.add_argument("--seed", type=int, default=42)
    return p.parse_args()


def assign_dog_counts(num_owners: int, num_dogs: int, rng: random.Random) -> list[int]:
    options, weights = zip(*DOG_COUNT_WEIGHTS)
    counts = rng.choices(options, weights=weights, k=num_owners)
    diff = num_dogs - sum(counts)
    while diff > 0:
        i = rng.randrange(num_owners)
        if counts[i] < 12:
            counts[i] += 1
            diff -= 1
    while diff < 0:
        i = rng.randrange(num_owners)
        if counts[i] > 1:
            counts[i] -= 1
            diff += 1
    return counts


def display_name(rng: random.Random) -> str:
    first = rng.choice(FIRST_NAMES)
    style = rng.choices(
        ["initial", "full", "first_only", "handle"],
        weights=[55, 18, 18, 9],
        k=1,
    )[0]
    if style == "initial":
        return f"{first} {rng.choice(LAST_INITIALS)}."
    if style == "full":
        return f"{first} {rng.choice(LAST_NAMES)}"
    if style == "first_only":
        return first
    return f"{first.lower()}{rng.randint(1, 99)}"


def make_owner(idx: int, password_hash: str, rng: random.Random) -> User:
    yob = rng.randint(1970, 2002)
    return User(
        id=uuid.uuid4(),
        email=f"{EMAIL_PREFIX}{idx:05d}@fetchapp.test",
        password_hash=password_hash,
        display_name=display_name(rng),
        location_rough=rng.choice(CITIES),
        date_of_birth=date(yob, rng.randint(1, 12), rng.randint(1, 28)),
        is_active=True,
        is_verified=True,
        role="user",
    )


def pick_traits(rng: random.Random) -> list[str]:
    """Pick 3-6 traits with at most one anchor per group (age/energy/origin)."""
    chosen: list[str] = []
    if rng.random() < 0.35:
        chosen.append(rng.choice(AGE_TRAITS))
    if rng.random() < 0.85:
        chosen.append(rng.choice(ENERGY_TRAITS))
    if rng.random() < 0.25:
        chosen.append(rng.choice(ORIGIN_TRAITS))
    pool = [t for t in TRAITS if t not in ANCHOR_ALL and t not in chosen]
    extras = rng.randint(2, 4)
    chosen.extend(rng.sample(pool, extras))
    rng.shuffle(chosen)
    return chosen


def breed_phrase(mix_type: str, chosen_breeds: list[Breed], rng: random.Random) -> str:
    if not chosen_breeds:
        return rng.choice(MUTT_DESCRIPTORS)
    names = [b.name for b in chosen_breeds]
    if mix_type == "purebred":
        return names[0]
    if mix_type == "cross":
        a, b = names[0], names[1]
        return rng.choice([f"{a}/{b} cross", f"{a}-{b} mix", f"{a} crossed with {b}"])
    if mix_type == "mixed":
        primary = names[0]
        secondary = names[1] if len(names) > 1 else "everything"
        return rng.choice(MIXED_PHRASE_TEMPLATES).format(primary=primary, secondary=secondary)
    return rng.choice(MUTT_DESCRIPTORS)


def make_bio(
    name: str,
    mix_type: str,
    chosen_breeds: list[Breed],
    traits: list[str],
    city: str,
    rng: random.Random,
) -> str:
    bp = breed_phrase(mix_type, chosen_breeds, rng)
    a1 = traits[0] if traits else "good"
    a2 = traits[1] if len(traits) > 1 else "loyal"
    a3 = traits[2] if len(traits) > 2 else "playful"
    treat = rng.choice(BIO_LOVES)
    activity = rng.choice(ACTIVITIES)
    short_city = city.split(",")[0]
    pronoun = rng.choice(["him", "her", "them"])
    adopt = rng.choice(ADOPTION_PHRASES).format(city=short_city)

    templates = [
        f"{name} is {bp}. {a1.capitalize()}, {a2}, occasionally {a3}. Will work for {treat}.",
        f"Meet {name} — {a1} {bp} currently obsessed with {treat}.",
        f"{name}. {bp}. {a1.capitalize()} on the outside, {a2} on the inside.",
        f"{name} the {bp}. Hobbies: {activity} and {treat}. Excellent listener around {treat}.",
        f"We adopted {pronoun} {adopt} and now {name}'s a {a1} {bp} who never stops {activity}.",
        f"{name} ({bp}) has two settings: {a1} and asleep. 100% {treat}-motivated.",
        f"Don't let the {a1} face fool you — {name} is {a2}, {a3}, and a card-carrying member of the {short_city} dog mafia.",
        f"{name}: {bp}, professional {a1}, part-time {a2}. Trades belly rubs for {treat}.",
        f"Resident {bp} of {short_city}. {a1.capitalize()} energy, {a2} vibes. Caught {activity} again this morning.",
        f"{rng.choice(BIO_ADJECTIVES).capitalize()} {bp}. Best known for {activity}. Loves {treat}.",
    ]
    return rng.choice(templates)[:500]


def make_dog(
    owner: User,
    rng: random.Random,
    breeds_pool: list[Breed],
    used_names: set[str],
) -> tuple[Dog, list[Breed], str | None]:
    types, weights = zip(*MIX_TYPE_WEIGHTS)
    mix_type = rng.choices(types, weights=weights, k=1)[0]
    if mix_type == "purebred":
        n_breeds = 1
    elif mix_type == "cross":
        n_breeds = 2
    elif mix_type == "mixed":
        n_breeds = rng.randint(2, 3)
    else:
        n_breeds = 0
    chosen = rng.sample(breeds_pool, n_breeds) if n_breeds else []

    breed_path = next((BREED_TO_DOGCEO[b.slug] for b in chosen if b.slug in BREED_TO_DOGCEO), None)

    # Avoid duplicate dog names within an owner.
    name_pool = [n for n in DOG_NAMES if n not in used_names] or DOG_NAMES
    name = rng.choice(name_pool)
    used_names.add(name)

    traits = pick_traits(rng)
    bio = make_bio(name, mix_type, chosen, traits, owner.location_rough or "", rng)

    tag_id = None
    if rng.random() < 0.25:
        tag_id = f"FETCH-{rng.randint(1000, 9999)}-{name.upper()[:4]}"

    dog = Dog(
        id=uuid.uuid4(),
        owner_id=owner.id,
        name=name,
        mix_type=mix_type,
        bio=bio,
        location_rough=owner.location_rough,
        traits=traits,
        tag_id=tag_id,
        is_active=True,
    )
    return dog, chosen, breed_path


async def fetch_photo_urls(client: httpx.AsyncClient, sem: asyncio.Semaphore, breed_path: str | None, n: int) -> list[str]:
    if breed_path:
        url = f"{DOG_CEO}/breed/{breed_path}/images/random/{n}"
    else:
        url = f"{DOG_CEO}/breeds/image/random/{n}"
    try:
        async with sem:
            r = await client.get(url, timeout=20)
            r.raise_for_status()
            data = r.json()
        msg = data.get("message")
        if isinstance(msg, str):
            return [msg]
        if isinstance(msg, list):
            return [u for u in msg if isinstance(u, str)][:n]
    except Exception:
        return []
    return []


async def fetch_image_bytes(client: httpx.AsyncClient, sem: asyncio.Semaphore, url: str) -> bytes | None:
    try:
        async with sem:
            r = await client.get(url, timeout=30)
            r.raise_for_status()
            return r.content
    except Exception:
        return None


def process_image(raw: bytes) -> tuple[bytes, int, int] | None:
    try:
        img = Image.open(io.BytesIO(raw))
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.thumbnail((1600, 1600))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        return buf.getvalue(), img.width, img.height
    except Exception:
        return None


async def build_dog_photos(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    storage_dir: Path,
    dog: Dog,
    breed_path: str | None,
    photo_count: int,
) -> list[Photo]:
    urls = await fetch_photo_urls(client, sem, breed_path, photo_count)
    # Top up from the random endpoint if a breed-specific call returned fewer
    # than asked, so each dog ends up with at least 2 photos.
    if len(urls) < photo_count:
        needed = photo_count - len(urls)
        more = await fetch_photo_urls(client, sem, None, max(needed, 2))
        seen = set(urls)
        urls.extend(u for u in more if u not in seen)
    if not urls:
        return []

    raw_results = await asyncio.gather(*(fetch_image_bytes(client, sem, u) for u in urls))
    photos: list[Photo] = []
    for i, raw in enumerate(raw_results):
        if raw is None:
            continue
        result = await asyncio.to_thread(process_image, raw)
        if result is None:
            continue
        data, w, h = result
        key = generate_storage_key("image/jpeg")
        await asyncio.to_thread((storage_dir / key).write_bytes, data)
        photos.append(
            Photo(
                id=uuid.uuid4(),
                dog_id=dog.id,
                storage_key=key,
                width=w,
                height=h,
                content_type="image/jpeg",
                moderation_status="approved",
                sort_order=i,
            )
        )
    return photos


async def reset_fake_data(session: AsyncSession, storage_dir: Path) -> None:
    keys = await session.execute(
        select(Photo.storage_key)
        .join(Dog, Dog.id == Photo.dog_id)
        .join(User, User.id == Dog.owner_id)
        .where(User.email.like(f"{EMAIL_PREFIX}%"))
    )
    storage_keys = [row[0] for row in keys.all()]
    print(f"Reset: deleting {len(storage_keys)} photo files…")
    for k in storage_keys:
        try:
            (storage_dir / k).unlink(missing_ok=True)
        except Exception:
            pass
    res = await session.execute(
        delete(User).where(User.email.like(f"{EMAIL_PREFIX}%"))
    )
    await session.commit()
    print(f"Reset: deleted {res.rowcount} fake users (dogs/photos cascaded).")


async def main() -> None:
    args = parse_args()
    rng = random.Random(args.seed)

    storage_dir = Path(settings.STORAGE_LOCAL_PATH)
    storage_dir.mkdir(parents=True, exist_ok=True)

    print(f"Target: {args.owners} owners, {args.dogs} dogs, photos → {storage_dir}")
    t0 = time.time()

    async with async_session() as session:
        if args.reset:
            await reset_fake_data(session, storage_dir)

        existing = await session.execute(
            select(func.count())
            .select_from(User)
            .where(User.email.like(f"{EMAIL_PREFIX}%"))
        )
        start_idx = existing.scalar_one()
        if start_idx >= args.owners:
            print(f"Already have {start_idx} fake owners (target {args.owners}). Nothing to do.")
            return
        owners_to_make = args.owners - start_idx

        breeds_result = await session.execute(
            select(Breed)
            .where(Breed.is_active.is_(True))
            .where(~Breed.name.ilike("Blocked%"))
        )
        breeds_pool = list(breeds_result.scalars().all())
        if len(breeds_pool) < 4:
            print("ERROR: breeds table is empty or tiny. Run `make migrate` to seed breeds.")
            sys.exit(1)
        print(f"Loaded {len(breeds_pool)} breeds from DB.")

        password_hash = hash_password("password123")

        dog_counts = assign_dog_counts(owners_to_make, args.dogs, rng)
        print(f"Distribution: avg {sum(dog_counts)/len(dog_counts):.2f} dogs/owner, max {max(dog_counts)}, min {min(dog_counts)}")

        timeout = httpx.Timeout(30.0, connect=10.0)
        limits = httpx.Limits(max_connections=HTTP_CONCURRENCY * 2)
        sem = asyncio.Semaphore(HTTP_CONCURRENCY)

        async with httpx.AsyncClient(timeout=timeout, limits=limits, follow_redirects=True) as client:
            pending_dogs: list[tuple[Dog, str | None, int]] = []
            owners_buffered = 0

            async def flush_pending() -> None:
                if not pending_dogs:
                    return
                # Process this batch of dogs in parallel
                async def handle(dog: Dog, breed_path: str | None, count: int) -> None:
                    photos = await build_dog_photos(client, sem, storage_dir, dog, breed_path, count)
                    if photos:
                        session.add_all(photos)
                        dog.primary_photo_id = photos[0].id

                await asyncio.gather(*(handle(d, bp, c) for d, bp, c in pending_dogs))
                await session.commit()
                pending_dogs.clear()

            total_dogs_planned = sum(dog_counts)
            dogs_done = 0
            for offset, count in enumerate(dog_counts):
                owner = make_owner(start_idx + offset, password_hash, rng)
                session.add(owner)
                await session.flush()

                used_names: set[str] = set()
                for _ in range(count):
                    dog, chosen_breeds, breed_path = make_dog(owner, rng, breeds_pool, used_names)
                    if chosen_breeds:
                        dog.breeds = chosen_breeds
                    session.add(dog)
                    pending_dogs.append((dog, breed_path, rng.randint(2, 12)))

                await session.flush()  # gives dogs their PKs
                owners_buffered += 1

                if len(pending_dogs) >= DOG_BATCH:
                    await flush_pending()
                    dogs_done = (offset + 1) and sum(dog_counts[: offset + 1])
                    elapsed = time.time() - t0
                    rate = dogs_done / elapsed if elapsed else 0
                    eta = (total_dogs_planned - dogs_done) / rate if rate else 0
                    print(
                        f"  [{dogs_done}/{total_dogs_planned} dogs] "
                        f"{owners_buffered} owners · {elapsed:.0f}s elapsed · "
                        f"{rate:.1f} dogs/s · ETA {eta:.0f}s"
                    )

            await flush_pending()

    elapsed = time.time() - t0
    print(f"Done in {elapsed:.1f}s.")


if __name__ == "__main__":
    asyncio.run(main())
