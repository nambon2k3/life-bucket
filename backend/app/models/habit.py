from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, UniqueConstraint, false as sql_false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Habit(TimestampMixin, Base):
    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(primary_key=True)
    bucket_id: Mapped[int] = mapped_column(ForeignKey("buckets.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(300), default="")
    frequency: Mapped[str] = mapped_column(String(16), default="daily")
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default=sql_false())

    bucket: Mapped["Bucket"] = relationship("Bucket", back_populates="habits")
    checkins: Mapped[list["HabitCheckin"]] = relationship(
        "HabitCheckin", back_populates="habit", cascade="all, delete-orphan"
    )


class HabitCheckin(Base):
    """One row means the habit was done on that calendar day."""

    __tablename__ = "habit_checkins"
    __table_args__ = (UniqueConstraint("habit_id", "checked_on", name="uq_habit_checkin_day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    habit_id: Mapped[int] = mapped_column(ForeignKey("habits.id", ondelete="CASCADE"), index=True)
    checked_on: Mapped[date] = mapped_column(Date, index=True)
    note: Mapped[str] = mapped_column(String(300), default="")

    habit: Mapped["Habit"] = relationship("Habit", back_populates="checkins")
