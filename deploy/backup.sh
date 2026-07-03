#!/bin/sh
# Daily pg_dump with rotation, run by the db-backup sidecar.
# Dumps are custom-format (pg_restore-able) in the db_backups volume.
# Restore: pg_restore -h db -U "$PGUSER" -d "$PGDATABASE" --clean /backups/<file>
set -eu

KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

while true; do
  STAMP="$(date -u +%Y%m%d-%H%M%S)"
  FILE="/backups/${PGDATABASE}-${STAMP}.dump"
  if pg_dump --format=custom --file="$FILE"; then
    echo "backup OK: $FILE ($(du -h "$FILE" | cut -f1))"
  else
    echo "backup FAILED at $STAMP" >&2
    rm -f "$FILE"
  fi
  find /backups -name "${PGDATABASE}-*.dump" -mtime "+${KEEP_DAYS}" -delete
  sleep 86400
done
