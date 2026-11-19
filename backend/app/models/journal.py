from __future__ import annotations

from datetime import date, time

from sqlalchemy import Date, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class JournalEvent(TimestampMixin, Base):
    """One thing that happened on a day. A journal is the sequence of these, not a long entry."""

    __tablename__ = "journal_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_on: Mapped[date] = mapped_column(Date, index=True)
    at_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    title: Mapped[str] = mapped_column(String(140))
    note: Mapped[str] = mapped_column(String(280), default="")
    tag: Mapped[str] = mapped_column(String(40), default="")
