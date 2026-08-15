# Production deployment runbook

One command deploys Fetchpawz: **`make deploy`**. It validates your environment,
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
AUTO_HEAL=1   make deploy     # if the stack is split across networks, run a
                              #   full down/up automatically (named volumes kept)
WAIT_TIMEOUT=600 make deploy  # slow first-time image build
```

### Split-network / "could not translate host name" failures

A rolling `make deploy` reuses the already-running stateful containers
(`db`, `redis`, `caddy`). If an earlier deploy recreated the project network —
e.g. after a change to a `networks:` block — those containers get stranded on
the old network while the new `backend` lands on the fresh one, so it fails at
boot with `getaddrinfo`/`could not translate host name "db"`. The deploy now
detects this up front (a one-off container that can't resolve `db`) and stops
with guidance; only a full restart reconciles it:

```bash
docker compose -f docker-compose.prod.yml down --remove-orphans   # data-safe: named volumes kept
make deploy
# or let the deploy do it for you:
AUTO_HEAL=1 make deploy
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

## Monitoring and alerting

`/metrics` is exposed by the backend but **nginx does not proxy it**, so it is
reachable only on the internal compose network — never from the internet.

Prometheus and Alertmanager run as an opt-in compose profile:

```bash
# in .env
ALERT_WEBHOOK_TOKEN=$(openssl rand -hex 32)   # required to run monitoring
ALERT_EMAIL_TO=you@example.com                # where alerts are emailed
```

`make deploy` picks the profile up automatically once `ALERT_WEBHOOK_TOKEN` is
set. Force it with `MONITORING=1 make deploy`, skip it with `MONITORING=0`.
Budget roughly 200 MB of RAM for the two containers.

Alertmanager POSTs firing alerts to `/api/v1/admin/alerts/webhook`, which emails
them through Resend. That indirection exists because Alertmanager can only mail
over SMTP, which DigitalOcean blocks outbound — the same reason the app uses
Resend's HTTPS API. One mail path, one thing to keep working.

What alerts (`deploy/alert_rules.yml`):

| Alert | Fires when |
|-------|-----------|
| `BackendDown` | the API stops answering scrapes for 3m |
| `EmailDeliveryFailing` | Resend rejects/refuses for 15m — resets, verification, lost-pet alerts and transfer invites are all silently not arriving |
| `EmailProviderUnconfigured` | mail is being skipped because `RESEND_API_KEY` is unset |
| `BeatScheduleStalled` | no periodic task has fired for 3x the shortest interval — the weekly crown, digest and token cleanup are stopped |
| `HighServerErrorRate` | >5% of requests 5xx for 10m |

`BeatScheduleStalled` reads `fetchpawz_beat_last_run_age_seconds`, published by
the backend because beat has no HTTP server of its own to scrape. The beat
container also has its own healthcheck (`deploy/beat_healthcheck.py`) that marks
it unhealthy on the same condition — the metric is what actually notifies you.

Neither service is published to the host. To look at them, tunnel:

```bash
ssh -L 9090:localhost:9090 you@droplet   # then open http://localhost:9090
```

## Map tiles

The parks, vets, rescues and lost-pet maps render raster tiles. With
`VITE_MAP_TILE_URL` unset they fall back to `tile.openstreetmap.org`, which is
fine for development but whose [tile usage policy][osm-tiles] prohibits
production and commercial traffic — offenders get throttled or blocked, which
would take the lost-pet map down with it.

Set a paid provider in `.env` **before launch**:

```bash
VITE_MAP_TILE_URL=https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=YOURKEY
```

Like every `VITE_*` value this is baked at build time, so it only takes effect
on the next `make deploy` (not a restart).

[osm-tiles]: https://operations.osmfoundation.org/policies/tiles/

## Backups

A `db-backup` sidecar takes a **daily** rotated backup into the `db_backups`
volume (`BACKUP_KEEP_DAYS`, default 14) — **two** artifacts per run:

| File | What it holds |
|------|---------------|
| `<db>-<stamp>.dump` | custom-format `pg_dump` |
| `uploads-<stamp>.tgz` | every uploaded pet photo |

Photos live on disk, not in Postgres, so restoring only the database gives you
every pet with a blank hero image. **Keep and restore the pair together.**
Rotation also covers the `predeploy-*` and `manual-*` dumps, which previously
accumulated forever.

On top of that:

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
make prod-backups                                          # find the file names
make prod-restore FILE=fetch-20260704-120000.dump          # database
make prod-restore-uploads FILE=uploads-20260704-120000.tgz # photos
```

Restore **both** from the same timestamp — a database restored without its
photos leaves every pet with a blank hero image.

Both targets are **destructive** and prompt for confirmation first.
`prod-restore` drops and recreates objects in the live database
(`pg_restore --clean --if-exists`); `prod-restore-uploads` replaces the entire
uploads volume. Each one stops the relevant writers (backend / celery) for the
duration and brings them back with `--wait`, so nothing writes into a
half-restored state. Consider `make prod-backup` immediately beforehand.

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

## SSO / OAuth (Google + GitHub)

SSO is gated by the admin `sso_enabled` flag (**off** by default) so it stays
invisible to real users until you switch it on. To enable:

1. Create the provider apps and register the callback URIs — full steps are in
   `.env.example` (the `GOOGLE_/GITHUB_OAUTH_*` block). Callback URI pattern:
   `https://<DOMAIN>/api/v1/auth/oauth/<google|github>/callback`.
2. Put the client id/secret + `OAUTH_REDIRECT_BASE=https://<DOMAIN>` in `.env`,
   then `make deploy` (or `make prod-restart SERVICE=backend`).
3. Flip **Admin → Settings → `sso_enabled`** on. Buttons appear on login/signup
   for whichever providers have credentials; turn it off to instantly hide them.

Adding another provider later is a new `OAuthProvider` subclass +
`services/oauth/registry.py` entry + its `*_OAUTH_*` env vars — no flow changes.

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
