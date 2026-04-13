# CLAUDE.md — Fetch Project Guide

## What is Fetch?

A mobile-first web app where dog owners create profiles for their dogs, rate other dogs via a Tinder-style swipe interface, and compete for the weekly "top dog" crown. Extended with lost & found dogs, dog park reviews, community posts, a donation center, and a full admin panel.

## Quick Start

```bash
cp .env.example .env
make up          # Start all 6 Docker services
make migrate     # Run database migrations
make seed        # Create 10 test users + 20 dogs
make test        # Run all tests (85 backend + 3 frontend)
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
Fetch/
├── backend/
│   ├── app/
│   │   ├── main.py           # App factory, middleware, router registration
│   │   ├── config.py         # Pydantic Settings (all env vars)
│   │   ├── db.py             # Async engine + session
│   │   ├── deps.py           # get_current_user, require_admin, require_entitlement
│   │   ├── security.py       # PyJWT encode/decode, bcrypt hashing
│   │   ├── storage.py        # LocalStorage (S3 planned)
│   │   ├── worker.py         # Celery app + Beat schedule
│   │   ├── limiter.py        # slowapi rate limiter
│   │   ├── logging.py        # structlog setup
│   │   ├── middleware.py      # RequestID, logging, security headers
│   │   ├── seed.py           # Dev seed data
│   │   ├── models/           # 17 SQLAlchemy model files (29 classes, 28 tables)
│   │   ├── schemas/          # 17 Pydantic schema files
│   │   ├── routers/          # 18 FastAPI router files
│   │   ├── services/         # 4 service files (feed, ranking, lost, moderation)
│   │   └── tasks/            # 2 Celery tasks (weekly_winner, lost_alerts)
│   ├── tests/                # 16 test files, 85 tests
│   ├── alembic/              # 8 migrations
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── App.tsx            # Routing (consumer + admin shells)
│       ├── pages/             # 19 consumer pages + 8 admin pages
│       ├── components/        # 15 components + 7 ui/ components
│       ├── api/               # 11 API client modules
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
from app.deps import get_current_user, require_admin, require_entitlement

# Regular auth
user: User = Depends(get_current_user)

# Admin only
admin: User = Depends(require_admin)

# Feature-gated
user: User = Depends(require_entitlement("ads_removed"))
```

**All ForeignKeys must have `ondelete`** — use `CASCADE` for owned data, `SET NULL` for references.

**Route ordering matters** — put static paths (e.g., `/reports/nearby`) BEFORE parameterized paths (`/reports/{id}`) in the same router.

### Frontend

**Adding a new page:**
1. Create page in `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx` (wrap with `<AuthGuard>` for protected routes)
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
- Consumer app: 420px max-width, bottom tab bar (6 items), top bar with brand + logout
- Admin panel: full-width, dark top bar, horizontal tab navigation, separate route tree at `/admin/*`
- Bottom tab bar hidden on admin routes
- `pb-16` on consumer shell for tab bar clearance

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
- `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` — Image moderation (empty = auto-approve)
- `RATE_LIMIT_ENABLED` — Set `false` to disable rate limiting
- `VITE_API_BASE_URL` — Frontend API target

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
