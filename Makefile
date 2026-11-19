.PHONY: up down infra logs test api web

up:
	docker compose up --build

down:
	docker compose down

infra:
	docker compose up -d postgres redis rabbitmq

logs:
	docker compose logs -f api worker beat

test:
	cd backend && python -m pytest

api:
	cd backend && uvicorn app.main:app --reload

web:
	cd frontend && npm run dev
