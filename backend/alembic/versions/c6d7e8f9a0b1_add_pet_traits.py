"""add pet_traits vocabulary

Personality traits used to be a hardcoded set in `schemas/pet.py`. They are now
free-form: owners type whatever they like and an unknown label creates a
`pending` row here for an admin to approve at Admin → Traits.

Seeds the labels that used to be that hardcoded vocabulary as `approved`, and
backfills every *other* label already present in `pets.traits` as `pending` —
dev databases built by `scripts/generate_dogs.py` write traits straight to the
table, bypassing the old validator, so those land in the review queue instead
of silently becoming suggestions.

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-08-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c6d7e8f9a0b1"
down_revision = "b5c6d7e8f9a0"
branch_labels = None
depends_on = None


# (label, species) — mirrors the old _SHARED_TRAITS / DOG_TRAITS / CAT_TRAITS
# split, with the shared core scoped to "both".
SEED_TRAITS = [
    ("Playful", "both"),
    ("Calm", "both"),
    ("Energetic", "both"),
    ("Good with kids", "both"),
    ("Cuddly", "both"),
    ("Independent", "both"),
    ("Senior", "both"),
    ("Couch potato", "both"),
    ("House trained", "both"),
    ("Good with dogs", "both"),
    ("Good with cats", "both"),
    ("Loves fetch", "dog"),
    ("Swimmer", "dog"),
    ("Leash trained", "dog"),
    ("Lap cat", "cat"),
    ("Mouser", "cat"),
    ("Indoor only", "cat"),
]


def _slugify(name: str) -> str:
    """Copy of app.breed_data.slugify — migrations shouldn't import app code."""
    out = []
    prev_dash = False
    for ch in name.lower():
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        elif not prev_dash:
            out.append("-")
            prev_dash = True
    return "".join(out).strip("-")


def upgrade() -> None:
    op.create_table(
        "pet_traits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("label", sa.String(length=50), nullable=False),
        sa.Column("slug", sa.String(length=50), nullable=False),
        sa.Column("species", sa.String(length=20), nullable=False, server_default="both"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_pet_traits_slug", "pet_traits", ["slug"], unique=True)
    op.create_index("ix_pet_traits_species", "pet_traits", ["species"])
    op.create_index("ix_pet_traits_status", "pet_traits", ["status"])
    op.create_index("ix_pet_traits_created_by", "pet_traits", ["created_by"])

    conn = op.get_bind()
    insert = sa.text(
        "INSERT INTO pet_traits (id, label, slug, species, status, sort_order) "
        "VALUES (gen_random_uuid(), :label, :slug, :species, :status, :sort_order) "
        "ON CONFLICT (slug) DO NOTHING"
    )
    for order, (label, species) in enumerate(SEED_TRAITS):
        conn.execute(
            insert,
            {
                "label": label,
                "slug": _slugify(label),
                "species": species,
                "status": "approved",
                "sort_order": order,
            },
        )

    # Backfill whatever else is already on a pet, so no live label is orphaned
    # from the vocabulary — a later rename or purge has to be able to find it.
    existing = conn.execute(
        sa.text("SELECT DISTINCT t AS label FROM pets, unnest(pets.traits) AS t")
    ).fetchall()
    for row in existing:
        label = (row.label or "").strip()[:50]
        slug = _slugify(label)[:50]
        if not label or not slug:
            continue
        conn.execute(
            insert,
            {
                "label": label,
                "slug": slug,
                "species": "both",
                "status": "pending",
                "sort_order": 100,
            },
        )


def downgrade() -> None:
    op.drop_index("ix_pet_traits_created_by", table_name="pet_traits")
    op.drop_index("ix_pet_traits_status", table_name="pet_traits")
    op.drop_index("ix_pet_traits_species", table_name="pet_traits")
    op.drop_index("ix_pet_traits_slug", table_name="pet_traits")
    op.drop_table("pet_traits")
