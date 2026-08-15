"""weekly recap: preference column + scheduled job

Revision ID: d800ade9fcff
Revises: 89c2359c5689
Create Date: 2026-08-15 18:22:42.150063
"""
from typing import Sequence, Union

from alembic import op
import uuid

import sqlalchemy as sa

from app.tasks.schedule_defaults import DEFAULT_PERIODIC_TASKS


# revision identifiers, used by Alembic.
revision: str = 'd800ade9fcff'
down_revision: Union[str, None] = '89c2359c5689'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'notification_preferences',
        sa.Column('weekly_recap', sa.Boolean(), server_default='true', nullable=False),
    )

    # Seed the Beat row for the new job. Autogenerate only sees schema, not the
    # periodic_tasks *data* the DB-backed scheduler reads, so without this the
    # task exists in code and is never scheduled on an existing install.
    #
    # Idempotent by name: an operator who already created it by hand in
    # Admin → System keeps their version rather than getting a duplicate.
    #
    # It is seeded ENABLED, which is safe because the job itself no-ops unless
    # the `weekly_recap_enabled` setting is on — that setting is the single
    # lever, rather than making an admin find and enable a cron as well.
    job = next(
        j for j in DEFAULT_PERIODIC_TASKS if j["name"] == "weekly-recap"
    )
    op.execute(
        sa.text(
            """
            INSERT INTO periodic_tasks
                (id, name, task, schedule_type, interval_seconds,
                 minute, hour, day_of_week, day_of_month, month_of_year,
                 description, enabled, one_off, created_at, updated_at)
            SELECT CAST(:id AS uuid), :name, :task, :schedule_type, NULL,
                   :minute, :hour, :day_of_week, :day_of_month, :month_of_year,
                   :description, true, false, now(), now()
            WHERE NOT EXISTS (
                SELECT 1 FROM periodic_tasks WHERE name = :name
            )
            """
        ).bindparams(
            id=str(uuid.uuid4()),
            name=job["name"],
            task=job["task"],
            schedule_type=job["schedule_type"],
            minute=job["minute"],
            hour=job["hour"],
            day_of_week=job["day_of_week"],
            day_of_month=job["day_of_month"],
            month_of_year=job["month_of_year"],
            description=job["description"],
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text("DELETE FROM periodic_tasks WHERE name = :name")
        .bindparams(name="weekly-recap")
    )
    op.drop_column('notification_preferences', 'weekly_recap')
