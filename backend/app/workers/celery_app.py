from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "habbit",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Ho_Chi_Minh",
    enable_utc=True,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
    task_routes={
        "habits.recompute_all": {"queue": "habits"},
        "habits.record_activity": {"queue": "habits"},
        "reminders.daily": {"queue": "reminders"},
        "agent.weekly_review": {"queue": "agent"},
    },
    beat_schedule={
        "recompute-streaks": {
            "task": "habits.recompute_all",
            "schedule": crontab(hour=6, minute=50),
        },
        "daily-reminder": {
            "task": "reminders.daily",
            "schedule": crontab(hour=7, minute=0),
        },
        "weekly-review": {
            "task": "agent.weekly_review",
            "schedule": crontab(hour=8, minute=0, day_of_week=1),
        },
    },
    imports=("app.workers.tasks",),
)
celery_app.set_default()
