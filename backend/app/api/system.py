import json

from fastapi import APIRouter
from kombu import Connection
from sqlalchemy import text

from app.core.cache import REMINDERS_KEY, REVIEW_KEY, cache_get, get_redis, read_activity
from app.core.config import get_settings
from app.core.database import engine
from app.schemas.system import HealthOut, ServiceStatus

router = APIRouter()


def _probe(name: str, check) -> ServiceStatus:
    try:
        check()
    except Exception as exc:
        return ServiceStatus(name=name, ok=False, detail=exc.__class__.__name__)
    return ServiceStatus(name=name, ok=True)


def _postgres() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


def _redis() -> None:
    if not get_redis().ping():
        raise RuntimeError("no pong")


def _rabbitmq() -> None:
    settings = get_settings()
    connection = Connection(settings.celery_broker_url, connect_timeout=2)
    connection.connect()
    connection.release()


@router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    settings = get_settings()
    services = [
        _probe("postgres", _postgres),
        _probe("redis", _redis),
        _probe("rabbitmq", _rabbitmq),
    ]
    return HealthOut(
        ok=all(service.ok for service in services),
        services=services,
        ollama_model=settings.ollama_model,
        ollama_base_url=settings.ollama_base_url,
    )


@router.get("/activity")
def activity() -> list[dict]:
    rows = []
    for raw in read_activity():
        try:
            rows.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
    return rows


@router.get("/reminders")
def reminders() -> dict | None:
    raw = cache_get(REMINDERS_KEY)
    return json.loads(raw) if raw else None


@router.get("/reviews/latest")
def latest_review() -> dict | None:
    raw = cache_get(REVIEW_KEY)
    return json.loads(raw) if raw else None
