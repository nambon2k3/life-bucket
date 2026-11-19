from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    bucket_id: int
    name: str = Field(min_length=1, max_length=120)
    overview: str = ""
    scope: str = ""
    status: Literal["planned", "in_progress", "completed"] = "planned"
    start_on: date | None = None
    end_on: date | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    overview: str | None = None
    scope: str | None = None
    status: Literal["planned", "in_progress", "completed"] | None = None
    start_on: date | None = None
    end_on: date | None = None
    bucket_id: int | None = None


class ProjectOut(BaseModel):
    id: int
    bucket_id: int
    bucket_name: str
    name: str
    overview: str
    scope: str = ""
    status: str
    start_on: date | None
    end_on: date | None
    task_done: int
    task_total: int
