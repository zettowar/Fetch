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
#   AUTO_HEAL=1 make deploy     # if the stack is split across networks, run a
#                               #   full down/up automatically (volumes kept)
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

# Reproduce the lookup the backend does at boot: a fresh one-off container on
# the network THIS compose config uses tries to resolve `db`. Non-zero exit means
# a running db is stranded on a stale network and a rolling deploy would fail.
db_reachable_on_compose_network() {
  local i
  for i in 1 2; do
    dc run --rm --no-deps -T --entrypoint sh db-backup -c 'getent hosts db >/dev/null 2>&1' && return 0
    sleep 1
  done
  return 1
}

# Print the data-safe remediation for a split/stranded network.
print_network_remedy() {
  printf '%s\n' "  Reconcile with a full restart — data is safe, named volumes (db, uploads, certs) are kept:"
  printf '%s\n' "    docker compose -f $PROD down --remove-orphans"
  printf '%s\n' "    make deploy            # or: AUTO_HEAL=1 make deploy"
}

# On a detected split: auto-heal with down/up if opted in, else stop with guidance.
heal_or_die() {
  if [ "${AUTO_HEAL:-0}" = "1" ]; then
    warn "AUTO_HEAL=1 — reconciling with a full restart (named volumes are preserved)…"
    dc down --remove-orphans || die "down failed during auto-heal — run it manually, then re-deploy."
    good "Stack brought down; the up step below will recreate everything on one network."
  else
    printf '\n'
    print_network_remedy
    die "$1"
  fi
}

# ============================================================================
step "1/5  Pre-flight validation"
bash "$ROOT/deploy/preflight.sh" || die "Pre-flight failed — nothing was built or changed. Fix the blockers above and re-run."

DOMAIN="$(env_get DOMAIN)"

# ============================================================================
step "2/5  Pre-deploy checks — network sanity + database backup"

# --- Network sanity ---------------------------------------------------------
# A rolling `up` reuses the already-running stateful containers (db/redis/…).
# If an earlier deploy left them on a stale network — e.g. a networks: config
# change recreated the project network — the freshly-created backend lands on a
# different network and dies with a cryptic getaddrinfo("db"). Reproduce that
# lookup here, before building anything, and stop (or auto-heal) with guidance.
if service_running db; then
  info "Verifying db is reachable on the current compose network…"
  if db_reachable_on_compose_network; then
    good "db resolves on the compose network."
  else
    warn "db is running but a fresh container on this compose network can't resolve it — the stack is split across networks."
    heal_or_die "Stranded network detected: a rolling deploy would leave the new backend unable to reach db."
  fi
fi

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
  # Targeted diagnosis: a backend that can't resolve a peer by name is almost
  # always the split/stranded-network state — point straight at the fix.
  if dc logs --tail 50 backend 2>/dev/null \
       | grep -qiE 'could not translate host name|name or service not known|gaierror'; then
    printf '\n%s! Looks like a split-network / DNS failure — containers can'\''t resolve each other by name.%s\n' "$YEL$BLD" "$RST"
    print_network_remedy
  fi
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
