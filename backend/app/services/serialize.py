from datetime import date

from app.models import Bucket, Habit, Project, Task
from app.schemas.bucket import BucketOut
from app.schemas.habit import HabitOut
from app.schemas.project import ProjectOut
from app.schemas.task import TaskOut


def to_bucket(bucket: Bucket, habit_count: int = 0, project_count: int = 0) -> BucketOut:
    return BucketOut(
        id=bucket.id,
        name=bucket.name,
        slug=bucket.slug,
        icon=bucket.icon,
        description=bucket.description,
        sort_order=bucket.sort_order,
        habit_count=habit_count,
        project_count=project_count,
    )


def to_habit(habit: Habit, today: date) -> HabitOut:
    return HabitOut(
        id=habit.id,
        bucket_id=habit.bucket_id,
        bucket_name=habit.bucket.name if habit.bucket is not None else "",
        name=habit.name,
        description=habit.description,
        frequency=habit.frequency,
        current_streak=habit.current_streak,
        longest_streak=habit.longest_streak,
        done_today=any(checkin.checked_on == today for checkin in habit.checkins),
        checkins=sorted(checkin.checked_on for checkin in habit.checkins),
    )


def to_project(project: Project) -> ProjectOut:
    tasks = list(project.tasks)
    return ProjectOut(
        id=project.id,
        bucket_id=project.bucket_id,
        bucket_name=project.bucket.name if project.bucket is not None else "",
        name=project.name,
        overview=project.overview,
        scope=project.scope or "",
        status=project.status,
        start_on=project.start_on,
        end_on=project.end_on,
        task_done=sum(1 for task in tasks if task.status == "done"),
        task_total=len(tasks),
    )


def to_task(task: Task) -> TaskOut:
    return TaskOut(
        id=task.id,
        title=task.title,
        notes=task.notes,
        due_on=task.due_on,
        priority=task.priority,
        status=task.status,
        bucket_id=task.bucket_id,
        bucket_name=task.bucket.name if task.bucket is not None else None,
        project_id=task.project_id,
        project_name=task.project.name if task.project is not None else None,
    )
