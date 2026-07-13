"""QR tag code generation."""
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.qr_tag import QRTag

# Unambiguous alphabet (no 0/O/1/I/L) for human-readable printed codes.
_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_LEN = 8


def random_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(_CODE_LEN))


async def generate_unique_codes(db: AsyncSession, count: int) -> list[str]:
    """`count` fresh codes, unique against existing rows and each other."""
    seen = set((await db.execute(select(QRTag.code))).scalars().all())
    codes: list[str] = []
    while len(codes) < count:
        c = random_code()
        if c in seen:
            continue
        seen.add(c)
        codes.append(c)
    return codes
