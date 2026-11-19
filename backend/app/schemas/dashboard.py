from datetime import datetime

from pydantic import BaseModel

from app.schemas.bucket import BucketOut
from app.schemas.habit import HabitOut
from app.schemas.project import ProjectOut
from app.schemas.task import TaskOut


class DashboardOut(BaseModel):
    buckets: list[BucketOut]
    habits: list[HabitOut]
    projects: list[ProjectOut]
    tasks: list[TaskOut]
    generated_at: datetime
    cached: bool = False
