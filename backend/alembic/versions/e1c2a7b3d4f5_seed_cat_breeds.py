"""seed cat breeds (species='cat')

Revision ID: e1c2a7b3d4f5
Revises: d4c7a0b1e2f3
Create Date: 2026-07-06 00:10:00

Data-only migration: inserts the cat breed catalog so users can create cats,
mirroring how the dog breeds were seeded in a7b8c9d0e1f2. Idempotent-ish — it
only inserts rows whose slug is not already present.
"""
from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.breed_data import CAT_BREED_SEED, slugify


revision = "e1c2a7b3d4f5"
down_revision = "d4c7a0b1e2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {
        row[0]
        for row in bind.execute(
            sa.text("SELECT slug FROM breeds WHERE species = 'cat'")
        )
    }

    breeds_table = sa.table(
        "breeds",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("slug", sa.String),
        sa.column("group", sa.String),
        sa.column("species", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    rows = [
        {
            "id": uuid.uuid4(),
            "name": name,
            "slug": slugify(name),
            "group": group,
            "species": "cat",
            "is_active": True,
        }
        for name, group in CAT_BREED_SEED
        if slugify(name) not in existing
    ]
    if rows:
        op.bulk_insert(breeds_table, rows)


def downgrade() -> None:
    op.execute("DELETE FROM breeds WHERE species = 'cat'")
