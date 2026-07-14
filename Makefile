.PHONY: up down migrate revision seed test lint \
	generate-dogs generate-dogs-smoke generate-dogs-reset \
	deploy preflight prod-build prod-up prod-down prod-ps prod-logs \
	prod-migrate prod-restart prod-shell prod-backup prod-backups prod-restore \
	help

# Production compose file (see docker-compose.prod.yml). Dev uses the default
# docker-compose.yml; every prod target is explicit about the -f override.
PROD := docker-compose.prod.yml

# ---------------------------------------------------------------------------
# Local development
# ---------------------------------------------------------------------------
up: ## Start the dev stack (build + detach)
	docker compose up --build -d

down: ## Stop the dev stack
	docker compose down

migrate: ## Apply DB migrations in the dev backend
	docker compose exec backend alembic upgrade head

revision: ## Autogenerate a migration: make revision msg="add x"
	docker compose exec backend alembic revision --autogenerate -m "$(msg)"

seed: ## Seed dev data (10 users + 20 dogs)
	docker compose exec backend python -m app.seed

test: ## Run backend + frontend test suites
	docker compose exec -e RATE_LIMIT_ENABLED=false backend pytest -v
	docker compose exec frontend npm test -- --run

lint: ## Lint backend (ruff) + frontend (eslint)
	docker compose exec backend ruff check app/
	docker compose exec frontend npm run lint

generate-dogs: ## Generate synthetic dogs
	docker compose exec backend python -m app.scripts.generate_dogs

generate-dogs-smoke: ## Generate a small batch of synthetic dogs
	docker compose exec backend python -m app.scripts.generate_dogs --owners 20 --dogs 50

generate-dogs-reset: ## Reset + regenerate synthetic dogs
	docker compose exec backend python -m app.scripts.generate_dogs --reset

# ---------------------------------------------------------------------------
# Production
# ---------------------------------------------------------------------------
deploy: ## Full robust prod deploy (preflight → backup → build → migrate → health-gate → smoke)
	./deploy/deploy.sh

preflight: ## Validate .env for prod WITHOUT deploying (also the first step of deploy)
	./deploy/preflight.sh

prod-build: ## Build the prod images without starting anything
	docker compose -f $(PROD) build

prod-up: ## Start the prod stack and block until healthy (no rebuild/backup)
	docker compose -f $(PROD) up -d --wait --wait-timeout 300 --remove-orphans

prod-down: ## Stop the prod stack (volumes/data preserved)
	docker compose -f $(PROD) down

prod-ps: ## Show prod container status + health
	docker compose -f $(PROD) ps

prod-logs: ## Tail prod logs (optionally SERVICE=backend)
	docker compose -f $(PROD) logs -f --tail=100 $(SERVICE)

prod-migrate: ## Manually run migrations in the prod backend (normally automatic on boot)
	docker compose -f $(PROD) exec backend alembic upgrade head

prod-restart: ## Restart a prod service: make prod-restart SERVICE=backend
	docker compose -f $(PROD) restart $(SERVICE)

prod-shell: ## Open a shell in the prod backend container
	docker compose -f $(PROD) exec backend sh

prod-backup: ## Take an on-demand DB backup into the db_backups volume
	docker compose -f $(PROD) run --rm --no-deps -T --entrypoint sh db-backup -c \
	  'F=/backups/manual-$$(date -u +%Y%m%d-%H%M%S).dump; pg_dump --format=custom --file="$$F" && ls -lh "$$F"'

prod-backups: ## List backups stored in the db_backups volume
	docker compose -f $(PROD) run --rm --no-deps -T --entrypoint sh db-backup -c 'ls -lh /backups'

prod-restore: ## Restore a backup: make prod-restore FILE=<name-in-db_backups> (DESTRUCTIVE)
	@test -n "$(FILE)" || { echo "usage: make prod-restore FILE=<name>  (see: make prod-backups)"; exit 1; }
	@printf 'This OVERWRITES the live database with %s. Ctrl-C to abort; Enter to proceed. ' "$(FILE)"; read _
	docker compose -f $(PROD) run --rm --no-deps -T --entrypoint sh db-backup -c \
	  'pg_restore --clean --if-exists --no-owner -d "$$PGDATABASE" "/backups/$(FILE)"'

prod-create-admin: ## Create/promote ONE admin (prompts for password; or set ADMIN_EMAIL/ADMIN_PASSWORD)
	docker compose -f $(PROD) exec backend python -m app.scripts.create_admin

prod-reset-db: ## DANGER: wipe ALL prod data (backs up first, drops schema, re-migrates). Then run prod-create-admin.
	@DB=$$(grep -E '^POSTGRES_DB=' .env 2>/dev/null | cut -d= -f2); DB=$${DB:-fetch}; \
	  printf 'This PERMANENTLY DELETES every row in prod DB "%s".\nType the database name to confirm: ' "$$DB"; \
	  read ANS; [ "$$ANS" = "$$DB" ] || { echo "Aborted."; exit 1; }
	@echo "==> 1/4 Taking a safety backup first..."
	$(MAKE) prod-backup
	@echo "==> 2/4 Stopping app writers (db + redis stay up)..."
	docker compose -f $(PROD) stop backend celery-worker celery-beat
	@echo "==> 3/4 Dropping the public schema (all tables + alembic_version)..."
	docker compose -f $(PROD) run --rm --no-deps -T --entrypoint sh db-backup -c \
	  'psql -v ON_ERROR_STOP=1 -d "$$PGDATABASE" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
	@echo "==> 4/4 Booting backend (re-runs alembic upgrade head → fresh schema)..."
	docker compose -f $(PROD) up -d --wait backend
	docker compose -f $(PROD) up -d celery-worker celery-beat
	@echo "Done. Empty schema is live. Next: make prod-create-admin   (optional: make prod-clear-uploads)"

prod-clear-uploads: ## DANGER: delete ALL uploaded files (pet photos, rescue logos) from the uploads volume
	@printf 'This deletes ALL uploaded files. Ctrl-C to abort; Enter to proceed. '; read _
	docker compose -f $(PROD) run --rm --no-deps -T --entrypoint sh backend -c 'rm -rf /app/uploads/* && echo "uploads cleared"'

# ---------------------------------------------------------------------------
help: ## List available targets
	@grep -hE '^[a-zA-Z0-9_-]+:.*?##' $(MAKEFILE_LIST) \
	  | sort \
	  | awk 'BEGIN {FS=":.*?## "} {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
