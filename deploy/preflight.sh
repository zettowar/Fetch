#!/usr/bin/env bash
# Pre-flight validation for a production deploy.
#
# Fails FAST — before any image is built — when .env is missing required
# secrets or still holds dev-only values that would break or weaken production.
# The backend re-validates most of these at boot (config.py), but catching them
# here turns a slow "build everything, then crash on startup" loop into an
# instant, itemised report.
#
#   make preflight        # run standalone
#   make deploy           # runs this first, aborts on any blocker
#
# Exit code: 0 = safe to deploy (possibly with warnings), 1 = blocking issues.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

# --- output helpers ----------------------------------------------------------
if [ -t 1 ]; then
  RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; BLD=$'\033[1m'; RST=$'\033[0m'
else
  RED=; YEL=; GRN=; BLD=; RST=
fi
FATAL=0
WARN=0
fail()    { printf '%s  ✗ %s%s\n' "$RED" "$*" "$RST"; FATAL=$((FATAL + 1)); }
warn()    { printf '%s  ! %s%s\n' "$YEL" "$*" "$RST"; WARN=$((WARN + 1)); }
ok()      { printf '%s  ✓ %s%s\n' "$GRN" "$*" "$RST"; }
section() { printf '\n%s%s%s\n' "$BLD" "$*" "$RST"; }

lc() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# Read a single value from .env WITHOUT sourcing it — values legitimately
# contain spaces and shell metacharacters (e.g. EMAIL_FROM=Fetch <a@b.dev>),
# so `source` would try to execute them. Returns the last assignment, with
# trailing whitespace / CR trimmed.
env_get() {
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n1 | sed 's/[[:space:]]*$//; s/\r$//'
}

# --- 0. tooling & .env presence ---------------------------------------------
section "Tooling"
if command -v docker >/dev/null 2>&1; then ok "docker on PATH"; else fail "docker not found on PATH"; fi
if docker info >/dev/null 2>&1; then ok "docker daemon reachable"; else fail "docker daemon not reachable — start Docker and retry"; fi
if docker compose version >/dev/null 2>&1; then ok "docker compose v2 available"; else fail "docker compose v2 not available (need the 'docker compose' plugin)"; fi
if docker compose up --help 2>/dev/null | grep -q -- '--wait'; then
  ok "compose supports --wait (deploy will health-gate)"
else
  warn "this docker compose lacks 'up --wait' (v2.1.1+) — deploy cannot block on health and will only start the stack"
fi

section "Environment file"
if [ -f "$ENV_FILE" ]; then
  ok ".env present ($ENV_FILE)"
else
  fail ".env missing — copy the template first:  cp .env.example .env  (then fill in secrets)"
  # Nothing else can be validated without it.
  section "Summary"
  printf '%s%d blocking issue(s). Create .env and re-run.%s\n' "$RED" "$FATAL" "$RST"
  exit 1
fi

# --- 1. secrets & security (blocking) ---------------------------------------
section "Secrets & security"

JWT="$(env_get JWT_SECRET)"
if [ -z "$JWT" ]; then
  fail "JWT_SECRET is empty"
elif [ "$JWT" = "change-me-in-production" ] || printf '%s' "$JWT" | grep -qi 'replace-with'; then
  fail "JWT_SECRET is still the placeholder — generate one: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
elif [ "${#JWT}" -lt 32 ]; then
  fail "JWT_SECRET must be >= 32 chars (got ${#JWT})"
else
  ok "JWT_SECRET is set and strong (${#JWT} chars)"
fi

PGPW="$(env_get POSTGRES_PASSWORD)"
if [ -n "$PGPW" ]; then ok "POSTGRES_PASSWORD set"; else fail "POSTGRES_PASSWORD is empty (docker-compose.prod.yml requires it)"; fi

DBTOK_OK=1
for t in DEBUG_RESET_TOKEN DEBUG_VERIFY_TOKEN; do
  case "$(lc "$(env_get "$t")")" in
    true | 1 | yes | on) fail "$t must be false in production (leaks reset/verify tokens in API responses)"; DBTOK_OK=0 ;;
  esac
done
[ "$DBTOK_OK" = 1 ] && ok "DEBUG_RESET_TOKEN / DEBUG_VERIFY_TOKEN are off"

CORS="$(env_get CORS_ORIGINS)"
if [ -z "$CORS" ]; then
  fail "CORS_ORIGINS is empty — list your site origin(s)"
elif printf '%s' "$CORS" | tr ',' '\n' | sed 's/[[:space:]]//g' | grep -qx '\*'; then
  fail "CORS_ORIGINS cannot be '*' (credentials are allowed; a wildcard is rejected at boot)"
else
  case "$CORS" in
    *localhost* | *127.0.0.1*) warn "CORS_ORIGINS still contains localhost ($CORS) — set it to your https site origin(s)" ;;
    https://*) ok "CORS_ORIGINS=$CORS" ;;
    *) warn "CORS_ORIGINS should be https origin(s) in production (got: $CORS)" ;;
  esac
fi

# --- 2. hostnames & the DATABASE_URL <-> POSTGRES_* footgun ------------------
section "Networking & database wiring"

DOMAIN="$(env_get DOMAIN)"
if [ -z "$DOMAIN" ]; then
  fail "DOMAIN is empty — set your public hostname (docker-compose.prod.yml requires it; use 'localhost' only to smoke-test)"
elif [ "$(lc "$DOMAIN")" = "localhost" ]; then
  warn "DOMAIN=localhost → Caddy issues a self-signed cert. Fine for a smoke test, NOT a real deploy."
else
  ok "DOMAIN=$DOMAIN"
fi

DBURL="$(env_get DATABASE_URL)"
# postgresql+asyncpg://USER:PASS@HOST:PORT/DB(?params)
CREDS="$(printf '%s' "$DBURL" | sed -n 's#^[a-zA-Z+]*://\([^:@/]*\):\([^@]*\)@[^/]*/\([^?]*\).*#\1|\2|\3#p')"
if [ -n "$CREDS" ]; then
  DBU="${CREDS%%|*}"; _rest="${CREDS#*|}"; DBP="${_rest%%|*}"; DBD="${_rest##*|}"
  WANT_U="$(env_get POSTGRES_USER)"; [ -n "$WANT_U" ] || WANT_U="fetch"
  WANT_D="$(env_get POSTGRES_DB)";   [ -n "$WANT_D" ] || WANT_D="fetch"
  MISMATCH=""
  [ "$DBU" = "$WANT_U" ] || MISMATCH="$MISMATCH user($DBU≠$WANT_U)"
  [ "$DBD" = "$WANT_D" ] || MISMATCH="$MISMATCH db($DBD≠$WANT_D)"
  [ "$DBP" = "$PGPW" ]   || MISMATCH="$MISMATCH password"
  if [ -n "$MISMATCH" ]; then
    fail "DATABASE_URL creds do not match POSTGRES_* :$MISMATCH — they describe the SAME database and must agree, or the backend can't connect"
  else
    ok "DATABASE_URL credentials match POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB"
  fi
  DBHOST="$(printf '%s' "$DBURL" | sed -n 's#^[a-zA-Z+]*://[^@]*@\([^:/]*\).*#\1#p')"
  if [ -n "$DBHOST" ] && [ "$DBHOST" != "db" ]; then
    warn "DATABASE_URL host is '$DBHOST'; inside the prod compose network it should be 'db' (the postgres service name)"
  fi
else
  warn "could not parse DATABASE_URL to cross-check it against POSTGRES_* — verify the credentials match by hand"
fi

# The frontend bundle bakes VITE_* at build time. A localhost API URL ships a
# frontend that calls the operator's laptop; prod should leave it empty so the
# SPA hits the relative /api that nginx proxies.
VITE="$(env_get VITE_API_BASE_URL)"
if [ -z "$VITE" ]; then
  ok "VITE_API_BASE_URL empty → SPA uses the relative /api/v1 (correct for prod)"
else
  case "$(lc "$VITE")" in
    *localhost* | *127.0.0.1*) fail "VITE_API_BASE_URL=$VITE bakes a localhost API into the frontend build — use a relative /path (or leave EMPTY) for prod; nginx proxies /api" ;;
    /*) ok "VITE_API_BASE_URL=$VITE is a relative same-origin path (equivalent to empty — nginx proxies it)" ;;
    *) warn "VITE_API_BASE_URL is an absolute URL ($VITE); prod normally uses a relative /api/v1 so the SPA stays same-origin" ;;
  esac
fi

# --- 3. integrations (warnings — deploy still succeeds) ---------------------
section "Integrations (non-blocking)"

if [ -n "$(env_get RESEND_API_KEY)" ]; then
  ok "RESEND_API_KEY set → transactional email enabled"
  case "$(env_get EMAIL_FROM)" in
    *resend.dev*) warn "EMAIL_FROM uses the resend.dev sandbox sender → only delivers to your own Resend account email; switch to a verified domain before launch" ;;
  esac
else
  warn "RESEND_API_KEY empty → email disabled: signup/verify/reset links and the lost-dog contact relay degrade (relay returns 503)"
fi

FB="$(env_get FRONTEND_BASE_URL)"
case "$(lc "$FB")" in
  https://*) ok "FRONTEND_BASE_URL=$FB" ;;
  *localhost* | "") warn "FRONTEND_BASE_URL=$FB → links inside emails would point at localhost; set it to your https site origin" ;;
  *) warn "FRONTEND_BASE_URL should be your https site origin (got: $FB)" ;;
esac

[ -n "$(env_get SENTRY_DSN)" ]          && ok "SENTRY_DSN set → error tracking enabled"     || warn "SENTRY_DSN empty → no error tracking"
[ -n "$(env_get SIGHTENGINE_API_USER)" ] && ok "Sightengine keys set → image moderation on" || warn "SIGHTENGINE_* empty → image moderation auto-approves every upload"

# --- summary -----------------------------------------------------------------
section "Summary"
if [ "$FATAL" -gt 0 ]; then
  printf '%s%d blocking issue(s), %d warning(s). Fix the blockers above and re-run.%s\n' "$RED$BLD" "$FATAL" "$WARN" "$RST"
  exit 1
fi
if [ "$WARN" -gt 0 ]; then
  printf '%s%d warning(s) — deploy can proceed, but review them above.%s\n' "$YEL$BLD" "$WARN" "$RST"
else
  printf '%sAll checks passed — safe to deploy.%s\n' "$GRN$BLD" "$RST"
fi
exit 0
