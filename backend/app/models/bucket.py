from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Bucket(TimestampMixin, Base):
    """An area of life. Habits, projects, and tasks hang off a bucket."""

    __tablename__ = "buckets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    icon: Mapped[str] = mapped_column(String(16), default="•")
    description: Mapped[str] = mapped_column(String(300), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    habits: Mapped[list["Habit"]] = relationship("Habit", back_populates="bucket")
    projects: Mapped[list["Project"]] = relationship("Project", back_populates="bucket")
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="bucket")
