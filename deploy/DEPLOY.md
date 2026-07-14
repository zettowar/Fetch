# Production deployment runbook

One command deploys Fetch: **`make deploy`**. It validates your environment,
snapshots the database, builds immutable images, applies migrations, waits for
every container to report healthy, and smoke-tests the public HTTPS edge —
aborting (without touching data) the moment anything is wrong.

This runbook covers first-time setup, the deploy itself, backups/restore, and
rollback. See the root `CLAUDE.md` ("Production Deployment") for the
architecture; this file is the operational how-to.

---

## Prerequisites (on the server)

- Docker Engine + the `docker compose` v2 plugin (v2.1.1+ for `--wait`).
- DNS: an `A`/`AAAA` record for your `DOMAIN` pointing at the host **before**
  the first deploy — Caddy provisions the Let's Encrypt cert on boot and needs
  the domain to resolve to this box.
- Ports **80** and **443** open to the internet (Caddy binds them; ACME’s
  HTTP-01 challenge uses 80).

## First-time setup

```bash
cp .env.example .env
```

Then edit `.env`. The must-set values for production (pre-flight blocks on all
of these):

| Variable | Why |
|---|---|
| `JWT_SECRET` | ≥32-char random string. Generate: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `POSTGRES_PASSWORD` | Postgres superuser password (compose refuses to start without it) |
| `DOMAIN` | Public hostname Caddy issues the TLS cert for |
| `DATABASE_URL` | Its `user:password@host/db` **must match** `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`; host is `db` |
| `CORS_ORIGINS` | Your https site origin(s); never `*` |
| `ENVIRONMENT` | `production` |

Strongly recommended (pre-flight warns if missing):

- `RESEND_API_KEY` + a verified `EMAIL_FROM` — without it, signup/verify/reset
  emails and the lost-dog contact relay are disabled.
- `FRONTEND_BASE_URL=https://<your-domain>` — used for links inside emails.
- `SENTRY_DSN` — error tracking.
- `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` — image moderation
  (empty ⇒ every uploaded photo is auto-approved).
- Leave `VITE_API_BASE_URL` **empty** — the SPA then calls the relative `/api`
  that nginx proxies. A localhost value here ships a broken frontend.

Validate before you ever build:

```bash
make preflight
```

## Deploy

```bash
make deploy
```

What it does, in order (any failure aborts and leaves data intact):

1. **Pre-flight** — `deploy/preflight.sh` re-runs the checks above.
2. **Backup** — if a database is already running, `pg_dump`s it to the
   `db_backups` volume as `predeploy-<timestamp>.dump` *before* migrations.
3. **Build** — immutable images from `backend/Dockerfile.prod` +
   `frontend/Dockerfile.prod`.
4. **Up + migrate + health-gate** — `docker compose up --wait`. The backend
   runs `alembic upgrade head` before it reports healthy, so a bad migration
   fails the deploy here rather than half-applying.
5. **Smoke test** — `GET https://$DOMAIN/` expecting `200` (retries while the
   Let's Encrypt cert is issued on a first boot).

Useful flags:

```bash
SKIP_BACKUP=1 make deploy     # no data yet / backing up separately
FORCE=1       make deploy     # proceed even if the pre-deploy backup fails
WAIT_TIMEOUT=600 make deploy  # slow first-time image build
```

## Day-2 operations

```bash
make prod-ps                       # container status + health
make prod-logs                     # tail everything
make prod-logs SERVICE=backend     # tail one service (backend|caddy|frontend|celery-worker|…)
make prod-restart SERVICE=backend  # restart one service
make prod-shell                    # shell into the backend container
make prod-migrate                  # run migrations by hand (normally automatic on boot)
make prod-down                     # stop the stack (volumes/data preserved)
```

## Backups

A `db-backup` sidecar already takes a **daily** rotated `pg_dump` into the
`db_backups` volume (`BACKUP_KEEP_DAYS`, default 14). On top of that:

```bash
make prod-backup     # on-demand dump -> db_backups volume
make prod-backups    # list stored dumps
```

> **Off-box copies are on you.** The `db_backups` volume lives on the same
> host as the database — a disk loss takes both. Periodically copy dumps off
> the box, e.g.:
>
> ```bash
> docker compose -f docker-compose.prod.yml cp \
>   db-backup:/backups ./backups-$(date -u +%Y%m%d)
> # then sync ./backups-* to S3 / DO Spaces / another host
> ```

## Restore

```bash
make prod-backups                              # find the file name
make prod-restore FILE=predeploy-20260704-120000.dump
```

`prod-restore` is **destructive** — it drops and recreates objects in the live
database (`pg_restore --clean --if-exists`) and prompts for confirmation first.
Consider `make prod-backup` immediately beforehand.

## Resetting production to a clean slate

Use this to wipe early-development junk (test users, insecure accounts, seed
data) and start over with a single fresh admin. **This permanently deletes all
data.** It does not touch the code — the schema is rebuilt from migrations.

```bash
# 0. (Recommended) pull an OFF-BOX copy of the safety backup first — the
#    auto-backup lives in the same db_backups volume you're about to keep, but
#    off-box is safer. See the "Backups" section for the docker cp one-liner.

# 1. Wipe: backs up → stops writers → DROP SCHEMA public → backend re-migrates.
#    Prompts you to type the database name to confirm.
make prod-reset-db

# 2. Create the fresh admin (prompts for email + password; min 12 chars,
#    never echoed or stored in shell history). Created active + verified.
make prod-create-admin

# 3. (Optional) drop orphaned uploaded files (photos/logos the DB no longer references).
make prod-clear-uploads
```

Notes:
- `prod-reset-db` takes its own `manual-<timestamp>.dump` before wiping, so a
  mistake is recoverable with `make prod-restore FILE=<that dump>`.
- Non-interactive admin creation (e.g. from a script): set `ADMIN_EMAIL` and
  `ADMIN_PASSWORD` (and optional `ADMIN_NAME`) in the environment instead of
  being prompted — `docker compose -f docker-compose.prod.yml exec -e ADMIN_EMAIL=… -e ADMIN_PASSWORD=… backend python -m app.scripts.create_admin`.
- The wipe only clears the database. Redis is transient; if you want it clean
  too: `docker compose -f docker-compose.prod.yml exec redis redis-cli FLUSHALL`.

## Rollback

Images are built from source, so a rollback is: **restore the data, then
redeploy the previous code.**

```bash
# 1. Roll the database back to the pre-deploy snapshot
make prod-backups
make prod-restore FILE=predeploy-<timestamp>.dump

# 2. Roll the code back and rebuild
git checkout <previous-good-tag-or-sha>
make deploy
```

Tag known-good releases (`git tag -a v1.2.3 -m ... && git push --tags`) so
step 2 is unambiguous.

> Skip the data restore if the bad deploy contained no schema/data migration —
> just `git checkout` the previous ref and `make deploy`.

## Troubleshooting

| Symptom | Look at |
|---|---|
| `make deploy` aborts in pre-flight | The itemised `✗` lines — each names the `.env` key to fix. |
| Stack never goes healthy | `make prod-logs SERVICE=backend` — usually a failed migration or a bad `DATABASE_URL`. |
| Edge smoke test warns (not 200) | `make prod-logs SERVICE=caddy` — DNS not pointing here yet, or ACME still issuing the cert (give it ~1 min). |
| Emails not sending | `RESEND_API_KEY` unset, or `EMAIL_FROM` still the `resend.dev` sandbox sender (only mails your own Resend account). |
| Backend refuses to boot | It re-validates secrets at startup (`config.py`); the log line names the offending setting. |
