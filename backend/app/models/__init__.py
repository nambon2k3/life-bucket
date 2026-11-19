"""Import every model so SQLAlchemy registers them on one metadata object."""

from app.models.base import Base
from app.models.bucket import Bucket
from app.models.habit import Habit, HabitCheckin
from app.models.journal import JournalEvent
from app.models.project import Project
from app.models.task import Task

__all__ = ["Base", "Bucket", "Habit", "HabitCheckin", "JournalEvent", "Project", "Task"]
