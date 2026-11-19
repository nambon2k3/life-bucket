from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class HabitCreate(BaseModel):
    bucket_id: int
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    frequency: Literal["daily", "weekly"] = "daily"


class HabitOut(BaseModel):
    id: int
    bucket_id: int
    bucket_name: str
    name: str
    description: str
    frequency: str
    current_streak: int
    longest_streak: int
    done_today: bool
    checkins: list[date] = []
