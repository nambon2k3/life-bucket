"""Shared write operations used by the HTTP API, Celery, and the agent tools."""

import logging
import re
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Bucket, Habit, HabitCheckin, Project, Task
from app.services.streaks import current_streak, longest_streak

logger = logging.getLogger(__name__)


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "bucket"


def unique_slug(db: Session, name: str) -> str:
    base = slugify(name)
    slug = base
    suffix = 2
    while db.scalar(select(Bucket.id).where(Bucket.slug == slug)) is not None:
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug


def apply_streak(db: Session, habit: Habit, today: date | None = None) -> Habit:
    today = today or date.today()
    days = list(
        db.scalars(select(HabitCheckin.checked_on).where(HabitCheckin.habit_id == habit.id)).all()
    )
    habit.current_streak = current_streak(days, today, habit.frequency)
    habit.longest_streak = longest_streak(days, habit.frequency)
    return habit


def record_checkin(db: Session, habit_id: int, day: date) -> Habit:
    habit = db.get(Habit, habit_id)
    if habit is None or habit.archived:
        raise LookupError(f"Habit {habit_id} was not found")
    existing = db.scalar(
        select(HabitCheckin).where(HabitCheckin.habit_id == habit_id, HabitCheckin.checked_on == day)
    )
    if existing is None:
        db.add(HabitCheckin(habit_id=habit_id, checked_on=day))
        db.flush()
    apply_streak(db, habit, date.today())
    return habit


def remove_checkin(db: Session, habit_id: int, day: date) -> Habit:
    habit = db.get(Habit, habit_id)
    if habit is None:
        raise LookupError(f"Habit {habit_id} was not found")
    existing = db.scalar(
        select(HabitCheckin).where(HabitCheckin.habit_id == habit_id, HabitCheckin.checked_on == day)
    )
    if existing is not None:
        db.delete(existing)
        db.flush()
    apply_streak(db, habit, date.today())
    return habit


def create_bucket(db: Session, name: str, icon: str, description: str) -> Bucket:
    bucket = Bucket(
        name=name.strip(),
        slug=unique_slug(db, name),
        icon=icon.strip() or "•",
        description=description.strip(),
        sort_order=(db.scalar(select(Bucket.sort_order).order_by(Bucket.sort_order.desc())) or 0) + 1,
    )
    db.add(bucket)
    db.flush()
    return bucket


def create_habit(db: Session, bucket_id: int, name: str, description: str, frequency: str) -> Habit:
    if db.get(Bucket, bucket_id) is None:
        raise LookupError(f"Bucket {bucket_id} was not found")
    habit = Habit(
        bucket_id=bucket_id,
        name=name.strip(),
        description=description.strip(),
        frequency=frequency,
    )
    db.add(habit)
    db.flush()
    return habit


def create_project(
    db: Session,
    bucket_id: int,
    name: str,
    overview: str,
    status: str,
    start_on: date | None,
    end_on: date | None,
    scope: str = "",
) -> Project:
    if db.get(Bucket, bucket_id) is None:
        raise LookupError(f"Bucket {bucket_id} was not found")
    project = Project(
        bucket_id=bucket_id,
        name=name.strip(),
        overview=overview.strip(),
        scope=scope.strip(),
        status=status,
        start_on=start_on,
        end_on=end_on,
    )
    db.add(project)
    db.flush()
    return project


def ensure_general_bucket(db: Session) -> Bucket:
    """The bucket that receives projects and habits when their bucket is deleted."""

    bucket = db.scalar(select(Bucket).where(Bucket.slug == "general"))
    if bucket is not None:
        return bucket
    bucket = Bucket(
        name="General",
        slug="general",
        icon="•",
        description="A home for projects and habits when their bucket is removed.",
        sort_order=0,
    )
    db.add(bucket)
    db.flush()
    return bucket


def ensure_general_project(db: Session) -> Project:
    """Every task needs a project. Uncategorized work lands here."""

    existing = db.scalar(select(Project).where(Project.name == "General"))
    if existing is not None:
        return existing
    bucket = ensure_general_bucket(db)
    project = Project(
        bucket_id=bucket.id,
        name="General",
        overview="Tasks that are not part of a named project.",
        status="in_progress",
    )
    db.add(project)
    db.flush()
    return project


def assign_orphan_tasks(db: Session) -> None:
    project = ensure_general_project(db)
    orphans = db.scalars(select(Task).where(Task.project_id.is_(None))).all()
    for task in orphans:
        task.project_id = project.id
        task.bucket_id = project.bucket_id
    if orphans:
        db.flush()


def delete_habit(db: Session, habit_id: int) -> str:
    """Remove one habit and the check-ins stored with it.

    Input:
        db (Session): the request session.
        habit_id (int): the habit to remove.

    Output:
        str: the habit name, for the activity log.
        LookupError: when that id is not stored.
    """
    habit = db.get(Habit, habit_id)
    if habit is None:
        raise LookupError(f"Habit {habit_id} was not found")
    name = habit.name
    db.delete(habit)
    return name


def delete_project(db: Session, project_id: int) -> str:
    """Remove one project and the tasks that belong to it.

    Input:
        db (Session): the request session.
        project_id (int): the project to remove.

    Output:
        str: the project name, for the activity log.
        LookupError: when that id is not stored.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise LookupError(f"Project {project_id} was not found")
    name = project.name
    for task in db.scalars(select(Task).where(Task.project_id == project.id)).all():
        db.delete(task)
    db.flush()
    db.delete(project)
    return name


def delete_bucket(db: Session, bucket_id: int) -> str:
    bucket = db.get(Bucket, bucket_id)
    if bucket is None:
        raise LookupError(f"Bucket {bucket_id} was not found")
    if bucket.slug == "general":
        raise ValueError("The General bucket cannot be deleted")
    home = ensure_general_bucket(db)
    fallback = ensure_general_project(db)
    name = bucket.name
    for project in db.scalars(select(Project).where(Project.bucket_id == bucket.id)).all():
        project.bucket_id = home.id
    for habit in db.scalars(select(Habit).where(Habit.bucket_id == bucket.id)).all():
        habit.bucket_id = home.id
    db.flush()
    for task in db.scalars(select(Task).where(Task.bucket_id == bucket.id)).all():
        if task.project_id is None:
            task.project_id = fallback.id
        owner = db.get(Project, task.project_id) if task.project_id else None
        task.bucket_id = owner.bucket_id if owner is not None else home.id
    db.flush()
    db.delete(bucket)
    return name


def create_task(
    db: Session,
    title: str,
    notes: str = "",
    due_on: date | None = None,
    priority: str = "medium",
    bucket_id: int | None = None,
    project_id: int | None = None,
) -> Task:
    project = db.get(Project, project_id) if project_id else None
    if project_id and project is None:
        raise LookupError(f"Project {project_id} was not found")
    if project is None:
        project = ensure_general_project(db)
    del bucket_id  # a task follows its project, so the bucket is not chosen separately
    if priority not in {"low", "medium", "high"}:
        priority = "medium"
    task = Task(
        title=title.strip(),
        notes=notes.strip(),
        due_on=due_on,
        priority=priority,
        status="open",
        bucket_id=project.bucket_id,
        project_id=project.id,
    )
    db.add(task)
    db.flush()
    return task
