"""Celery tasks.

RabbitMQ is the broker: it holds the message until a worker takes it.
Redis DB 1 is the result backend: it stores SUCCESS / FAILURE for the UI to poll.
Redis DB 0 is the app cache, written by these tasks when they have something to show.
"""

import json
from datetime import date, datetime, timezone

from celery import shared_task
from sqlalchemy import select

from app.core.cache import REMINDERS_KEY, REVIEW_KEY, cache_set, invalidate_dashboard, push_activity
from app.core.database import session_scope
from app.models import Habit, HabitCheckin
from app.services.catalog import apply_streak
from app.services.streaks import week_start_ordinal


@shared_task(name="habits.recompute_all")
def recompute_all_streaks() -> dict:
    with session_scope() as db:
        habits = list(db.scalars(select(Habit)).all())
        for habit in habits:
            apply_streak(db, habit)
        updated = len(habits)
    invalidate_dashboard()
    return {"updated": updated}


@shared_task(name="habits.record_activity")
def record_activity(kind: str, message: str) -> dict:
    entry = {"kind": kind, "message": message, "at": datetime.now(timezone.utc).isoformat()}
    push_activity(json.dumps(entry))
    return entry


@shared_task(name="reminders.daily")
def daily_reminder() -> dict:
    today = date.today()
    pending: list[dict] = []
    with session_scope() as db:
        habits = list(db.scalars(select(Habit).where(Habit.archived.is_(False)).order_by(Habit.id)).all())
        for habit in habits:
            days = list(
                db.scalars(select(HabitCheckin.checked_on).where(HabitCheckin.habit_id == habit.id)).all()
            )
            if not _done_this_period(days, today, habit.frequency):
                pending.append({"id": habit.id, "name": habit.name, "frequency": habit.frequency})
    payload = {"date": today.isoformat(), "pending": pending, "at": datetime.now(timezone.utc).isoformat()}
    cache_set(REMINDERS_KEY, json.dumps(payload))
    return {"pending": len(pending)}


@shared_task(name="agent.weekly_review")
def weekly_review() -> dict:
    from app.agent.graph import run_agent

    result = run_agent(
        [
            {
                "role": "user",
                "content": (
                    "Write a weekly review in Vietnamese. Mention current streaks, habits still open, "
                    "overdue tasks, and one focus for the next week. Do not check in habits or create tasks."
                ),
            }
        ],
        allow_writes=False,
    )
    payload = {
        "reply": result["reply"],
        "tool_trace": result["tool_trace"],
        "at": datetime.now(timezone.utc).isoformat(),
    }
    cache_set(REVIEW_KEY, json.dumps(payload, ensure_ascii=False))
    return {"chars": len(result["reply"])}


def _done_this_period(days: list[date], today: date, frequency: str) -> bool:
    if frequency == "weekly":
        this_week = week_start_ordinal(today)
        return this_week in {week_start_ordinal(day) for day in days}
    return today in set(days)
