from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Task(TimestampMixin, Base):
    """Inbox item. `open` / `done` is stored; Today / Overdue are derived from due_on."""

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str] = mapped_column(String(500), default="")
    due_on: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    priority: Mapped[str] = mapped_column(String(16), default="medium")
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    bucket_id: Mapped[int | None] = mapped_column(ForeignKey("buckets.id"), nullable=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)

    bucket: Mapped["Bucket | None"] = relationship("Bucket", back_populates="tasks")
    project: Mapped["Project"] = relationship("Project", back_populates="tasks")
