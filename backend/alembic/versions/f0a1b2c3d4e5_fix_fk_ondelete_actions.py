"""fix FK ondelete actions to match models

Revision ID: f0a1b2c3d4e5
Revises: 19a83f7c2bde
Create Date: 2026-06-27

Most foreign keys in earlier migrations were created without an ON DELETE
action, so the deployed database used NO ACTION while the SQLAlchemy models
declared CASCADE / SET NULL / RESTRICT. This realigns the database with the
models (verified against live-DB introspection). Generated from model
metadata, so the actions below are exactly what the ORM expects.
"""
from alembic import op

revision = "f0a1b2c3d4e5"
down_revision = "19a83f7c2bde"
branch_labels = None
depends_on = None

# (constraint_name, table, local_cols, ref_table, ref_cols, ondelete)
FIXES = [
    ("adoption_inquiries_dog_id_fkey", "adoption_inquiries", ["dog_id"], "dogs", ["id"], "SET NULL"),
    ("adoption_inquiries_inquirer_id_fkey", "adoption_inquiries", ["inquirer_id"], "users", ["id"], "CASCADE"),
    ("adoption_inquiries_rescue_id_fkey", "adoption_inquiries", ["rescue_id"], "rescue_profiles", ["id"], "CASCADE"),
    ("comments_author_id_fkey", "comments", ["author_id"], "users", ["id"], "CASCADE"),
    ("dog_breeds_breed_id_fkey", "dog_breeds", ["breed_id"], "breeds", ["id"], "RESTRICT"),
    ("dog_breeds_dog_id_fkey", "dog_breeds", ["dog_id"], "dogs", ["id"], "CASCADE"),
    ("dog_transfers_dog_id_fkey", "dog_transfers", ["dog_id"], "dogs", ["id"], "CASCADE"),
    ("dog_transfers_from_user_id_fkey", "dog_transfers", ["from_user_id"], "users", ["id"], "CASCADE"),
    ("dog_transfers_to_user_id_fkey", "dog_transfers", ["to_user_id"], "users", ["id"], "SET NULL"),
    ("dogs_adopted_by_user_id_fkey", "dogs", ["adopted_by_user_id"], "users", ["id"], "SET NULL"),
    ("dogs_owner_id_fkey", "dogs", ["owner_id"], "users", ["id"], "CASCADE"),
    ("email_verification_tokens_user_id_fkey", "email_verification_tokens", ["user_id"], "users", ["id"], "CASCADE"),
    ("entitlements_user_id_fkey", "entitlements", ["user_id"], "users", ["id"], "CASCADE"),
    ("feedback_user_id_fkey", "feedback", ["user_id"], "users", ["id"], "CASCADE"),
    ("follows_dog_id_fkey", "follows", ["dog_id"], "dogs", ["id"], "CASCADE"),
    ("follows_follower_id_fkey", "follows", ["follower_id"], "users", ["id"], "CASCADE"),
    ("invite_codes_created_by_fkey", "invite_codes", ["created_by"], "users", ["id"], "SET NULL"),
    ("invite_codes_used_by_fkey", "invite_codes", ["used_by"], "users", ["id"], "SET NULL"),
    ("lost_report_photos_report_id_fkey", "lost_report_photos", ["report_id"], "lost_reports", ["id"], "CASCADE"),
    ("lost_report_sightings_report_id_fkey", "lost_report_sightings", ["report_id"], "lost_reports", ["id"], "CASCADE"),
    ("lost_report_sightings_reporter_id_fkey", "lost_report_sightings", ["reporter_id"], "users", ["id"], "CASCADE"),
    ("lost_report_subscriptions_user_id_fkey", "lost_report_subscriptions", ["user_id"], "users", ["id"], "CASCADE"),
    ("lost_reports_dog_id_fkey", "lost_reports", ["dog_id"], "dogs", ["id"], "SET NULL"),
    ("lost_reports_reporter_id_fkey", "lost_reports", ["reporter_id"], "users", ["id"], "CASCADE"),
    ("notification_preferences_user_id_fkey", "notification_preferences", ["user_id"], "users", ["id"], "CASCADE"),
    ("fk_park_checkins_dog_id", "park_checkins", ["dog_id"], "dogs", ["id"], "CASCADE"),
    ("park_checkins_park_id_fkey", "park_checkins", ["park_id"], "parks", ["id"], "CASCADE"),
    ("park_checkins_user_id_fkey", "park_checkins", ["user_id"], "users", ["id"], "CASCADE"),
    ("park_incidents_park_id_fkey", "park_incidents", ["park_id"], "parks", ["id"], "CASCADE"),
    ("park_incidents_reporter_id_fkey", "park_incidents", ["reporter_id"], "users", ["id"], "CASCADE"),
    ("park_reviews_author_id_fkey", "park_reviews", ["author_id"], "users", ["id"], "CASCADE"),
    ("park_reviews_park_id_fkey", "park_reviews", ["park_id"], "parks", ["id"], "CASCADE"),
    ("parks_created_by_fkey", "parks", ["created_by"], "users", ["id"], "SET NULL"),
    ("password_reset_tokens_user_id_fkey", "password_reset_tokens", ["user_id"], "users", ["id"], "CASCADE"),
    ("photos_dog_id_fkey", "photos", ["dog_id"], "dogs", ["id"], "CASCADE"),
    ("play_date_rsvps_dog_id_fkey", "play_date_rsvps", ["dog_id"], "dogs", ["id"], "CASCADE"),
    ("play_date_rsvps_playdate_id_fkey", "play_date_rsvps", ["playdate_id"], "play_dates", ["id"], "CASCADE"),
    ("play_date_rsvps_user_id_fkey", "play_date_rsvps", ["user_id"], "users", ["id"], "CASCADE"),
    ("play_dates_host_id_fkey", "play_dates", ["host_id"], "users", ["id"], "CASCADE"),
    ("play_dates_park_id_fkey", "play_dates", ["park_id"], "parks", ["id"], "CASCADE"),
    ("posts_author_id_fkey", "posts", ["author_id"], "users", ["id"], "CASCADE"),
    ("push_subscriptions_user_id_fkey", "push_subscriptions", ["user_id"], "users", ["id"], "CASCADE"),
    ("reactions_user_id_fkey", "reactions", ["user_id"], "users", ["id"], "CASCADE"),
    ("refresh_tokens_user_id_fkey", "refresh_tokens", ["user_id"], "users", ["id"], "CASCADE"),
    ("reports_reporter_id_fkey", "reports", ["reporter_id"], "users", ["id"], "CASCADE"),
    ("rescue_profiles_reviewed_by_fkey", "rescue_profiles", ["reviewed_by"], "users", ["id"], "SET NULL"),
    ("rescue_profiles_user_id_fkey", "rescue_profiles", ["user_id"], "users", ["id"], "CASCADE"),
    ("strikes_report_id_fkey", "strikes", ["report_id"], "reports", ["id"], "SET NULL"),
    ("strikes_user_id_fkey", "strikes", ["user_id"], "users", ["id"], "CASCADE"),
    ("support_tickets_user_id_fkey", "support_tickets", ["user_id"], "users", ["id"], "CASCADE"),
    ("vets_created_by_fkey", "vets", ["created_by"], "users", ["id"], "SET NULL"),
    ("votes_dog_id_fkey", "votes", ["dog_id"], "dogs", ["id"], "CASCADE"),
    ("votes_voter_id_fkey", "votes", ["voter_id"], "users", ["id"], "CASCADE"),
    ("weekly_winners_dog_id_fkey", "weekly_winners", ["dog_id"], "dogs", ["id"], "SET NULL"),
]


def upgrade() -> None:
    for name, table, cols, ref_table, ref_cols, ondelete in FIXES:
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(name, table, ref_table, cols, ref_cols, ondelete=ondelete)


def downgrade() -> None:
    # Recreate the constraints without an ON DELETE action (the prior state).
    for name, table, cols, ref_table, ref_cols, _ondelete in FIXES:
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(name, table, ref_table, cols, ref_cols)
