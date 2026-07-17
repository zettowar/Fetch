# CLAUDE.md — Fetchpawz Project Guide

## What is Fetchpawz?

A mobile-first web app where dog owners create profiles for their dogs, rate other dogs via a Tinder-style swipe interface, and compete for the weekly "top dog" crown. Extended with lost & found dogs, dog parks (reviews, check-ins, play dates), vets, rescues + adoption inquiries, dog transfers, social (follows/comments/reactions, user blocks), community posts, a notification inbox, public dog share pages (`/dogs/{id}`, opt-out via `dogs.is_public`), member + admin invite codes, liked-dogs history, crown badges/weekly rank on dog pages, account management (password/email change), support tickets + FAQ, beta feedback, billing entitlements, and a full admin panel. Donations are in-app via Stripe Checkout — to the platform and (via Stripe Connect Express) to rescues, with external donation links as the fallback (see Donations below); the shop is Shopify-only (see below).

## Quick Start

```bash
cp .env.example .env
make up          # Start all 6 Docker services
make migrate     # Run database migrations
make seed        # Create 10 test users + 20 dogs
make test        # Run all tests (~260 backend + ~63 frontend)
```

- **Frontend:** http://localhost:3174
- **Backend API:** http://localhost:9001
- **API Docs:** http://localhost:9001/docs
- **Admin:** http://localhost:3174/admin (login as user1@fetchapp.dev / password123)

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + Alembic + PostgreSQL 15
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion + TanStack Query
- **Jobs:** Celery + Redis (weekly winner, lost dog alerts)
- **Observability:** structlog (JSON), Sentry, Prometheus at `/metrics`

## Project Structure

```
Fetchpawz/
├── backend/
│   ├── app/
│   │   ├── main.py           # App factory, middleware, router registration
│   │   ├── config.py         # Pydantic Settings (all env vars)
│   │   ├── db.py             # Async engine + session
│   │   ├── deps.py           # get_current_user, require_admin, require_approved_rescue
│   │   ├── security.py       # PyJWT encode/decode, bcrypt hashing
│   │   ├── storage.py        # LocalStorage (S3 planned)
│   │   ├── worker.py         # Celery app + Beat schedule
│   │   ├── limiter.py        # slowapi rate limiter
│   │   ├── logging.py        # structlog setup
│   │   ├── middleware.py      # RequestID, logging, security headers
│   │   ├── seed.py           # Dev seed data
│   │   ├── models/           # ~22 SQLAlchemy model files
│   │   ├── schemas/          # ~23 Pydantic schema files
│   │   ├── routers/          # ~23 FastAPI router files
│   │   ├── services/         # feed, ranking, lost, moderation, dog_serializer,
│   │   │                     #   breed_display, osm_import (+ park/vet configs)
│   │   └── tasks/            # 3 Celery tasks (weekly_winner, lost_alerts,
│   │                         #   token_cleanup)
│   ├── tests/                # backend test suite (~232 tests)
│   ├── alembic/              # ~26 migrations (linear chain)
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── App.tsx            # Routing (marketing + consumer + admin shells)
│       ├── marketing/         # public marketing site (Home/About/Mission/News)
│       ├── pages/             # ~37 consumer pages + admin/ (15 admin pages)
│       ├── components/        # shared components + ui/ primitives
│       ├── api/               # ~20 typed API client modules
│       ├── store/             # AuthContext (React Context)
│       ├── utils/             # time.ts (relativeTime, dogAge, photoUrl)
│       └── types/             # TypeScript interfaces
├── docker-compose.yml         # 6 services
├── Makefile                   # up, down, migrate, revision, seed, test, lint
└── .env.example
```

## Key Patterns

### Backend

**Adding a new feature:**
1. Create model in `app/models/newfeature.py` (extend `Base`, `UUIDPrimaryKey`, `TimestampMixin`)
2. Add to `app/models/__init__.py`
3. Create schema in `app/schemas/newfeature.py` (add `model_config = {"from_attributes": True}` on response schemas)
4. Create router in `app/routers/newfeature.py`
5. Register in `app/main.py`: `app.include_router(newfeature.router, prefix="/api/v1/newfeature", tags=["newfeature"])`
6. Generate migration: `make revision msg="add newfeature"`
7. Apply: `make migrate`
8. Add tests in `tests/test_newfeature.py`

**Auth dependencies:**
```python
from app.deps import get_current_user, require_admin, require_approved_rescue

# Regular auth
user: User = Depends(get_current_user)

# Admin only
admin: User = Depends(require_admin)

# Approved rescue accounts only
user: User = Depends(require_approved_rescue)
```

**All ForeignKeys must have `ondelete`** — use `CASCADE` for owned data, `SET NULL` for references.

**Route ordering matters** — put static paths (e.g., `/reports/nearby`) BEFORE parameterized paths (`/reports/{id}`) in the same router.

### Frontend

**Two intents — keep them separate (`src/App.tsx`):**
The frontend serves two distinct experiences, split by route tree:
- **Marketing website** (`src/marketing/*`) — the web-first, full-width,
  responsive site every *unauthenticated* visitor sees. Routes: `/` (Home),
  `/about`, `/mission`, `/news`, wrapped in `MarketingLayout` (site header +
  footer). NOT constrained to the app's mobile column. The app is invite/beta
  gated ("coming soon"), so the site funnels to **Log in** only — public
  sign-up is not surfaced (the `/signup` routes still work by direct link).
  The gate is enforced server-side: with `INVITE_REQUIRED=true` (prod default)
  `/auth/signup` requires an unused admin-generated invite code and consumes
  it atomically. Rescue signups stay open — they are approval-gated instead.
- **Web app** (`src/pages/*`) — the authenticated product, a mobile-portrait
  420px column, mounted under `/app/*` behind `<AuthGuard>` via `AppShell`
  (top bar + bottom tab bar). All in-app router links MUST use the `/app/...`
  prefix or they dead-end in the 404.
- **Auth screens** (login/signup/reset/verify) use `AuthLayout` (centered,
  responsive) at the domain root.
- **Admin** — full-width own shell at `/admin/*`.

**Adding a new page:**
1. Create page in `src/pages/NewPage.tsx`
2. Add a child route under the `/app` tree in `src/App.tsx` (already inside
   `<AuthGuard>` + `AppShell`); use the un-prefixed child path (e.g. `foo` →
   `/app/foo`). Internal links to it use the full `/app/foo`.
3. Add API functions in `src/api/newfeature.ts` (import `client` from `./client`)
4. Use TanStack Query: `useQuery({ queryKey: ['key'], queryFn: apiFn })`

**Shared components:**
- `Button` — variants: primary, secondary, danger, ghost. Sizes: sm, md, lg. Has `loading` prop.
- `Input` — auto-generates `id`/`htmlFor` linkage. Has `label` and `error` props.
- `PasswordInput` — extends Input with show/hide toggle and optional `showStrength` bar.
- `BackButton` — browser back with fallback path.
- `Skeleton`, `CardSkeleton`, `ListSkeleton` — loading placeholders.
- `ErrorState` — error display with retry button.
- `Avatar` — colored initial circle, consistent hash-based color.

**Utilities (`src/utils/time.ts`):**
- `relativeTime(dateStr)` — "2h ago", "3d ago"
- `dogAge(birthdayStr)` — "2 yrs 3 mo"
- `photoUrl(photo)` — resolves photo URL with fallback

**Layout:**
- Marketing site: web-first, full-width, responsive (`max-w-7xl` sections), own
  site header + footer, mobile hamburger nav — NOT the app column
- Consumer app (`/app/*`): 420px max-width, bottom tab bar (6 items), top bar
  with brand + logout, `pb-20` shell clearance for the tab bar
- Admin panel: full-width, dark top bar, horizontal tab navigation, separate route tree at `/admin/*`
- Bottom tab bar hidden on admin/marketing routes (they render outside `AppShell`)

### Testing

**Backend tests** use ASGI transport with `NullPool` to avoid asyncpg connection sharing issues:
```python
@pytest.mark.asyncio
async def test_something(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/endpoint", headers=auth_headers)
    assert res.status_code == 200
```

Available fixtures: `client`, `auth_headers` (regular user), `admin_headers` (admin user).

Rate limiting is disabled in tests via `limiter.enabled = False` in conftest.

**Tests run against an isolated database** — conftest derives
`<dbname>_test` from `DATABASE_URL` (override with `TEST_DATABASE_URL`) and
drops/recreates it each session, so `make test` never touches dev data. The
schema comes from `create_all`, so migration↔model drift would normally be
invisible — `tests/test_migration_model_sync.py` closes that hole by
upgrading a scratch DB to alembic head and diffing it against the models.
Keep new indexes/constraints declared in BOTH a migration and the model.

**Frontend tests** use Vitest + React Testing Library with jsdom.

## Docker Services

| Service | Image | Host Port | Internal Port |
|---------|-------|-----------|---------------|
| db | postgres:15 | 5438 | 5432 |
| redis | redis:7-alpine | 6380 | 6379 |
| backend | Dockerfile | 9001 | 8000 |
| celery-worker | Dockerfile | — | — |
| celery-beat | Dockerfile | — | — |
| frontend | Dockerfile | 3174 | 5173 |

## Environment Variables

Key vars (see `.env.example` for full list):
- `DATABASE_URL` — PostgreSQL async connection string
- `JWT_SECRET` — HMAC signing key (**change in production**)
- `REDIS_URL` / `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` — Redis connections
- `SENTRY_DSN` — Sentry error tracking (empty = disabled)
- `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` — Image moderation (empty =
  auto-approve; with keys set, API errors fail CLOSED to "flagged" and land in
  the admin review queue at Admin → Content)
- `RESEND_API_KEY` / `EMAIL_FROM` / `FRONTEND_BASE_URL` — Transactional email
  via Resend's HTTPS API (`app/services/email.py`; API-only, so it works on
  SMTP-blocking hosts like DigitalOcean). Empty key = email disabled: sends
  are logged and skipped, the contact relay returns 503, and reset/verify
  fall back to the `DEBUG_*_TOKEN` dev flows. With a key: signup + resend
  send verification links, forgot-password sends reset links, the lost-dog
  contact relay delivers (reporter address hidden, Reply-To = sender), and
  proximity alerts email subscribers. `FRONTEND_BASE_URL` builds the links.
- `RATE_LIMIT_ENABLED` — Set `false` to disable rate limiting (counters live in
  Redis so limits hold across workers)
- `INVITE_REQUIRED` — require an invite code at signup (off in dev, on in prod)
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` — Postgres container
  credentials (prod compose requires the password; must match `DATABASE_URL`)
- `VITE_API_BASE_URL` — Frontend API target (leave empty in prod; nginx proxies
  the relative `/api` to the backend)

## Test Accounts

After `make seed`:
- `user1@fetchapp.dev` / `password123` — admin role
- `user2@fetchapp.dev` through `user10@fetchapp.dev` / `password123` — regular users

## Common Tasks

```bash
make up                          # Start everything
make test                        # Run all tests
make revision msg="description"  # Create new migration
make migrate                     # Apply migrations
make seed                        # Seed dev data
make lint                        # Lint backend + frontend
docker compose logs backend -f   # Tail backend logs
docker compose logs celery-worker -f  # Tail worker logs
```

## Production Deployment

`docker-compose.yml` is for **local dev only** (bind-mounts, autoreload, dev
servers, runs as root). Production runs from `docker-compose.prod.yml` — the
one command to deploy it is:

```bash
make deploy    # full runbook in deploy/DEPLOY.md
```

`make deploy` (`deploy/deploy.sh`) is the robust path: it runs pre-flight
validation of `.env` (`deploy/preflight.sh` — blocks on weak/missing secrets,
the `DATABASE_URL`↔`POSTGRES_*` mismatch footgun, dev-only flags, a localhost
`VITE_API_BASE_URL`, etc.), takes a pre-deploy `pg_dump`, builds the images,
brings the stack up with `--wait` so it **blocks until every container is
healthy** (migrations run first, so a bad migration fails the deploy instead of
half-applying), then smoke-tests the public HTTPS edge. `make preflight` runs
the checks alone; `make prod-ps` / `prod-logs` / `prod-backup` / `prod-restore`
cover day-2 ops (see `make help`). The raw
`docker compose -f docker-compose.prod.yml up -d --build` still works but skips
all the guardrails.

It builds immutable images from `backend/Dockerfile.prod` and
`frontend/Dockerfile.prod` (non-root users, multi-worker Uvicorn, static build
served by nginx), adds healthchecks + memory limits, and sets
`ENVIRONMENT=production`. Set real secrets in `.env` first — the app refuses to
boot if `JWT_SECRET` is weak, `CORS_ORIGINS` contains `*`, or the
`DEBUG_*_TOKEN` flags are on while `ENVIRONMENT=production`.

Traffic flow: caddy (ports 80/443) terminates TLS with auto-provisioned
Let's Encrypt certs for `$DOMAIN` (`deploy/Caddyfile`; HSTS + HTTP→HTTPS
redirect) and proxies to nginx, which serves the SPA and proxies `/api/` to
the backend container (`frontend/nginx.conf`). The backend trusts the
forwarded chain (`--proxy-headers` + `FORWARDED_ALLOW_IPS`) so rate limiting
keys on real client IPs, runs `alembic upgrade head` before starting uvicorn,
and the celery services wait on its healthcheck — a fresh deploy boots with
schema in place. A `db-backup` sidecar takes daily rotated `pg_dump`s into
the `db_backups` volume (`deploy/backup.sh`, `BACKUP_KEEP_DAYS`); off-box
copies are on you (e.g. sync to DO Spaces). CI smoke-builds both prod images
on every push. Still missing for real production: log shipping and S3
uploads.

## Donations (Stripe)

In-app donations live in `backend/app/routers/donations.py` (`/api/v1/donations`)
with the Stripe REST calls in `services/stripe_service.py` (plain httpx — no
SDK). Two money flows:

- **Platform** ("Support Fetchpawz") — ordinary Checkout to the platform account.
- **Rescues** — Stripe **Connect Express** destination charges. Rescues onboard
  from their dashboard (`POST /donations/connect/onboard`); `rescue_profiles`
  stores `stripe_account_id` + `stripe_charges_enabled` (synced on read and via
  the optional `account.updated` webhook). Non-onboarded rescues keep their
  external `donation_url` link everywhere. `DONATION_PLATFORM_FEE_PERCENT`
  takes an application fee on rescue donations (default 0).

Empty `STRIPE_SECRET_KEY` = feature disabled: endpoints 503, the UI shows
external links only. The webhook (`POST /donations/webhook`, unauthenticated,
HMAC-verified, idempotent via the `stripe_events` table) confirms payments and
emits `donation_thanks` / `donation_received` inbox notifications —
`STRIPE_WEBHOOK_SECRET` is required in production when the key is set (boot
guard). Donation rows survive account deletion (SET NULL FKs +
`recipient_name` snapshot). Local testing:
`stripe listen --forward-to localhost:9001/api/v1/donations/webhook`.

## Shop (Shopify-only — no backend)

The shop (`ShopPage`, `CartPage`, `frontend/src/api/shop.ts`) talks **directly
to the Shopify Storefront GraphQL API from the browser** — there is intentionally
no shop/product/cart/order table or router in the backend. Set
`VITE_SHOPIFY_DOMAIN` / `VITE_SHOPIFY_STOREFRONT_TOKEN` to point at a store;
leave them empty to run an in-memory demo catalog + localStorage cart (checkout
disabled). The Storefront token is a public, client-side token by design.

## Phased / stub features (intentionally incomplete)

These are scaffolded but not fully wired — marked with `PHASEn` comments in code:

- **Push notification delivery** — subscriptions are stored
  (`routers/notifications.py`) but never dispatched. (The in-app notification
  inbox IS real: `services/notify.py` emits on follows, comments, sightings,
  transfers, inquiries, weekly wins, and photo moderation; push would be a
  second delivery channel for the same events.)
- **Billing checkout** — entitlements can be granted/revoked by an admin
  (`routers/billing.py`); there is no self-serve payment flow.
- **S3 storage** (`storage.py`) — only `LocalStorage` is implemented.

No longer stubs: invite codes are enforced at signup when `INVITE_REQUIRED=true`;
flagged photos have a full admin review queue (list/view/approve/reject under
`/api/v1/admin/photos/*`, surfaced on the admin Content page); and with
`RESEND_API_KEY` set, the lost-dog contact relay actually delivers email and
proximity alerts email subscribers (both degrade explicitly when unset —
relay 503s, alerts log-only).
