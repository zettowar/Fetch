"""Seed script: creates 10 users, 20 dogs with placeholder data."""
import asyncio
import uuid
from datetime import date

from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models import Base, User, Dog

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
                role="admin" if i == 1 else "user",
            )
            users.append(user)
            session.add(user)

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
            session.add(dog)

        await session.commit()
        print(f"Seeded {len(users)} users and {len(DOGS_DATA)} dogs.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
