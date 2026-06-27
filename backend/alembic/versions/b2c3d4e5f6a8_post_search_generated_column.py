"""convert posts.search_vector to a generated column

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-06-27

The trigger-maintained column worked, but queries used an inline to_tsvector()
expression that bypassed the GIN index, and the trigger lived only in
migrations (so test DBs built via create_all never populated it). A generated
column is always in sync, is reflected by SQLAlchemy's create_all, and lets
queries hit the index by referencing the column directly.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b2c3d4e5f6a8"
down_revision = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None

_EXPR = (
    "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
    "setweight(to_tsvector('english', coalesce(body, '')), 'B')"
)


def upgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS tsvectorupdate ON posts")
    op.execute("DROP FUNCTION IF EXISTS posts_search_vector_update()")
    op.execute("DROP INDEX IF EXISTS idx_posts_search")
    op.drop_column("posts", "search_vector")
    op.execute(
        f"ALTER TABLE posts ADD COLUMN search_vector tsvector "
        f"GENERATED ALWAYS AS ({_EXPR}) STORED"
    )
    op.execute("CREATE INDEX idx_posts_search ON posts USING gin(search_vector)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_posts_search")
    op.drop_column("posts", "search_vector")
    op.add_column(
        "posts",
        sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True),
    )
    op.execute("CREATE INDEX idx_posts_search ON posts USING gin(search_vector)")
