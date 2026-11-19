from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration.

    Docker Compose injects service hostnames (postgres, redis, rabbitmq).
    Running the API on the host reads `backend/.env`, whose defaults point at localhost.
    Environment variables always win over the env file.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://habbit:habbit@localhost:5433/habbit"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "amqp://habbit:habbit@localhost:5672//"
    celery_result_backend: str = "redis://localhost:6379/1"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"
    cors_origins: str = "http://localhost:5173"
    dashboard_cache_ttl_seconds: int = 30

    def origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
