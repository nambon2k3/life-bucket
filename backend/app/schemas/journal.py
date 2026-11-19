from datetime import date, datetime, time

from pydantic import BaseModel, Field


class JournalEventCreate(BaseModel):
    entry_on: date
    at_time: time | None = None
    title: str = Field(min_length=1, max_length=140)
    note: str = Field(default="", max_length=280)
    tag: str = Field(default="", max_length=40)


class JournalEventUpdate(BaseModel):
    entry_on: date | None = None
    at_time: time | None = None
    title: str | None = Field(default=None, min_length=1, max_length=140)
    note: str | None = Field(default=None, max_length=280)
    tag: str | None = Field(default=None, max_length=40)


class JournalEventOut(BaseModel):
    id: int
    entry_on: date
    at_time: time | None
    title: str
    note: str
    tag: str
    created_at: datetime
