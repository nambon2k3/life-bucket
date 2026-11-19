from fastapi import APIRouter

from app.schemas.system import JobAccepted, JobStatus
from app.workers.celery_app import celery_app
from app.workers.tasks import daily_reminder, recompute_all_streaks, weekly_review

router = APIRouter()


@router.post("/recompute-streaks", response_model=JobAccepted, status_code=202)
def enqueue_recompute() -> JobAccepted:
    result = recompute_all_streaks.delay()
    return JobAccepted(task_id=result.id, task_name="habits.recompute_all")


@router.post("/daily-reminder", response_model=JobAccepted, status_code=202)
def enqueue_reminder() -> JobAccepted:
    result = daily_reminder.delay()
    return JobAccepted(task_id=result.id, task_name="reminders.daily")


@router.post("/weekly-review", response_model=JobAccepted, status_code=202)
def enqueue_review() -> JobAccepted:
    result = weekly_review.delay()
    return JobAccepted(task_id=result.id, task_name="agent.weekly_review")


@router.get("/{task_id}", response_model=JobStatus)
def read_job(task_id: str) -> JobStatus:
    result = celery_app.AsyncResult(task_id)
    body = JobStatus(task_id=task_id, state=result.state)
    if result.successful():
        value = result.result
        body.result = value if isinstance(value, (dict, list, str, int)) else str(value)
    elif result.failed():
        body.error = str(result.result)
    return body
