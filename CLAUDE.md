# CLAUDE.md — Fetchpawz Project Guide

## What is Fetchpawz?

A mobile-first web app where owners create profiles for their **cats and dogs**, rate other pets via a Tinder-style swipe interface, and compete for the weekly "top pet" crown — one crown per species (Top Dog and Top Cat). Extended with lost & found pets, dog parks (reviews, check-ins, play dates), vets, rescues + adoption inquiries, pet transfers, social (follows/comments/reactions, user blocks), community posts, a notification inbox, public pet share pages (`/pets/{id}`, opt-out via `pets.is_public`), **QR collar tags** (`routers/tags.py` + `/t/{code}` landing), member + admin invite codes, liked-pets history, crown badges/weekly rank on pet pages, account management (password/email change, **TOTP two-factor**, **Google/GitHub SSO**), support tickets + FAQ, beta feedback, billing entitlements, daily/weekly digest email, a waitlist, swipe allowance + rewarded ads, and a full admin panel. Donations are in-app via Stripe Checkout — to the platform and (via Stripe Connect Express) to rescues, with external donation links as the fallback (see Donations below); the shop is Shopify-only (see below).

## Quick Start

```bash
cp .env.example .env
make up          # Start all 6 Docker services
make migrate     # Run database migrations
make seed        # Create 10 test users + 20 dogs
make test        # Run all tests (~499 backend + ~122 frontend)
```

- **Frontend:** http://localhost:3174
- **Backend API:** http://localhost:9001
- **API Docs:** http://localhost:9001/docs
- **Admin:** http://localhost:3174/admin (login as user1@fetchapp.dev / password123)

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + Alembic + PostgreSQL 15
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion + TanStack Query
- **Jobs:** Celery + Redis (weekly winner, lost dog alerts); Beat reads an
  admin-editable schedule from the DB, not a static dict (see Scheduled jobs)
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
│   │   ├── worker.py         # Celery app; wires the DB-backed Beat scheduler
│   │   ├── beat_scheduler.py # DatabaseScheduler — reads jobs from periodic_tasks
│   │   ├── limiter.py        # slowapi rate limiter
│   │   ├── logging.py        # structlog setup
│   │   ├── middleware.py      # RequestID, logging, security headers
│   │   ├── seed.py           # Dev seed data
│   │   ├── models/           # ~32 SQLAlchemy model files
│   │   ├── schemas/          # ~29 Pydantic schema files
│   │   ├── routers/          # ~30 FastAPI router files
│   │   ├── services/         # ~20 modules: feed, ranking, lost, moderation,
│   │   │                     #   pet_serializer, breed_display, blocks, geo,
│   │   │                     #   email, notify, quota, traits, totp, qr,
│   │   │                     #   stripe, settings, rescue, osm/park/vet import
│   │   └── tasks/            # 7 Celery tasks (weekly_winner, weekly_recap,
│   │                         #   lost_alerts, token_cleanup, digest,
│   │                         #   announcements, schedule_defaults)
│   ├── tests/                # backend test suite (~499 tests)
│   ├── alembic/              # ~47 migrations (linear chain)
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── App.tsx            # Routing (marketing + consumer + admin shells)
│       ├── marketing/         # public marketing site (Home/About/Mission/News)
│       ├── pages/             # ~44 consumer pages + admin/ (24 admin pages)
│       ├── components/        # shared components + ui/ primitives
│       ├── api/               # ~26 typed API client modules
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
  `/about`, `/mission`, `/news`, `/privacy`, `/terms`, plus the public share
  pages (`/pets/:id`, `/rescue/:slug`, `/t/:code`), wrapped in
  `MarketingLayout` (site header + footer). NOT constrained to the app's mobile
  column. The app is invite/beta gated ("coming soon"), so the site funnels to
  **Log in** and a **waitlist email capture** ("Get an invite",
  `api/waitlist.ts`) — open public sign-up is not surfaced (the `/signup`
  routes still work by direct link, and admins convert waitlist entries to
  invites from Admin → Invites).
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
  the admin review queue at Admin → Content). A flagged photo stays visible to
  **its owner only**, badged "In review" — see Photo moderation visibility
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
- `BEAT_MAX_INTERVAL` — how often (seconds, default 60) the DB-backed Beat
  scheduler re-checks `periodic_tasks` for edits; also caps schedule-change
  pickup latency
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

## Photo moderation visibility (owner-only, not public)

A photo held by moderation is withheld from everyone *except the owner*.
`pet_to_out(pet, viewer_id=...)` opts into the owner's private view: pass
`viewer_id` only from routes serving the owner their own pet (all of `pets.py`
except `explore`). Leave it off — the default — for the feed, `public.py`,
`social.py` and `rescues.py`, which must never include a withheld photo.

Withheld photos come back with `url: null`, because `/photos/file/{key}` still
404s anything not approved; the owner's own copy is served by the authenticated
`GET /photos/{id}/file` and rendered from a blob by `components/PetPhoto.tsx`.
The point is that an upload held for review used to vanish silently and read as
a failed upload — the upload toast, the "In review" badge and this rule exist to
say what actually happened. A non-approved photo can never be `primary_photo_id`
(upload skips the slot, `admin.approve_photo` claims it later, and
`set_primary_photo` 400s) — a withheld primary would blank the pet's hero
everywhere.

## Personality traits (free-form + admin-curated)

Traits are **not** a fixed enum. Owners type whatever they like in the pet
editor; the `pet_traits` table is the *suggestion* vocabulary and the review
queue behind it (`services/traits.py`, Admin → Traits,
`/api/v1/admin/pet-traits`). An unknown label is normalized
(`normalize_trait`: trim, collapse whitespace, sentence-case, reject
punctuation/emoji/over-30-chars), deduped by slug so casing variants converge,
and inserted as `status="pending"` — it lands on the owner's pet immediately
but isn't offered to anyone else until an admin approves it. `GET /pets/traits`
serves the approved chips, scoped by `species` (`dog` / `cat` / `both`); the
scope filters *suggestions* only and never strips a label off a pet.

The catch to remember: pets store trait **labels** in `pets.traits` (a text
array), not FKs. So editing the vocabulary has to rewrite those arrays —
renaming propagates (`array_replace`), rejecting or deleting purges
(`array_remove`). Max 12 traits per pet.

## Shop (Shopify-only — no backend)

The shop (`ShopPage`, `CartPage`, `frontend/src/api/shop.ts`) talks **directly
to the Shopify Storefront GraphQL API from the browser** — there is intentionally
no shop/product/cart/order table or router in the backend. Set
`VITE_SHOPIFY_DOMAIN` / `VITE_SHOPIFY_STOREFRONT_TOKEN` to point at a store;
leave them empty to run an in-memory demo catalog + localStorage cart (checkout
disabled). The Storefront token is a public, client-side token by design.

## Scheduled jobs (DB-backed Celery Beat — the admin editor)

Beat's schedule lives in the `periodic_tasks` table, not in
`celery_app.conf.beat_schedule` (which is now empty). `app/beat_scheduler.py`
provides `DatabaseScheduler`, a `celery.beat.Scheduler` subclass wired via
`celery_app.conf.beat_scheduler` in `worker.py` — so **only the beat process**
loads it (and its synchronous psycopg2 engine, derived from `DATABASE_URL` via
`settings.SYNC_DATABASE_URL`; the web app + worker stay on async asyncpg). It
reloads when the table changes (detected by `(count, max(updated_at))`), and its
run-count/last-run write-backs use raw SQL that deliberately does **not** bump
`updated_at`, so they never look like a config edit. Admins manage jobs from
**Admin → System** (`AdminSystemPage`) via `/api/v1/admin/scheduled-tasks`
(list/create/patch/delete + `POST /{id}/run` to fire now); the `task` field is
constrained to the app's own registered `app.tasks.*` tasks. Schedule edits take
effect within `BEAT_MAX_INTERVAL` (default 60s) with no redeploy. The built-in
jobs (canonical defs in `app/tasks/schedule_defaults.py`) are seeded into the
table by the `periodic_tasks` migration, so a fresh install schedules exactly as
before. Times are UTC. Run a single beat replica — two would double-schedule.

## QR collar tags

`routers/tags.py` + `services/qr_service.py` mint short codes that map to a pet.
A tag is claimed by its owner from the pet editor, and scanning it hits
`/t/{code}` (`marketing/TagLandingPage.tsx`) which resolves via
`public.py` to the pet's public share page. Admin → Tags lists and revokes them.
A finder reaches the owner through `POST /public/tags/{code}/contact`
(unauthenticated — a stranger holding a lost pet has no account) which relays a
message by email without exposing the owner's address. The tag code is the
credential, so a public share page alone cannot be used to mail an owner.

## Two-factor and SSO

`services/totp.py` implements TOTP enrolment (`/auth/2fa/setup` → `/enable`),
and `auth.login` requires the code when `user.totp_enabled`. SSO
(`routers/oauth.py`, Google + GitHub) uses a single-use handoff code exchanged
for tokens. `oauth_exchange` enforces `totp_enabled` the same way password
login does, answering 401 + `X-2FA-Required`; the handoff code is spent only
after the second factor passes, so a mistyped digit does not force the whole
provider round-trip again.

## Notification delivery — one channel, and it is not the inbox

Worth knowing before adding a feature that "notifies" someone:
`services/notify.py` writes to the **in-app inbox only** — it never sends email.
Email is sent from eight places: `routers/auth.py` (verify/reset/email-change),
`routers/feedback.py` (waitlist invites), `routers/public.py` (the QR-tag
found-pet relay), `routers/rescues.py` (transfer invites),
`routers/admin_ops.py` (the deliverability probe), `routers/admin.py` (support
ticket replies), `tasks/weekly_recap.py`, and `routers/lost.py` (contact relay +
proximity alerts), plus the `tasks/digest.py` / `tasks/announcements.py` jobs. `digest_mode` defaults to
`"off"`, and push is a stub — so by default a user is told about nothing unless
they open the app.

## Support tickets — a conversation, with one field that must never leak

`support_tickets` holds the opening message; replies are rows in
`support_ticket_messages`. The opening body is deliberately NOT copied into that
table — a thread is `[ticket.body] + messages`, so there is no backfill and no
second copy of the same paragraph to drift.

**The rule that matters:** `admin_notes` is internal triage and
`SupportTicketMessage` is the reply channel. They are separate fields precisely
so "probably a chargeback risk" and "here is your answer" cannot be confused.
`TicketMineOut` omits `admin_notes` and `TicketMessageOut` omits the author's
id and name — the reporter is talking to Fetchpawz support, not to a named staff
member. The admin UI styles the two boxes to look nothing alike (brand + send
icon vs. amber + lock) because that is the last line of defence.

State semantics worth keeping:
- `closed` is the only terminal state. Replying to a **resolved** ticket reopens
  it to `open` — otherwise "resolved" becomes where a still-stuck person's
  problem goes to be forgotten. A closed ticket 409s on reply.
- `awaiting_staff` is the queue that matters (Admin → Tickets, "Needs a reply"):
  true for a new ticket and for one the reporter has come back on, cleared by
  any staff action. Status alone hides both cases.
- `POST /admin/tickets/{id}/reply` takes an optional `status`, so "answer and
  resolve" is one action and one notification rather than two.
- A staff reply emits both an inbox notification and a **transactional** email
  (no unsubscribe — it answers a message the recipient sent us). A status change
  with no reply text notifies in-app only; emailing "status changed" with no
  explanation is noise.
- `reporter_last_read_at` is the unread watermark; opening the thread clears it.
  `GET /support/tickets/unread-count` badges the support entry without pulling
  every ticket body.

## Phased / stub features (intentionally incomplete)

These are scaffolded but not fully wired — marked with `PHASEn` comments in code:

- **Push notification delivery** — subscriptions are stored
  (`routers/notifications.py`) but never dispatched. (The in-app notification
  inbox IS real: `services/notify.py` emits on follows, comments, sightings,
  transfers, inquiries, weekly wins, and photo moderation; push would be a
  second delivery channel for the same events.) The PWA manifest now exists,
  which iOS requires before Web Push can work at all.
- **Billing checkout** — entitlements can be granted/revoked by an admin
  (`routers/billing.py`); there is no self-serve payment flow.
- **S3 storage** (`storage.py`) — only `LocalStorage` is implemented. The
  `db-backup` sidecar now archives the uploads volume alongside the `pg_dump`,
  so photos survive a host loss; S3 would remove the volume dependency.

All of the "built server-side but unreachable" backends now have a UI: abuse
reports (`components/ReportDialog.tsx`), support + FAQ (`/app/support`),
lost-pet proximity subscriptions (`components/LostAlertSubscription.tsx`),
park incidents (`components/IncidentReporter.tsx`), the maintenance banner
(`components/MaintenanceBanner.tsx`), and community posts (`/app/community`).

## Weekly recap (admin-gated, OFF by default)

`tasks/weekly_recap.py` emails each owner how their pets did last week — likes,
rank within species, and the rank change — at 00:20 UTC Monday, after the crown
is computed. It closes the reward half of the rate → crown loop, which
previously reached only the two weekly winners.

**Two levers, and only one of them is yours to flip day-to-day:**
- `weekly_recap_enabled` in **Admin → Settings** is the master switch. It ships
  **off**; the Beat job is seeded enabled and no-ops until you turn this on, so
  an operator has one thing to change rather than also hunting for a cron.
- `NotificationPreference.weekly_recap` is the per-user opt-out, which the
  one-click unsubscribe (`recap` list) writes.

Deliberate behaviours worth keeping: pets with no votes that week are skipped
entirely (a "nobody looked at your pet" email is worse than silence); one email
per owner covering all their pets, not one per pet; and standings come from a
single windowed query per week (`ranking_service.get_week_standings`) rather
than per-pet `get_pet_stats` calls, so cost scales with pets-voted-on, not with
the user base.

## Email: transactional vs bulk

`services/email.py` splits two categories, and the distinction is legal, not
cosmetic:

- **Transactional** (verification, password reset, email change, contact relay,
  tag-found, transfer invite, support-ticket reply) — no unsubscribe. An opt-out link on a password
  reset is both nonsense and non-compliant.
- **Bulk** (digest, admin announcements, lost-pet proximity alerts) — MUST call
  `unsubscribe_headers()` (RFC 8058 one-click, which Gmail/Yahoo require of
  bulk senders) and append `unsubscribe_footer()`. Both take `(user_id,
  list_name)` where list_name is one of `digest` / `announcements` /
  `lost_alerts` / `recap`, mapping onto `NotificationPreference`.

Opt-out is a stateless signed token (`create_unsubscribe_token`) resolved by
`POST|GET /public/unsubscribe/{token}` — unauthenticated, because a mail client
has no session, and safe because the token can only ever turn a preference
*off* for the one user it names.

Every send passes `kind=` so `fetchpawz_email_sends_total{kind,outcome}` on
`/metrics` shows a single broken flow without reading logs.

Prometheus + Alertmanager run as an opt-in `monitoring` compose profile and do
scrape it (see `deploy/DEPLOY.md`). Two things about that are load-bearing:
production runs four uvicorn workers and Celery runs separately, so every
process writes to `PROMETHEUS_MULTIPROC_DIR` and the Celery worker exposes its
own `:9100` endpoint as a second scrape target — bulk email is sent from
Celery, so without it the email alerts would watch a process that never sends
any. **Alerts are still delivered by email**, which means an email outage
cannot page you about itself; an off-platform receiver is the remaining gap.

No longer stubs: invite codes are enforced at signup when `INVITE_REQUIRED=true`;
flagged photos have a full admin review queue (list/view/approve/reject under
`/api/v1/admin/photos/*`, surfaced on the admin Content page); and with
`RESEND_API_KEY` set, the lost-dog contact relay actually delivers email and
proximity alerts email subscribers (both degrade explicitly when unset —
relay 503s, alerts log-only).
