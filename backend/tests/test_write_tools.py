"""Write tools persist the same rows the journal, habit, project, and bucket screens read."""

import json
from contextlib import contextmanager
from datetime import date

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.agent import tools
from app.models import Bucket, Habit, JournalEvent, Project
from app.models.base import Base


def _scope(session_factory):
    @contextmanager
    def session_scope():
        db = session_factory()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    return session_scope


def test_new_mcp_writes_show_up_in_the_lists(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'tools.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    monkeypatch.setattr(tools, "session_scope", _scope(factory))
    monkeypatch.setattr(tools, "invalidate_dashboard", lambda: None)
    monkeypatch.setattr(tools, "publish_activity", lambda *_args: None)

    bucket = json.loads(tools.add_bucket.invoke({"name": "Health", "description": "Body", "icon": ""}))
    assert bucket["name"] == "Health"
    assert bucket["icon"] == "•"

    habit = json.loads(
        tools.add_habit.invoke(
            {"name": "Walk", "bucket_id": bucket["id"], "description": "Morning", "frequency": "daily"}
        )
    )
    listed = json.loads(tools.list_habits_today.invoke({}))
    saved = next(row for row in listed if row["id"] == habit["id"])
    assert saved["current_streak"] == 0
    assert saved["longest_streak"] == 0
    assert saved["done_today"] is False
    assert saved["bucket"] == "Health"

    checked = json.loads(tools.log_habit_checkin.invoke({"habit_id": habit["id"]}))
    assert checked["current_streak"] == 1
    undone = json.loads(tools.remove_habit_checkin.invoke({"habit_id": habit["id"]}))
    assert undone["current_streak"] == 0
    assert undone["done_today"] is False

    project = json.loads(
        tools.add_project.invoke(
            {"name": "Garden", "bucket_id": bucket["id"], "overview": "Beds", "status": "planned"}
        )
    )
    projects = json.loads(tools.list_projects.invoke({}))
    assert any(row["id"] == project["id"] and row["bucket_id"] == bucket["id"] for row in projects)

    entry = json.loads(
        tools.add_journal_entry.invoke(
            {"title": "Planted basil", "note": "Two pots", "tag": "home", "at_time": "07:30"}
        )
    )
    assert entry["entry_on"] == date.today().isoformat()
    assert entry["at_time"] == "07:30"
    journal = json.loads(tools.list_journal_entries.invoke({"year": date.today().year, "month": date.today().month}))
    assert journal[0]["title"] == "Planted basil"

    choices = json.loads(tools.ask_missing_info.invoke({"field": "bucket"}))
    assert choices["need_user"] is True
    assert {"id": bucket["id"], "name": "Health"} in choices["choices"]

    removed = json.loads(tools.delete_habit.invoke({"habit_id": habit["id"]}))
    assert removed["deleted"] == "Walk"
    assert json.loads(tools.list_habits_today.invoke({})) == []

    with factory() as db:
        assert db.scalar(select(Bucket).where(Bucket.id == bucket["id"])) is not None
        assert db.scalar(select(Project).where(Project.id == project["id"])) is not None
        assert db.scalar(select(Habit).where(Habit.id == habit["id"])) is None
        assert db.scalar(select(JournalEvent).where(JournalEvent.title == "Planted basil")) is not None
