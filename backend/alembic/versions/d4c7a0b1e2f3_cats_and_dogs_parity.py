"""cats and dogs parity: rename dogs->pets + species discriminator

Revision ID: d4c7a0b1e2f3
Revises: b1c2d3e4f5a6
Create Date: 2026-07-06 00:00:00

- Rename the core entity: dogs->pets, dog_breeds->pet_breeds,
  dog_transfers->pet_transfers, and every dog_id FK column -> pet_id.
  (Postgres keeps index/constraint names on a table/column rename, so each
  stale ix_dogs_* / *_pkey / *_key is renamed explicitly to match the models —
  compare_metadata compares index names.)
- Add a `species` discriminator (String(20), NOT NULL, server_default 'dog')
  to pets, breeds and weekly_winners. Existing rows backfill to 'dog'.
- Swap weekly_winners' single global crown (UNIQUE(week_bucket)) for one crown
  per species per week: UNIQUE(week_bucket, species).
- Migrate reports.target_type value 'dog' -> 'pet' (renamed app-wide).
"""
from alembic import op
import sqlalchemy as sa

revision = "d4c7a0b1e2f3"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


# Satellite tables whose dog_id column becomes pet_id.
_DOG_ID_TABLES = [
    "photos", "votes", "weekly_winners", "follows", "lost_reports",
    "park_checkins", "play_date_rsvps", "adoption_inquiries",
]

# Column indexes left stale by the dog_id -> pet_id rename (index=True columns).
_COL_INDEX_RENAMES = [
    ("ix_photos_dog_id", "ix_photos_pet_id"),
    ("ix_votes_dog_id", "ix_votes_pet_id"),
    ("ix_follows_dog_id", "ix_follows_pet_id"),
    ("ix_park_checkins_dog_id", "ix_park_checkins_pet_id"),
    ("ix_play_date_rsvps_dog_id", "ix_play_date_rsvps_pet_id"),
    ("ix_adoption_inquiries_dog_id", "ix_adoption_inquiries_pet_id"),
]


def upgrade() -> None:
    # 1. Rename tables.
    op.rename_table("dogs", "pets")
    op.rename_table("dog_breeds", "pet_breeds")
    op.rename_table("dog_transfers", "pet_transfers")

    # 2. Rename dog_id -> pet_id everywhere.
    for tbl in _DOG_ID_TABLES:
        op.alter_column(tbl, "dog_id", new_column_name="pet_id")
    op.alter_column("pet_breeds", "dog_id", new_column_name="pet_id")
    op.alter_column("pet_transfers", "dog_id", new_column_name="pet_id")

    # 3. Fix up stale index / constraint names left by the renames.
    for old, new in _COL_INDEX_RENAMES:
        op.execute(f"ALTER INDEX {old} RENAME TO {new}")
    op.execute("ALTER INDEX ix_dogs_owner_id RENAME TO ix_pets_owner_id")
    op.execute("ALTER INDEX ix_dog_breeds_breed_id RENAME TO ix_pet_breeds_breed_id")
    op.execute("ALTER INDEX ix_dog_transfers_dog_id RENAME TO ix_pet_transfers_pet_id")
    op.execute("ALTER INDEX ix_dog_transfers_to_user_id RENAME TO ix_pet_transfers_to_user_id")
    op.execute("ALTER INDEX ix_dog_transfers_status RENAME TO ix_pet_transfers_status")
    op.execute("ALTER TABLE pets RENAME CONSTRAINT dogs_pkey TO pets_pkey")
    op.execute("ALTER TABLE pets RENAME CONSTRAINT dogs_tag_id_key TO pets_tag_id_key")
    op.execute("ALTER TABLE pet_breeds RENAME CONSTRAINT dog_breeds_pkey TO pet_breeds_pkey")
    op.execute("ALTER TABLE pet_transfers RENAME CONSTRAINT dog_transfers_pkey TO pet_transfers_pkey")
    op.execute("ALTER TABLE votes RENAME CONSTRAINT uq_vote_per_dog_per_week TO uq_vote_per_pet_per_week")

    # 4. Add species discriminators (existing rows backfill to 'dog').
    op.add_column("pets", sa.Column("species", sa.String(20), nullable=False, server_default="dog"))
    op.create_index("ix_pets_species", "pets", ["species"])
    op.add_column("breeds", sa.Column("species", sa.String(20), nullable=False, server_default="dog"))
    op.create_index("ix_breeds_species", "breeds", ["species"])
    op.add_column("weekly_winners", sa.Column("species", sa.String(20), nullable=False, server_default="dog"))

    # 5. One crown per species per week (was UNIQUE(week_bucket)).
    op.drop_constraint("weekly_winners_week_bucket_key", "weekly_winners", type_="unique")
    op.create_unique_constraint(
        "uq_weekly_winner_week_species", "weekly_winners", ["week_bucket", "species"]
    )

    # 6. reports.target_type value 'dog' -> 'pet'.
    op.execute("UPDATE reports SET target_type = 'pet' WHERE target_type = 'dog'")


def downgrade() -> None:
    op.execute("UPDATE reports SET target_type = 'dog' WHERE target_type = 'pet'")

    op.drop_constraint("uq_weekly_winner_week_species", "weekly_winners", type_="unique")
    op.create_unique_constraint("weekly_winners_week_bucket_key", "weekly_winners", ["week_bucket"])

    op.drop_column("weekly_winners", "species")
    op.drop_index("ix_breeds_species", table_name="breeds")
    op.drop_column("breeds", "species")
    op.drop_index("ix_pets_species", table_name="pets")
    op.drop_column("pets", "species")

    op.execute("ALTER TABLE votes RENAME CONSTRAINT uq_vote_per_pet_per_week TO uq_vote_per_dog_per_week")
    op.execute("ALTER TABLE pet_transfers RENAME CONSTRAINT pet_transfers_pkey TO dog_transfers_pkey")
    op.execute("ALTER TABLE pet_breeds RENAME CONSTRAINT pet_breeds_pkey TO dog_breeds_pkey")
    op.execute("ALTER TABLE pets RENAME CONSTRAINT pets_tag_id_key TO dogs_tag_id_key")
    op.execute("ALTER TABLE pets RENAME CONSTRAINT pets_pkey TO dogs_pkey")
    op.execute("ALTER INDEX ix_pet_transfers_status RENAME TO ix_dog_transfers_status")
    op.execute("ALTER INDEX ix_pet_transfers_to_user_id RENAME TO ix_dog_transfers_to_user_id")
    op.execute("ALTER INDEX ix_pet_transfers_pet_id RENAME TO ix_dog_transfers_dog_id")
    op.execute("ALTER INDEX ix_pet_breeds_breed_id RENAME TO ix_dog_breeds_breed_id")
    op.execute("ALTER INDEX ix_pets_owner_id RENAME TO ix_dogs_owner_id")
    for old, new in _COL_INDEX_RENAMES:
        op.execute(f"ALTER INDEX {new} RENAME TO {old}")

    op.alter_column("pet_transfers", "pet_id", new_column_name="dog_id")
    op.alter_column("pet_breeds", "pet_id", new_column_name="dog_id")
    for tbl in _DOG_ID_TABLES:
        op.alter_column(tbl, "pet_id", new_column_name="dog_id")

    op.rename_table("pet_transfers", "dog_transfers")
    op.rename_table("pet_breeds", "dog_breeds")
    op.rename_table("pets", "dogs")
