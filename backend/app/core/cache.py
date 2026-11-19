"""Redis as an application cache.

This client is separate from Celery's result backend on purpose:
- Redis DB 0 caches dashboard reads and the latest worker outputs.
- Redis DB 1 stores Celery task results.
- RabbitMQ moves the tasks themselves.

If Redis is down, callers fall back to Postgres. The cache is an accelerator,
not the source of truth.
"""

import logging

import redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)

DASHBOARD_KEY = "dashboard:v1"
REMINDERS_KEY = "reminders:latest"
REVIEW_KEY = "reviews:latest"
ACTIVITY_KEY = "activity:feed"

_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _client


def cache_get(key: str) -> str | None:
    try:
        return get_redis().get(key)
    except redis.RedisError:
        logger.exception("Redis GET failed for %s", key)
        return None


def cache_set(key: str, value: str, ttl: int | None = None) -> None:
    try:
        if ttl is None:
            get_redis().set(key, value)
        else:
            get_redis().setex(key, ttl, value)
    except redis.RedisError:
        logger.exception("Redis SET failed for %s", key)


def cache_delete(key: str) -> None:
    try:
        get_redis().delete(key)
    except redis.RedisError:
        logger.exception("Redis DEL failed for %s", key)


def invalidate_dashboard() -> None:
    cache_delete(DASHBOARD_KEY)


def push_activity(entry_json: str, limit: int = 50) -> None:
    client = get_redis()
    client.lpush(ACTIVITY_KEY, entry_json)
    client.ltrim(ACTIVITY_KEY, 0, limit - 1)


def read_activity(limit: int = 20) -> list[str]:
    try:
        return list(get_redis().lrange(ACTIVITY_KEY, 0, limit - 1))
    except redis.RedisError:
        logger.exception("Redis LRANGE failed")
        return []
