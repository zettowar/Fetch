"""add play dates and rsvps

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'play_dates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('host_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('park_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('scheduled_for', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='scheduled'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['host_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['park_id'], ['parks.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_play_dates_host_id', 'play_dates', ['host_id'])
    op.create_index('ix_play_dates_park_id', 'play_dates', ['park_id'])
    op.create_index('ix_play_dates_scheduled_for', 'play_dates', ['scheduled_for'])

    op.create_table(
        'play_date_rsvps',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('playdate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('dog_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='going'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['playdate_id'], ['play_dates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['dog_id'], ['dogs.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('playdate_id', 'dog_id', name='uq_playdate_rsvp'),
    )
    op.create_index('ix_play_date_rsvps_playdate_id', 'play_date_rsvps', ['playdate_id'])
    op.create_index('ix_play_date_rsvps_user_id', 'play_date_rsvps', ['user_id'])
    op.create_index('ix_play_date_rsvps_dog_id', 'play_date_rsvps', ['dog_id'])


def downgrade() -> None:
    op.drop_index('ix_play_date_rsvps_dog_id', table_name='play_date_rsvps')
    op.drop_index('ix_play_date_rsvps_user_id', table_name='play_date_rsvps')
    op.drop_index('ix_play_date_rsvps_playdate_id', table_name='play_date_rsvps')
    op.drop_table('play_date_rsvps')

    op.drop_index('ix_play_dates_scheduled_for', table_name='play_dates')
    op.drop_index('ix_play_dates_park_id', table_name='play_dates')
    op.drop_index('ix_play_dates_host_id', table_name='play_dates')
    op.drop_table('play_dates')
