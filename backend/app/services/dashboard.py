from datetime import date, datetime, timezone

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.cache import DASHBOARD_KEY, cache_get, cache_set
from app.core.config import get_settings
from app.models import Bucket, Habit, Project, Task
from app.schemas.dashboard import DashboardOut
from app.services.serialize import to_bucket, to_habit, to_project, to_task


def get_dashboard(db: Session) -> DashboardOut:
    cached = cache_get(DASHBOARD_KEY)
    if cached:
        try:
            stored = DashboardOut.model_validate_json(cached)
        except ValidationError:
            stored = None
        if stored is not None:
            return stored.model_copy(update={"cached": True})
    dashboard = build_dashboard(db)
    cache_set(DASHBOARD_KEY, dashboard.model_dump_json(), ttl=get_settings().dashboard_cache_ttl_seconds)
    return dashboard


def build_dashboard(db: Session) -> DashboardOut:
    today = date.today()
    buckets = list(db.scalars(select(Bucket).order_by(Bucket.sort_order, Bucket.id)).all())
    habits = list(
        db.scalars(
            select(Habit)
            .options(selectinload(Habit.bucket), selectinload(Habit.checkins))
            .where(Habit.archived.is_(False))
            .order_by(Habit.id)
        ).all()
    )
    projects = list(
        db.scalars(
            select(Project)
            .options(selectinload(Project.bucket), selectinload(Project.tasks))
            .order_by(Project.created_at.desc())
        ).all()
    )
    tasks = list(
        db.scalars(
            select(Task).options(selectinload(Task.bucket), selectinload(Task.project)).order_by(Task.created_at.desc())
        ).all()
    )
    habit_counts: dict[int, int] = {}
    for habit in habits:
        habit_counts[habit.bucket_id] = habit_counts.get(habit.bucket_id, 0) + 1
    project_counts: dict[int, int] = {}
    for project in projects:
        project_counts[project.bucket_id] = project_counts.get(project.bucket_id, 0) + 1
    return DashboardOut(
        buckets=[to_bucket(bucket, habit_counts.get(bucket.id, 0), project_counts.get(bucket.id, 0)) for bucket in buckets],
        habits=[to_habit(habit, today) for habit in habits],
        projects=[to_project(project) for project in projects],
        tasks=[to_task(task) for task in tasks],
        generated_at=datetime.now(timezone.utc),
        cached=False,
    )
