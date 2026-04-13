"""Seed script: creates 10 users, 20 dogs, parks, votes, posts, rescues, and follows."""
import asyncio
import uuid
from datetime import date, datetime, timezone, timedelta

from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models import Base, User, Dog
from app.models.park import Park, ParkReview
from app.models.post import Post
from app.models.rescue import Rescue
from app.models.vote import Vote
from app.models.social import Follow

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

DOGS_DATA = [
    ("Buddy", "Golden Retriever"),
    ("Luna", "Labrador"),
    ("Charlie", "Beagle"),
    ("Bella", "Poodle"),
    ("Max", "German Shepherd"),
    ("Daisy", "Bulldog"),
    ("Rocky", "Boxer"),
    ("Molly", "Husky"),
    ("Cooper", "Dachshund"),
    ("Sadie", "Corgi"),
    ("Duke", "Rottweiler"),
    ("Bailey", "Shih Tzu"),
    ("Tucker", "Border Collie"),
    ("Maggie", "Australian Shepherd"),
    ("Bear", "Bernese Mountain Dog"),
    ("Chloe", "Chihuahua"),
    ("Jack", "Pit Bull"),
    ("Sophie", "Maltese"),
    ("Toby", "Great Dane"),
    ("Lola", "French Bulldog"),
]

PARKS_DATA = [
    {
        "name": "Central Park Dog Run",
        "address": "Central Park, New York, NY",
        "lat": 40.7812, "lng": -73.9665,
        "attributes": {"off_leash": True, "water": True, "fenced": True, "size": "large"},
    },
    {
        "name": "Prospect Park Dog Beach",
        "address": "Prospect Park, Brooklyn, NY",
        "lat": 40.6602, "lng": -73.9690,
        "attributes": {"off_leash": True, "water": True, "fenced": False, "size": "medium"},
    },
    {
        "name": "Battery Park Dog Run",
        "address": "Battery Park City, New York, NY",
        "lat": 40.7069, "lng": -74.0160,
        "attributes": {"off_leash": True, "water": False, "fenced": True, "size": "small"},
    },
    {
        "name": "Duboce Park",
        "address": "Duboce Ave, San Francisco, CA",
        "lat": 37.7693, "lng": -122.4330,
        "attributes": {"off_leash": True, "water": True, "fenced": False, "size": "medium"},
    },
    {
        "name": "Golden Gate Park Dog Play Area",
        "address": "Golden Gate Park, San Francisco, CA",
        "lat": 37.7694, "lng": -122.4862,
        "attributes": {"off_leash": True, "water": True, "fenced": True, "size": "large"},
    },
    {
        "name": "Dolores Park",
        "address": "Dolores St, San Francisco, CA",
        "lat": 37.7596, "lng": -122.4269,
        "attributes": {"off_leash": False, "water": False, "fenced": False, "size": "medium"},
    },
]

POSTS_DATA = [
    {
        "kind": "community",
        "title": "Tips for socializing a shy rescue dog",
        "body": "Just adopted a 2-year-old rescue who's terrified of strangers. Here are the techniques that have worked for us over the past 3 months...",
        "tags": ["rescue", "socialization", "tips"],
    },
    {
        "kind": "community",
        "title": "Best dog-friendly restaurants in NYC?",
        "body": "Looking for places in Manhattan and Brooklyn that welcome dogs on their patios. Drop your favorites below!",
        "tags": ["nyc", "dog-friendly", "restaurants"],
    },
    {
        "kind": "community",
        "title": "Weekly meetup at Central Park this Saturday",
        "body": "Anyone want to bring their pups to the Great Lawn at 10am Saturday? The more the merrier! DM me for details.",
        "tags": ["meetup", "nyc", "central-park"],
    },
    {
        "kind": "sponsor",
        "title": "Introducing Fetch Premium: No ads, unlimited swipes",
        "body": "We've launched Fetch Premium! Get an ad-free experience, unlimited daily swipes, and early access to new features. Use code BETA50 for 50% off.",
        "tags": ["premium", "announcement"],
        "pinned": True,
    },
    {
        "kind": "rescue_spotlight",
        "title": "Spotlight: NYC Bully Rescue needs fosters this weekend",
        "body": "NYC Bully Rescue has 12 dogs that need emergency fosters this weekend due to shelter overcrowding. No experience needed — they provide all supplies and support.",
        "tags": ["foster", "rescue", "urgent", "nyc"],
    },
    {
        "kind": "community",
        "title": "My dog passed his Canine Good Citizen test!",
        "body": "Six months of training and Buddy finally passed his CGC test today. So proud of this boy. Happy to share the training routine we used if anyone's interested!",
        "tags": ["training", "cgc", "milestone"],
    },
]

RESCUES_DATA = [
    {
        "name": "NYC Bully Rescue",
        "description": "Dedicated to rescuing and rehoming bully breed dogs in the New York City metro area. We also offer training resources and community support.",
        "location": "New York, NY",
        "verified": True,
    },
    {
        "name": "Golden Retriever Rescue of the Rockies",
        "description": "A volunteer-run rescue placing Golden Retrievers and Golden mixes in loving homes across Colorado and surrounding states.",
        "location": "Denver, CO",
        "verified": True,
    },
    {
        "name": "Bay Area Dog Rescue Alliance",
        "description": "A coalition of foster-based rescues in the San Francisco Bay Area, pulling dogs from high-kill shelters and placing them in vetted homes.",
        "location": "San Francisco, CA",
        "verified": True,
    },
    {
        "name": "Second Chance Hounds",
        "description": "Specializing in senior dogs and medical cases that other rescues can't take on. Every dog deserves a second chance.",
        "location": "Austin, TX",
        "verified": False,
    },
]


def _week_bucket() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


async def seed():
    engine = create_async_engine(settings.DATABASE_URL)
    async_sess = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_sess() as session:
        # Check if already seeded
        result = await session.execute(text("SELECT count(*) FROM users"))
        count = result.scalar()
        if count and count > 0:
            print("Database already has users, skipping seed.")
            return

        # --- Users & Dogs ---
        users = []
        for i in range(1, 11):
            user = User(
                id=uuid.uuid4(),
                email=f"user{i}@fetchapp.dev",
                password_hash=pwd_ctx.hash("password123"),
                display_name=f"Dog Lover {i}",
                location_rough="New York, NY" if i % 2 == 0 else "San Francisco, CA",
                date_of_birth=date(1990, 1, 1),
                is_active=True,
                is_verified=True,
                role="admin" if i == 1 else "user",
            )
            users.append(user)
            session.add(user)

        dogs = []
        for idx, (name, breed) in enumerate(DOGS_DATA):
            owner = users[idx % len(users)]
            dog = Dog(
                id=uuid.uuid4(),
                owner_id=owner.id,
                name=name,
                breed=breed,
                bio=f"{name} is a wonderful {breed}!",
                location_rough=owner.location_rough,
                is_active=True,
            )
            dogs.append(dog)
            session.add(dog)

        # Flush to get IDs
        await session.flush()

        # --- Votes (so rankings leaderboard is populated) ---
        week = _week_bucket()
        vote_pairs_added = set()
        for voter in users:
            voter_dog_ids = {d.id for d in dogs if d.owner_id == voter.id}
            voted = 0
            for dog in dogs:
                if dog.id in voter_dog_ids:
                    continue  # can't vote own dog
                pair = (voter.id, dog.id)
                if pair in vote_pairs_added:
                    continue
                vote_pairs_added.add(pair)
                session.add(Vote(
                    id=uuid.uuid4(),
                    voter_id=voter.id,
                    dog_id=dog.id,
                    value=1,
                    week_bucket=week,
                ))
                voted += 1
                if voted >= 5:
                    break

        # --- Parks ---
        admin_user = users[0]
        parks = []
        for p in PARKS_DATA:
            park = Park(
                id=uuid.uuid4(),
                name=p["name"],
                address=p["address"],
                lat=p["lat"],
                lng=p["lng"],
                attributes=p["attributes"],
                created_by=admin_user.id,
                verified=True,
            )
            parks.append(park)
            session.add(park)

        await session.flush()

        # Park reviews
        review_texts = [
            "Great spot! Lots of space and the dogs love it.",
            "Well maintained, friendly dog owners.",
            "Gets crowded on weekends but still a great place.",
        ]
        for i, park in enumerate(parks[:3]):
            for j, user in enumerate(users[:3]):
                session.add(ParkReview(
                    id=uuid.uuid4(),
                    park_id=park.id,
                    author_id=user.id,
                    rating=4 + (j % 2),
                    body=review_texts[j],
                    visit_time_of_day="morning",
                    crowd_level="moderate",
                ))

        # --- Posts ---
        for i, p in enumerate(POSTS_DATA):
            author = users[i % len(users)]
            session.add(Post(
                id=uuid.uuid4(),
                author_id=author.id,
                kind=p["kind"],
                title=p["title"],
                body=p["body"],
                tags=p.get("tags"),
                pinned=p.get("pinned", False),
            ))

        # --- Rescues ---
        for r in RESCUES_DATA:
            session.add(Rescue(
                id=uuid.uuid4(),
                name=r["name"],
                description=r["description"],
                location=r["location"],
                verified=r["verified"],
                submitted_by=admin_user.id,
            ))

        # --- Follows ---
        for i, user in enumerate(users):
            # Each user follows 3 dogs they don't own
            followed = 0
            for dog in dogs:
                if dog.owner_id == user.id:
                    continue
                session.add(Follow(
                    id=uuid.uuid4(),
                    follower_id=user.id,
                    dog_id=dog.id,
                ))
                followed += 1
                if followed >= 3:
                    break

        await session.commit()
        print(
            f"Seeded {len(users)} users, {len(dogs)} dogs, "
            f"{len(parks)} parks, {len(POSTS_DATA)} posts, "
            f"{len(RESCUES_DATA)} rescues, votes, follows, and park reviews."
        )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
