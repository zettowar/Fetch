"""store public lost-report coordinates instead of deriving them on read

The published point used to be computed per request as
``random.Random(str(report.id))`` — seeded with the report id, which IS the
public share URL. Replaying that seed reproduces the exact angle and distance,
so the offset subtracts straight back out and a stranger holding only the URL
recovers the true last-seen coordinates to centimetres. For a missing-pet report
that point is normally the owner's home, and the pages are public by default and
listed in sitemap.xml.

Deriving it from a secret instead would still not be enough, because
``location_fuzz_m`` is editable: two published points for one true point give
simultaneous equations. So the point is now generated ONCE from a CSPRNG and
stored, and only regenerated when it would otherwise be dishonest.

Existing rows are backfilled here with an equivalent random offset (one angle
and one radius per row, uniform over the disc). Postgres ``random()`` is not
cryptographic, but these rows already have a fully recoverable point in the
wild — a weak fresh offset strictly improves on that, and the launch this
precedes means there are few or none.

Revision ID: b2d5f81a4c67
Revises: a1c4e7f92b30
"""
from alembic import op
import sqlalchemy as sa

revision = "b2d5f81a4c67"
down_revision = "a1c4e7f92b30"
branch_labels = None
depends_on = None

# One angle + one sqrt-uniform radius per row. Drawing random() separately for
# the cos and sin terms would use two different angles and put the point
# somewhere in an ellipse instead of on the intended bearing.
_BACKFILL = """
UPDATE {table} AS t
SET public_lat = t.{lat} + ((:fuzz) * j.u * cos(j.a)) / 111320.0,
    public_lng = t.{lng} + ((:fuzz) * j.u * sin(j.a))
                 / GREATEST(111320.0 * cos(radians(t.{lat})), 1.0)
FROM (SELECT id, random() * 2 * pi() AS a, sqrt(random()) AS u FROM {table}) AS j
WHERE t.id = j.id AND t.{lat} IS NOT NULL AND t.{lng} IS NOT NULL
"""


def upgrade() -> None:
    for table in ("lost_reports", "lost_report_sightings"):
        op.add_column(table, sa.Column("public_lat", sa.Float(), nullable=True))
        op.add_column(table, sa.Column("public_lng", sa.Float(), nullable=True))

    # Reports carry their own per-row radius.
    op.execute(
        sa.text(
            _BACKFILL.format(
                table="lost_reports", lat="last_seen_lat", lng="last_seen_lng"
            ).replace("(:fuzz)", "COALESCE(t.location_fuzz_m, 500)")
        )
    )
    # Sightings inherit their report's radius.
    op.execute(
        sa.text(
            _BACKFILL.format(
                table="lost_report_sightings", lat="lat", lng="lng"
            ).replace(
                "(:fuzz)",
                "COALESCE((SELECT location_fuzz_m FROM lost_reports r"
                " WHERE r.id = t.report_id), 500)",
            )
        )
    )

    # /lost/reports/nearby now filters on the public point, so the index has to
    # follow it there or every map pan becomes a sequential scan.
    op.create_index(
        "ix_lost_reports_status_public_lat_lng",
        "lost_reports",
        ["status", "public_lat", "public_lng"],
    )


def downgrade() -> None:
    op.drop_index("ix_lost_reports_status_public_lat_lng", table_name="lost_reports")
    for table in ("lost_report_sightings", "lost_reports"):
        op.drop_column(table, "public_lng")
        op.drop_column(table, "public_lat")
