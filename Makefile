.PHONY: up down migrate revision seed test lint

up:
	docker compose up --build -d

down:
	docker compose down

migrate:
	docker compose exec backend alembic upgrade head

revision:
	docker compose exec backend alembic revision --autogenerate -m "$(msg)"

seed:
	docker compose exec backend python -m app.seed

test:
	docker compose exec -e RATE_LIMIT_ENABLED=false backend pytest -v
	docker compose exec frontend npm test -- --run

lint:
	docker compose exec backend ruff check app/
	docker compose exec frontend npm run lint
