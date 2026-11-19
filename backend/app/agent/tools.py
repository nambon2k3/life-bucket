"""LangGraph tools. Each one opens its own database session.

The HTTP request, the Celery worker, and the agent all call the same service
functions, so a check-in made by the coach is the same check-in made by the UI.
"""

import json
from datetime import date

from langchain_core.tools import tool
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.cache import invalidate_dashboard
from app.core.database import session_scope
from app.models import Habit, Project, Task
from app.services.bus import publish_activity
from app.services.catalog import create_task, record_checkin


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
                "frequency": habit.frequency,
                "done_today": any(checkin.checked_on == today for checkin in habit.checkins),
                "current_streak": habit.current_streak,
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


def context_snapshot() -> str:
    payload = {
        "today": date.today().isoformat(),
        "habits": habits_snapshot(),
        "open_tasks": open_tasks_snapshot(),
        "projects": projects_snapshot(),
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
def ask_missing_info(field: str, question: str = "") -> str:
    """Stop and ask the user before any write. field is project, habit, due_on, priority, or other.

    Project and habit choices come from the database. Do not invent ids or names.
    After this tool, stop. Do not call add_task or log_habit_checkin in the same turn.
    """

    kind = field.strip().lower()
    choices: list[dict] = []
    if kind in {"project", "project_id"}:
        kind = "project"
        choices = [{"id": row["id"], "name": row["name"]} for row in projects_snapshot()]
    elif kind in {"habit", "habit_id"}:
        kind = "habit"
        choices = [{"id": row["id"], "name": row["name"]} for row in habits_snapshot()]
    text = question.strip() or (
        "Which project should this use?" if kind == "project" else "Which habit should I check in?" if kind == "habit" else "What is missing?"
    )
    return json.dumps({"need_user": True, "field": kind, "question": text, "choices": choices}, ensure_ascii=False)


READ_TOOLS = [list_habits_today, list_open_tasks, list_projects]
WRITE_TOOLS = [log_habit_checkin, add_task]
CLARIFY_TOOLS = [ask_missing_info]
