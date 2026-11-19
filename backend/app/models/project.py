from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Project(TimestampMixin, Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    bucket_id: Mapped[int] = mapped_column(ForeignKey("buckets.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    overview: Mapped[str] = mapped_column(Text, default="")
    scope: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="planned", index=True)
    start_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    bucket: Mapped["Bucket"] = relationship("Bucket", back_populates="projects")
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="project")
