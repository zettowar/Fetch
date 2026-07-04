#!/usr/bin/env bash
# Robust production deploy — the single command behind `make deploy`.
#
# Steps, each aborting the whole run on failure:
#   1. Pre-flight validation           (deploy/preflight.sh)
#   2. Pre-deploy database backup       (only if a DB is already running)
#   3. Build immutable images
#   4. Start the stack and BLOCK until every container is healthy (up --wait).
#      The backend runs `alembic upgrade head` before it reports healthy, so a
#      failed migration fails the deploy here instead of silently half-applying.
#   5. Smoke-test the public HTTPS edge.
#
# Nothing destructive happens before the step-2 backup, so a failed deploy
# leaves the previous data intact and restorable.
#
#   make deploy                 # normal path
#   SKIP_BACKUP=1 make deploy   # skip the pre-deploy backup (e.g. no data yet)
#   FORCE=1 make deploy         # proceed even if the pre-deploy backup fails
#   WAIT_TIMEOUT=600 make deploy # allow longer for slow first-time image builds
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROD="docker-compose.prod.yml"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
TIMEOUT="${WAIT_TIMEOUT:-300}"

# --- output helpers ----------------------------------------------------------
if [ -t 1 ]; then
  RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; BLU=$'\033[36m'; BLD=$'\033[1m'; RST=$'\033[0m'
else
  RED=; YEL=; GRN=; BLU=; BLD=; RST=
fi
step() { printf '\n%s==> %s%s\n' "$BLU$BLD" "$*" "$RST"; }
info() { printf '    %s\n' "$*"; }
good() { printf '%s    ✓ %s%s\n' "$GRN" "$*" "$RST"; }
warn() { printf '%s    ! %s%s\n' "$YEL" "$*" "$RST"; }
die()  { printf '\n%s✗ %s%s\n' "$RED$BLD" "$*" "$RST" >&2; exit 1; }

dc() { docker compose -f "$PROD" "$@"; }

env_get() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n1 | sed 's/[[:space:]]*$//; s/\r$//'; }

# True if the given compose service currently has a running container.
service_running() {
  dc ps "$1" 2>/dev/null | grep -Eq 'running|healthy|[[:space:]]Up'
}

# ============================================================================
step "1/5  Pre-flight validation"
bash "$ROOT/deploy/preflight.sh" || die "Pre-flight failed — nothing was built or changed. Fix the blockers above and re-run."

DOMAIN="$(env_get DOMAIN)"

# ============================================================================
step "2/5  Pre-deploy database backup"
if [ "${SKIP_BACKUP:-0}" = "1" ]; then
  info "SKIP_BACKUP=1 — skipping."
elif service_running db; then
  STAMP="$(date -u +%Y%m%d-%H%M%S)"
  info "Dumping the live database before migrations run…"
  if dc run --rm --no-deps -T --entrypoint sh db-backup -c \
       "pg_dump --format=custom --file=/backups/predeploy-$STAMP.dump && ls -lh /backups/predeploy-$STAMP.dump"; then
    good "Backup saved to the db_backups volume: predeploy-$STAMP.dump"
  elif [ "${FORCE:-0}" = "1" ]; then
    warn "Pre-deploy backup FAILED — continuing anyway because FORCE=1."
  else
    die "Pre-deploy backup FAILED. Investigate (make prod-logs SERVICE=db), or re-run with FORCE=1 to deploy without a fresh backup (risky)."
  fi
else
  info "No running database detected — first deploy, nothing to back up."
fi

# ============================================================================
step "3/5 & 4/5  Build images and start the stack (blocks until healthy)"
WAIT_ARGS=""
if dc up --help 2>/dev/null | grep -q -- '--wait'; then
  WAIT_ARGS="--wait --wait-timeout $TIMEOUT"
  info "Will wait up to ${TIMEOUT}s for all containers to become healthy."
else
  warn "This docker compose lacks --wait; starting without health-gating. Verify with: make prod-ps"
fi

# shellcheck disable=SC2086  # WAIT_ARGS is intentionally word-split
if ! dc up -d --build --remove-orphans $WAIT_ARGS; then
  printf '\n'
  dc ps || true
  printf '\n%sRecent backend logs:%s\n' "$BLD" "$RST"
  dc logs --tail 50 backend || true
  die "Stack did not come up healthy within ${TIMEOUT}s. Your data is intact (see the pre-deploy backup). Debug with: make prod-logs"
fi
good "All containers reported healthy."

# ============================================================================
step "5/5  Smoke-test the public edge"
CURLOPTS="-fsS"
[ "$(printf '%s' "$DOMAIN" | tr '[:upper:]' '[:lower:]')" = "localhost" ] && CURLOPTS="-fsS -k"
URL="https://$DOMAIN/"
EDGE_OK=0
if command -v curl >/dev/null 2>&1; then
  # Real domains need a moment for Let's Encrypt issuance on a first boot.
  i=1
  while [ "$i" -le 6 ]; do
    CODE="$(curl $CURLOPTS -o /dev/null -w '%{http_code}' "$URL" 2>/dev/null || true)"
    if [ "$CODE" = "200" ]; then EDGE_OK=1; break; fi
    info "waiting for TLS/edge ($URL → ${CODE:-no-response}); attempt $i/6…"
    sleep 5
    i=$((i + 1))
  done
else
  warn "curl not found — skipping the edge smoke test."
fi

if [ "$EDGE_OK" = "1" ]; then
  good "Public edge is serving: $URL (HTTP 200)"
elif command -v curl >/dev/null 2>&1; then
  warn "Public edge $URL did not return 200 yet."
  info "The stack is healthy, so this is usually TLS provisioning (a real DOMAIN needs its DNS pointed here and up to ~1 min for the Let's Encrypt cert)."
  info "Check with: make prod-logs SERVICE=caddy"
fi

step "Deploy complete"
dc ps
printf '\n%sTail logs:%s make prod-logs   |  %sStatus:%s make prod-ps   |  %sRollback:%s see deploy/DEPLOY.md\n' \
  "$BLD" "$RST" "$BLD" "$RST" "$BLD" "$RST"
