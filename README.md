# Fetch

A mobile-first web app where dog owners create profiles for their dogs, rate other dogs in a Tinder-style swipe interface, and compete for the weekly "top dog" crown.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion + TanStack Query
- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + Alembic + PostgreSQL 15
- **Dev Infra:** Docker Compose

## Quick Start

```bash
# 1. Clone and enter the repo
cd Fetch

# 2. Copy env file
cp .env.example .env

# 3. Start all services
make up

# 4. Run database migrations
make migrate

# 5. Seed with sample data (10 users, 20 dogs)
make seed
```

The app will be available at:
- **Frontend:** http://localhost:3174
- **Backend API:** http://localhost:9001
- **API Docs:** http://localhost:9001/docs

## Default Test Accounts

After seeding, you can log in with:
- **Email:** `user1@fetchapp.dev` through `user10@fetchapp.dev`
- **Password:** `password123`
- `user1@fetchapp.dev` has admin role

## Development

```bash
make up        # Start all services
make down      # Stop all services
make migrate   # Run database migrations
make seed      # Seed sample data
make test      # Run all tests
make lint      # Lint all code
```

### Creating a new migration

```bash
make revision msg="add new table"
```

## Project Structure

```
Fetch/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── models/    # SQLAlchemy ORM models
│   │   ├── schemas/   # Pydantic DTOs
│   │   ├── routers/   # API endpoints
│   │   └── services/  # Business logic
│   └── tests/
├── frontend/          # React frontend
│   └── src/
│       ├── api/       # API client & endpoint wrappers
│       ├── components/# React components
│       ├── pages/     # Route pages
│       ├── store/     # Auth context
│       └── types/     # TypeScript types
└── docker-compose.yml
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/signup` | Register |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh token |
| GET | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/dogs` | Create dog profile |
| GET | `/api/v1/dogs/mine` | List my dogs |
| GET | `/api/v1/dogs/{id}` | Get dog profile |
| POST | `/api/v1/dogs/{id}/photos` | Upload photo |
| GET | `/api/v1/feed/next` | Get swipe feed |
| POST | `/api/v1/votes` | Cast vote |
| GET | `/api/v1/rankings/current` | Weekly leaderboard |
| GET | `/api/v1/rankings/winner/current` | Latest winner |
