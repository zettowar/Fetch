"""dedupe push subscriptions and add unique (user_id, endpoint)

Revision ID: a1b2c3d4e5f7
Revises: f0a1b2c3d4e5
Create Date: 2026-06-27

Re-subscribing previously appended a new row each time. Collapse any existing
duplicate (user_id, endpoint) rows to one, then enforce uniqueness so the
upsert in the subscribe endpoint is race-safe.
"""
from alembic import op

revision = "a1b2c3d4e5f7"
down_revision = "f0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Keep one row per (user_id, endpoint); drop the rest.
    op.execute(
        """
        DELETE FROM push_subscriptions a
        USING push_subscriptions b
        WHERE a.user_id = b.user_id
          AND a.endpoint = b.endpoint
          AND a.ctid < b.ctid
        """
    )
    op.create_unique_constraint(
        "uq_push_sub_user_endpoint", "push_subscriptions", ["user_id", "endpoint"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_push_sub_user_endpoint", "push_subscriptions", type_="unique"
    )
