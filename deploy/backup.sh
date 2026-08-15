#!/bin/sh
# Daily backup with rotation, run by the db-backup sidecar.
#
# Two artifacts per run, because restoring only one of them is not a restore:
#   * <db>-<stamp>.dump     — custom-format pg_dump (pg_restore-able)
#   * uploads-<stamp>.tgz   — the user-photo volume
#
# Photos live on disk (LocalStorage), not in Postgres, so a database-only
# backup restores every pet with a blank hero image. Keep the pair together.
#
# Restore:
#   pg_restore -h db -U "$PGUSER" -d "$PGDATABASE" --clean /backups/<file>.dump
#   tar xzf /backups/uploads-<stamp>.tgz -C /uploads
set -eu

KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

while true; do
  STAMP="$(date -u +%Y%m%d-%H%M%S)"

  FILE="/backups/${PGDATABASE}-${STAMP}.dump"
  if pg_dump --format=custom --file="$FILE"; then
    echo "db backup OK: $FILE ($(du -h "$FILE" | cut -f1))"
  else
    echo "db backup FAILED at $STAMP" >&2
    rm -f "$FILE"
  fi

  # Mounted read-only at /uploads. Skipped rather than failed when absent, so
  # an older stack without the mount keeps taking database backups.
  if [ -d /uploads ]; then
    UP="/backups/uploads-${STAMP}.tgz"
    if tar czf "$UP" -C /uploads . 2>/dev/null; then
      echo "uploads backup OK: $UP ($(du -h "$UP" | cut -f1))"
    else
      echo "uploads backup FAILED at $STAMP" >&2
      rm -f "$UP"
    fi
  else
    echo "uploads backup SKIPPED: /uploads not mounted" >&2
  fi

  # Rotate both artifact families, and the deploy/manual dumps that used to
  # accumulate forever (predeploy-*.dump is written by deploy/deploy.sh).
  find /backups -name "${PGDATABASE}-*.dump" -mtime "+${KEEP_DAYS}" -delete
  find /backups -name "uploads-*.tgz"        -mtime "+${KEEP_DAYS}" -delete
  find /backups -name "predeploy-*.dump"     -mtime "+${KEEP_DAYS}" -delete
  find /backups -name "manual-*.dump"        -mtime "+${KEEP_DAYS}" -delete

  sleep 86400
done
