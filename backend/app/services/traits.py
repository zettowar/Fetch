"""Personality traits: normalization, vocabulary lookup, and label rewrites.

Owners aren't limited to a fixed list — anything that survives
`normalize_trait` is accepted. A label nobody has used before creates a
`pending` row in `pet_traits`, so it lands on the owner's pet right away but
isn't suggested to anyone else until an admin approves it at Admin → Traits.

Pets keep their traits denormalized in `pets.traits` (a text array), so the
rename/purge helpers here exist to keep those arrays in step with the
vocabulary whenever an admin edits it.
"""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.breed_data import slugify
from app.models.pet_trait import PetTrait

MAX_TRAITS_PER_PET = 12
MAX_TRAIT_LENGTH = 30

TRAIT_STATUSES = {"approved", "pending", "rejected"}
TRAIT_SPECIES = {"dog", "cat", "both"}

# Everything else has to be alphanumeric. Deliberately narrow: no periods or
# colons (so a label can't be a URL), and no emoji — chips are text.
_ALLOWED_PUNCT = frozenset(" '-&+/")


def normalize_trait(raw: str) -> str:
    """Trim, collapse whitespace, and sentence-case a user-typed trait.

    Raises ValueError with a message meant for the owner who typed it.
    """
    label = " ".join(raw.split())
    if not label:
        raise ValueError("Trait cannot be empty")
    if len(label) > MAX_TRAIT_LENGTH:
        raise ValueError(f"Traits must be {MAX_TRAIT_LENGTH} characters or less")
    if not any(ch.isalnum() for ch in label):
        raise ValueError("Traits need at least one letter or number")
    for ch in label:
        if not (ch.isalnum() or ch in _ALLOWED_PUNCT):
            raise ValueError(f"Traits can't contain {ch!r}")
    # Chips read as sentence case ("Good with kids"), so fix the first letter
    # and leave the rest as typed — "good with kids" and "Good With Kids" still
    # collapse onto one row because dedup keys on the slug, not the label.
    return label[0].upper() + label[1:]


def trait_slug(label: str) -> str:
    return slugify(label)


async def resolve_traits(
    db: AsyncSession,
    labels: list[str],
    species: str,
    user_id: UUID | None,
) -> list[str]:
    """Map user-supplied labels onto the canonical vocabulary.

    Known labels come back in the vocabulary's spelling (so variants converge);
    unknown ones create a `pending` row and are used as typed. Raises 400 for
    rejected labels and for over-long trait lists.
    """
    if len(labels) > MAX_TRAITS_PER_PET:
        raise HTTPException(
            status_code=400,
            detail=f"At most {MAX_TRAITS_PER_PET} traits per pet",
        )

    # Deduplicate on slug, preserving the order the owner picked them in.
    wanted: list[tuple[str, str]] = []
    seen: set[str] = set()
    for raw in labels:
        try:
            label = normalize_trait(raw)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        slug = trait_slug(label)
        if not slug or slug in seen:
            continue
        seen.add(slug)
        wanted.append((slug, label))

    if not wanted:
        return []

    result = await db.execute(
        select(PetTrait).where(PetTrait.slug.in_([s for s, _ in wanted]))
    )
    known = {row.slug: row for row in result.scalars().all()}

    out: list[str] = []
    for slug, label in wanted:
        existing = known.get(slug)
        if existing is None:
            existing = await _create_pending_trait(db, slug, label, species, user_id)
        if existing.status == "rejected":
            raise HTTPException(
                status_code=400,
                detail=f'"{existing.label}" isn\'t available as a trait',
            )
        out.append(existing.label)
    return out


async def _create_pending_trait(
    db: AsyncSession,
    slug: str,
    label: str,
    species: str,
    user_id: UUID | None,
) -> PetTrait:
    trait = PetTrait(
        label=label,
        slug=slug,
        species=species if species in TRAIT_SPECIES else "both",
        status="pending",
        created_by=user_id,
    )
    try:
        # SAVEPOINT so losing the race on the unique slug doesn't poison the
        # surrounding transaction — two owners can invent the same trait at
        # the same moment and both should succeed.
        async with db.begin_nested():
            db.add(trait)
            await db.flush()
    except IntegrityError:
        result = await db.execute(select(PetTrait).where(PetTrait.slug == slug))
        winner = result.scalar_one_or_none()
        if winner is None:  # pragma: no cover — the conflict was something else
            raise
        return winner
    return trait


async def list_trait_options(db: AsyncSession, species: str | None) -> list[PetTrait]:
    """Approved traits offered as chips, for `species` plus the shared ones."""
    query = select(PetTrait).where(PetTrait.status == "approved")
    if species in ("dog", "cat"):
        query = query.where(PetTrait.species.in_([species, "both"]))
    result = await db.execute(
        query.order_by(PetTrait.sort_order.asc(), PetTrait.label.asc())
    )
    return list(result.scalars().all())


async def trait_usage_counts(db: AsyncSession) -> dict[str, int]:
    """How many active pets carry each label, keyed by label.

    One pass over `pets` with the array unnested, rather than a count query per
    trait — the admin list would otherwise fire one per row.
    """
    result = await db.execute(
        text(
            "SELECT t AS label, count(*) AS n "
            "FROM pets, unnest(pets.traits) AS t "
            "WHERE pets.is_active = true "
            "GROUP BY t"
        )
    )
    return {row.label: row.n for row in result}


async def rename_trait_on_pets(db: AsyncSession, old_label: str, new_label: str) -> int:
    """Rewrite a label in place across every pet carrying it."""
    result = await db.execute(
        text(
            "UPDATE pets SET traits = array_replace(traits, :old, :new) "
            "WHERE :old = ANY(traits)"
        ),
        {"old": old_label, "new": new_label},
    )
    return result.rowcount or 0


async def remove_trait_from_pets(db: AsyncSession, label: str) -> int:
    """Strip a label from every pet carrying it (rejection / deletion)."""
    result = await db.execute(
        text("UPDATE pets SET traits = array_remove(traits, :label) WHERE :label = ANY(traits)"),
        {"label": label},
    )
    return result.rowcount or 0


async def pending_trait_count(db: AsyncSession) -> int:
    """Size of the review queue — surfaced on the admin dashboard."""
    result = await db.execute(
        select(func.count()).select_from(PetTrait).where(PetTrait.status == "pending")
    )
    return result.scalar() or 0
