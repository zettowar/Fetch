"""add breeds table, dog_breeds association, dog mix_type; migrate breed strings

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-16
"""
from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.breed_data import BREED_SEED, slugify


revision = "a7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- breeds table ---
    op.create_table(
        "breeds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("slug", sa.String(length=100), nullable=False, unique=True),
        sa.Column("group", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_breeds_slug", "breeds", ["slug"], unique=True)

    # --- seed breeds ---
    bind = op.get_bind()
    breeds_table = sa.table(
        "breeds",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("slug", sa.String),
        sa.column("group", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    rows = [
        {"id": uuid.uuid4(), "name": name, "slug": slugify(name), "group": group, "is_active": True}
        for name, group in BREED_SEED
    ]
    if rows:
        op.bulk_insert(breeds_table, rows)

    # --- dog_breeds association ---
    op.create_table(
        "dog_breeds",
        sa.Column(
            "dog_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("dogs.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "breed_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("breeds.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
    )
    op.create_index("ix_dog_breeds_breed_id", "dog_breeds", ["breed_id"])

    # --- dogs.mix_type ---
    op.add_column(
        "dogs",
        sa.Column(
            "mix_type",
            sa.String(length=20),
            nullable=False,
            server_default="mystery_mutt",
        ),
    )

    # --- migrate existing dogs.breed strings -> dog_breeds + mix_type ---
    # Case-insensitive name match. Unmatched strings fall through to
    # mystery_mutt with no breed rows attached.
    bind.execute(
        sa.text(
            """
            INSERT INTO dog_breeds (dog_id, breed_id)
            SELECT d.id, b.id
            FROM dogs d
            JOIN breeds b ON LOWER(b.name) = LOWER(TRIM(d.breed))
            WHERE d.breed IS NOT NULL AND TRIM(d.breed) <> ''
            ON CONFLICT DO NOTHING;
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE dogs
            SET mix_type = 'purebred'
            WHERE id IN (SELECT dog_id FROM dog_breeds);
            """
        )
    )

    # --- drop dogs.breed ---
    op.drop_column("dogs", "breed")


def downgrade() -> None:
    op.add_column("dogs", sa.Column("breed", sa.String(length=100), nullable=True))

    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE dogs SET breed = sub.name
            FROM (
                SELECT db.dog_id, b.name
                FROM dog_breeds db
                JOIN breeds b ON b.id = db.breed_id
            ) AS sub
            WHERE dogs.id = sub.dog_id AND dogs.breed IS NULL;
            """
        )
    )

    op.drop_column("dogs", "mix_type")
    op.drop_index("ix_dog_breeds_breed_id", table_name="dog_breeds")
    op.drop_table("dog_breeds")
    op.drop_index("ix_breeds_slug", table_name="breeds")
    op.drop_table("breeds")
