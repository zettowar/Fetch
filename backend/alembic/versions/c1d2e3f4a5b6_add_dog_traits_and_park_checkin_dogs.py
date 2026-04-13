"""add dog traits and park checkin dogs

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-04-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'c1d2e3f4a5b6'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add traits array to dogs
    op.add_column('dogs', sa.Column('traits', sa.ARRAY(sa.String(50)), server_default='{}', nullable=False))

    # Add dog_id and checked_out_at to park_checkins
    op.add_column('park_checkins', sa.Column('dog_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('park_checkins', sa.Column('checked_out_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key('fk_park_checkins_dog_id', 'park_checkins', 'dogs', ['dog_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_park_checkins_dog_id', 'park_checkins', ['dog_id'])


def downgrade() -> None:
    op.drop_index('ix_park_checkins_dog_id', table_name='park_checkins')
    op.drop_constraint('fk_park_checkins_dog_id', 'park_checkins', type_='foreignkey')
    op.drop_column('park_checkins', 'checked_out_at')
    op.drop_column('park_checkins', 'dog_id')
    op.drop_column('dogs', 'traits')
