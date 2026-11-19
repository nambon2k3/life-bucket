"""Demo rows shaped like the Life Buckets board, so the UI is not empty on first boot."""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Bucket, Habit, HabitCheckin, Project, Task
from app.services.catalog import apply_streak


def backfill_scope(db: Session) -> None:
    """Fill the demo project's scope once, after the column is added to an existing database."""

    learning = db.scalar(select(Project).where(Project.name == "LEARNING"))
    if learning is None or (learning.scope or "").strip():
        return
    learning.scope = (
        "API and queues: FastAPI writes Postgres, RabbitMQ carries the slow work, Redis caches the board.\n"
        "Local coach: LangGraph calls a model on this machine and uses the same services as the UI."
    )


def seed_if_empty(db: Session) -> None:
    existing = db.scalar(select(func.count()).select_from(Bucket))
    if existing:
        return

    today = date.today()
    general = Bucket(
        name="General",
        slug="general",
        icon="•",
        description="A home for projects and habits when their bucket is removed.",
        sort_order=0,
    )
    db.add(general)
    db.flush()
    general_project = Project(
        bucket_id=general.id,
        name="General",
        overview="Tasks that are not part of a named project.",
        status="in_progress",
    )
    db.add(general_project)
    db.flush()

    specs = [
        ("Job", "job", "💼", "Work you are paid to do."),
        ("Family & Friends", "family-friends", "👨‍👩‍👧", "People you want to keep close."),
        ("Journal", "journal", "📓", "A daily record of what actually happened."),
        ("Relationship", "relationship", "♥", "Time reserved for your partner."),
        ("Study", "study", "📚", "Skills and subjects you are learning."),
        ("Business", "business", "🚀", "Something you are building on the side."),
        ("Fitness", "fitness", "🏋", "Training, sleep, and food."),
        ("Career", "career", "🎯", "The longer arc beyond today's job."),
    ]
    buckets = {}
    for order, (name, slug, icon, description) in enumerate(specs, start=1):
        bucket = Bucket(name=name, slug=slug, icon=icon, description=description, sort_order=order)
        db.add(bucket)
        buckets[slug] = bucket
    db.flush()

    learning = Project(
        bucket_id=buckets["study"].id,
        name="LEARNING",
        overview="Ship the habit system: API, queues, and a coach that runs on a local model.",
        scope="API and queues: FastAPI writes Postgres, RabbitMQ carries the slow work, Redis caches the board.\nLocal coach: LangGraph calls a model on this machine and uses the same services as the UI.",
        status="in_progress",
        start_on=today - timedelta(days=20),
        end_on=today + timedelta(days=40),
    )
    portfolio = Project(
        bucket_id=buckets["career"].id,
        name="Portfolio site",
        overview="A small site that shows two finished projects instead of a list of intentions.",
        status="planned",
        start_on=today + timedelta(days=7),
        end_on=today + timedelta(days=60),
    )
    strength = Project(
        bucket_id=buckets["fitness"].id,
        name="Strength block",
        overview="Twelve weeks of lifting, already closed out.",
        status="completed",
        start_on=today - timedelta(days=90),
        end_on=today - timedelta(days=6),
    )
    db.add_all([learning, portfolio, strength])
    db.flush()

    habits = [
        Habit(bucket_id=buckets["fitness"].id, name="Morning workout", description="Thirty minutes before opening the laptop.", frequency="daily"),
        Habit(bucket_id=buckets["study"].id, name="Deep work", description="One protected block on the learning project.", frequency="daily"),
        Habit(bucket_id=buckets["journal"].id, name="Gratitude journal", description="Three lines before bed.", frequency="daily"),
        Habit(bucket_id=buckets["family-friends"].id, name="Family call", description="A real conversation, not a reaction emoji.", frequency="weekly"),
    ]
    db.add_all(habits)
    db.flush()
    workout, deep_work, _journal, family = habits
    for offset in (1, 2, 3):
        db.add(HabitCheckin(habit_id=workout.id, checked_on=today - timedelta(days=offset)))
    db.add(HabitCheckin(habit_id=deep_work.id, checked_on=today))
    db.add(HabitCheckin(habit_id=family.id, checked_on=today - timedelta(days=7)))
    db.flush()
    for habit in habits:
        apply_streak(db, habit, today)

    db.add_all(
        [
            Task(title="Sketch the data model", notes="Buckets, habits, projects, tasks.", due_on=today - timedelta(days=2), priority="medium", status="done", bucket_id=buckets["study"].id, project_id=learning.id),
            Task(title="Wire the Celery worker", notes="RabbitMQ carries the message, Redis stores the result.", due_on=today, priority="high", status="open", bucket_id=buckets["study"].id, project_id=learning.id),
            Task(title="Call parents", notes="", due_on=today + timedelta(days=2), priority="medium", status="open", bucket_id=general.id, project_id=general_project.id),
            Task(title="Review offer notes", notes="Write down what is actually negotiable.", due_on=today - timedelta(days=1), priority="high", status="open", bucket_id=buckets["career"].id, project_id=portfolio.id),
            Task(title="Ship landing copy", notes="One page, one offer.", due_on=today + timedelta(days=5), priority="low", status="open", bucket_id=general.id, project_id=general_project.id),
            Task(title="Log the last strength session", notes="", due_on=today - timedelta(days=6), priority="low", status="done", bucket_id=buckets["fitness"].id, project_id=strength.id),
        ]
    )
    db.flush()
