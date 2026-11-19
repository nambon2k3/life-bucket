from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str = ""
    due_on: date | None = None
    priority: Literal["low", "medium", "high"] = "medium"
    bucket_id: int | None = None
    project_id: int | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = None
    due_on: date | None = None
    priority: Literal["low", "medium", "high"] | None = None
    status: Literal["open", "done"] | None = None
    bucket_id: int | None = None
    project_id: int | None = None


class TaskOut(BaseModel):
    id: int
    title: str
    notes: str
    due_on: date | None
    priority: str
    status: str
    bucket_id: int | None
    bucket_name: str | None
    project_id: int | None
    project_name: str | None
