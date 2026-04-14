"""add missing fk indexes

Revision ID: d4e5f6a7b8c9
Revises: c1d2e3f4a5b6
Create Date: 2026-04-13 00:00:00.000000

"""
from alembic import op


revision = 'd4e5f6a7b8c9'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index('ix_audit_log_actor_id', 'audit_log', ['actor_id'])
    op.create_index('ix_audit_log_action', 'audit_log', ['action'])
    op.create_index('ix_audit_log_target_type', 'audit_log', ['target_type'])
    op.create_index('ix_rescues_submitted_by', 'rescues', ['submitted_by'])


def downgrade() -> None:
    op.drop_index('ix_rescues_submitted_by', table_name='rescues')
    op.drop_index('ix_audit_log_target_type', table_name='audit_log')
    op.drop_index('ix_audit_log_action', table_name='audit_log')
    op.drop_index('ix_audit_log_actor_id', table_name='audit_log')
