"""LangGraph tools. Each one opens its own database session.

The HTTP request, the Celery worker, and the agent all call the same service
functions, so a check-in made by the coach is the same check-in made by the UI.
"""

import json
from datetime import date, time

from langchain_core.tools import tool
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.cache import invalidate_dashboard
from app.core.database import session_scope
from app.models import Bucket, Habit, JournalEvent, Project, Task
from app.services.bus import publish_activity
from app.services.catalog import (
    create_bucket,
    create_habit,
    create_project,
    create_task,
    delete_habit as remove_habit,
    record_checkin,
    remove_checkin,
)


def habits_snapshot() -> list[dict]:
    today = date.today()
    with session_scope() as db:
        habits = db.scalars(
            select(Habit)
            .options(selectinload(Habit.bucket), selectinload(Habit.checkins))
            .where(Habit.archived.is_(False))
            .order_by(Habit.id)
        ).all()
        return [
            {
                "id": habit.id,
                "name": habit.name,
                "bucket": habit.bucket.name,
                "bucket_id": habit.bucket_id,
                "description": habit.description,
                "frequency": habit.frequency,
                "done_today": any(checkin.checked_on == today for checkin in habit.checkins),
                "current_streak": habit.current_streak,
                "longest_streak": habit.longest_streak,
            }
            for habit in habits
        ]


def open_tasks_snapshot() -> list[dict]:
    with session_scope() as db:
        tasks = db.scalars(
            select(Task)
            .options(selectinload(Task.bucket), selectinload(Task.project))
            .where(Task.status == "open")
            .order_by(Task.due_on.asc().nulls_last(), Task.id)
        ).all()
        return [
            {
                "id": task.id,
                "title": task.title,
                "due_on": task.due_on.isoformat() if task.due_on else None,
                "priority": task.priority,
                "bucket": task.bucket.name if task.bucket else None,
                "project": task.project.name if task.project else None,
            }
            for task in tasks
        ]


def projects_snapshot() -> list[dict]:
    with session_scope() as db:
        projects = db.scalars(select(Project).options(selectinload(Project.bucket)).order_by(Project.id)).all()
        return [
            {
                "id": project.id,
                "name": project.name,
                "status": project.status,
                "bucket": project.bucket.name,
                "bucket_id": project.bucket_id,
            }
            for project in projects
        ]


def buckets_snapshot() -> list[dict]:
    with session_scope() as db:
        buckets = db.scalars(select(Bucket).order_by(Bucket.sort_order, Bucket.id)).all()
        return [
            {
                "id": bucket.id,
                "name": bucket.name,
                "icon": bucket.icon,
                "description": bucket.description,
                "habit_count": len(bucket.habits),
                "project_count": len(bucket.projects),
            }
            for bucket in buckets
        ]


def _parse_day(value: str) -> date | None:
    text = value.strip()
    if not text:
        return date.today()
    return date.fromisoformat(text)


def _parse_clock(value: str) -> time | None:
    text = value.strip()
    if not text:
        return None
    parsed = time.fromisoformat(text)
    return parsed.replace(microsecond=0)


def context_snapshot() -> str:
    payload = {
        "today": date.today().isoformat(),
        "habits": habits_snapshot(),
        "open_tasks": open_tasks_snapshot(),
        "projects": projects_snapshot(),
        "buckets": buckets_snapshot(),
    }
    return json.dumps(payload, ensure_ascii=False)


@tool
def list_habits_today() -> str:
    """List active habits, whether each one is done today, and its current streak."""

    return json.dumps(habits_snapshot(), ensure_ascii=False)


@tool
def list_open_tasks() -> str:
    """List tasks that are not done, including due date, priority, bucket, and project."""

    return json.dumps(open_tasks_snapshot(), ensure_ascii=False)


@tool
def list_projects() -> str:
    """List projects with their status and life bucket."""

    return json.dumps(projects_snapshot(), ensure_ascii=False)


@tool
def log_habit_checkin(habit_id: int) -> str:
    """Mark a habit done for today. Call this only when the user explicitly asks to check in."""

    try:
        with session_scope() as db:
            habit = record_checkin(db, habit_id, date.today())
            payload = {"id": habit.id, "name": habit.name, "current_streak": habit.current_streak}
    except LookupError as exc:
        return json.dumps({"error": str(exc)})
    invalidate_dashboard()
    publish_activity("checkin", f"{payload['name']} checked in via assistant")
    return json.dumps(payload)


@tool
def add_task(
    title: str,
    notes: str = "",
    due_on: str = "",
    priority: str = "medium",
    bucket_id: int = 0,
    project_id: int = 0,
) -> str:
    """Create a task the user already confirmed. project_id must be an id they chose.

    Pass the General project's id only when the user asked for General. due_on is YYYY-MM-DD or empty.
    If the project is missing, call ask_missing_info with field project and stop. Do not pass 0.
    """

    if project_id <= 0:
        return json.dumps({"error": "project_id is required. Call ask_missing_info with field project and stop."})
    parsed_due: date | None = None
    if due_on.strip():
        try:
            parsed_due = date.fromisoformat(due_on.strip())
        except ValueError:
            return json.dumps({"error": "due_on must be YYYY-MM-DD"})
    try:
        with session_scope() as db:
            task = create_task(
                db,
                title=title,
                notes=notes,
                due_on=parsed_due,
                priority=priority,
                bucket_id=bucket_id or None,
                project_id=project_id or None,
            )
            payload = {"id": task.id, "title": task.title, "due_on": task.due_on.isoformat() if task.due_on else None}
    except LookupError as exc:
        return json.dumps({"error": str(exc)})
    invalidate_dashboard()
    publish_activity("task", f"Assistant added task {payload['title']}")
    return json.dumps(payload)


@tool
def add_journal_entry(title: str, note: str = "", tag: str = "", entry_on: str = "", at_time: str = "") -> str:
    """Record one journal event. title is required. entry_on is YYYY-MM-DD or empty for today. at_time is HH:MM or empty."""

    cleaned = title.strip()
    if not cleaned:
        return json.dumps({"error": "title is required"})
    if len(cleaned) > 140 or len(note.strip()) > 280 or len(tag.strip()) > 40:
        return json.dumps({"error": "title max 140, note max 280, tag max 40 characters"})
    try:
        day = _parse_day(entry_on)
        clock = _parse_clock(at_time)
    except ValueError:
        return json.dumps({"error": "entry_on must be YYYY-MM-DD and at_time must be HH:MM"})
    with session_scope() as db:
        event = JournalEvent(entry_on=day, at_time=clock, title=cleaned, note=note.strip(), tag=tag.strip())
        db.add(event)
        db.flush()
        db.refresh(event)
        payload = {
            "id": event.id,
            "entry_on": event.entry_on.isoformat(),
            "at_time": event.at_time.isoformat(timespec="minutes") if event.at_time else None,
            "title": event.title,
            "note": event.note,
            "tag": event.tag,
        }
    publish_activity("journal", f"Recorded {payload['title']}")
    return json.dumps(payload, ensure_ascii=False)


@tool
def list_journal_entries(year: int = 0, month: int = 0) -> str:
    """List journal events. Pass year and month together for one month, or leave both at 0 for the latest entries."""

    if (year > 0) != (month > 0) or (month and not 1 <= month <= 12):
        return json.dumps({"error": "Pass both year and month, or neither"})
    with session_scope() as db:
        query = select(JournalEvent)
        if year and month:
            start = date(year, month, 1)
            end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
            query = query.where(JournalEvent.entry_on >= start, JournalEvent.entry_on < end)
        events = db.scalars(
            query.order_by(JournalEvent.entry_on.desc(), JournalEvent.at_time.asc().nulls_last(), JournalEvent.id)
        ).all()
        rows = [
            {
                "id": event.id,
                "entry_on": event.entry_on.isoformat(),
                "at_time": event.at_time.isoformat(timespec="minutes") if event.at_time else None,
                "title": event.title,
                "note": event.note,
                "tag": event.tag,
            }
            for event in events[:30]
        ]
    return json.dumps(rows, ensure_ascii=False)


@tool
def add_habit(name: str, bucket_id: int = 0, description: str = "", frequency: str = "daily") -> str:
    """Create a habit in a bucket the user chose. frequency is daily or weekly.

    If the bucket is not explicit, call ask_missing_info with field bucket and stop. Do not pass 0.
    """

    if bucket_id <= 0:
        return json.dumps({"error": "bucket_id is required. Call ask_missing_info with field bucket and stop."})
    if frequency not in {"daily", "weekly"}:
        return json.dumps({"error": "frequency must be daily or weekly"})
    if not name.strip():
        return json.dumps({"error": "name is required"})
    try:
        with session_scope() as db:
            habit = create_habit(db, bucket_id, name, description, frequency)
            payload = {"id": habit.id, "name": habit.name, "bucket_id": habit.bucket_id, "frequency": habit.frequency}
    except LookupError as exc:
        return json.dumps({"error": str(exc)})
    invalidate_dashboard()
    publish_activity("habit", f"Added habit {payload['name']}")
    return json.dumps(payload, ensure_ascii=False)


@tool
def delete_habit(habit_id: int) -> str:
    """Delete a habit and its check-ins. Call this only when the user explicitly asks to remove that habit."""

    try:
        with session_scope() as db:
            name = remove_habit(db, habit_id)
    except LookupError as exc:
        return json.dumps({"error": str(exc)})
    invalidate_dashboard()
    publish_activity("habit", f"Removed habit {name}")
    return json.dumps({"deleted": name, "habit_id": habit_id}, ensure_ascii=False)


@tool
def remove_habit_checkin(habit_id: int) -> str:
    """Undo today's check-in for a habit. Call this only when the user asks to uncheck it."""

    try:
        with session_scope() as db:
            habit = remove_checkin(db, habit_id, date.today())
            payload = {"id": habit.id, "name": habit.name, "current_streak": habit.current_streak, "done_today": False}
    except LookupError as exc:
        return json.dumps({"error": str(exc)})
    invalidate_dashboard()
    publish_activity("checkin", f"{payload['name']} unchecked via assistant")
    return json.dumps(payload, ensure_ascii=False)


@tool
def add_project(
    name: str,
    bucket_id: int = 0,
    overview: str = "",
    scope: str = "",
    status: str = "planned",
    start_on: str = "",
    end_on: str = "",
) -> str:
    """Create a project in a bucket the user chose. status is planned, in_progress, or completed.

    Dates are YYYY-MM-DD or empty. If the bucket is not explicit, call ask_missing_info with field bucket and stop.
    """

    if bucket_id <= 0:
        return json.dumps({"error": "bucket_id is required. Call ask_missing_info with field bucket and stop."})
    if status not in {"planned", "in_progress", "completed"}:
        return json.dumps({"error": "status must be planned, in_progress, or completed"})
    if not name.strip():
        return json.dumps({"error": "name is required"})
    try:
        start = date.fromisoformat(start_on.strip()) if start_on.strip() else None
        end = date.fromisoformat(end_on.strip()) if end_on.strip() else None
    except ValueError:
        return json.dumps({"error": "start_on and end_on must be YYYY-MM-DD"})
    try:
        with session_scope() as db:
            project = create_project(db, bucket_id, name, overview, status, start, end, scope)
            payload = {"id": project.id, "name": project.name, "bucket_id": project.bucket_id, "status": project.status}
    except LookupError as exc:
        return json.dumps({"error": str(exc)})
    invalidate_dashboard()
    publish_activity("project", f"Added project {payload['name']}")
    return json.dumps(payload, ensure_ascii=False)


@tool
def list_buckets() -> str:
    """List life buckets with their ids, so a new habit or project can be placed in one."""

    return json.dumps(buckets_snapshot(), ensure_ascii=False)


@tool
def add_bucket(name: str, description: str = "", icon: str = "") -> str:
    """Create a life bucket. Call this only when the user explicitly asks for a new bucket."""

    if not name.strip():
        return json.dumps({"error": "name is required"})
    with session_scope() as db:
        bucket = create_bucket(db, name, icon, description)
        payload = {"id": bucket.id, "name": bucket.name, "icon": bucket.icon, "description": bucket.description}
    invalidate_dashboard()
    publish_activity("bucket", f"Added life bucket {payload['name']}")
    return json.dumps(payload, ensure_ascii=False)


@tool
def ask_missing_info(field: str, question: str = "") -> str:
    """Stop and ask the user before any write. field is project, habit, bucket, due_on, priority, or other.

    Project, habit, and bucket choices come from the database. Do not invent ids or names.
    After this tool, stop. Do not call a write tool in the same turn.
    """

    kind = field.strip().lower()
    choices: list[dict] = []
    if kind in {"project", "project_id"}:
        kind = "project"
        choices = [{"id": row["id"], "name": row["name"]} for row in projects_snapshot()]
    elif kind in {"habit", "habit_id"}:
        kind = "habit"
        choices = [{"id": row["id"], "name": row["name"]} for row in habits_snapshot()]
    elif kind in {"bucket", "bucket_id"}:
        kind = "bucket"
        choices = [{"id": row["id"], "name": row["name"]} for row in buckets_snapshot()]
    text = question.strip() or (
        "Which project should this use?"
        if kind == "project"
        else "Which habit?"
        if kind == "habit"
        else "Which life bucket?"
        if kind == "bucket"
        else "What is missing?"
    )
    return json.dumps({"need_user": True, "field": kind, "question": text, "choices": choices}, ensure_ascii=False)


READ_TOOLS = [list_habits_today, list_open_tasks, list_projects, list_buckets, list_journal_entries]
WRITE_TOOLS = [
    log_habit_checkin,
    remove_habit_checkin,
    add_habit,
    delete_habit,
    add_task,
    add_project,
    add_bucket,
    add_journal_entry,
]
CLARIFY_TOOLS = [ask_missing_info]
