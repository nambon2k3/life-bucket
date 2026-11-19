from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.cache import invalidate_dashboard
from app.core.database import get_db
from app.models import Project, Task
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate
from app.services.bus import publish_activity
from app.services.catalog import create_task
from app.services.serialize import to_task

router = APIRouter()


def _load(db: Session, task_id: int) -> Task:
    task = db.scalar(
        select(Task).options(selectinload(Task.bucket), selectinload(Task.project)).where(Task.id == task_id)
    )
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} was not found")
    return task


@router.get("", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db)) -> list[TaskOut]:
    tasks = db.scalars(
        select(Task).options(selectinload(Task.bucket), selectinload(Task.project)).order_by(Task.created_at.desc())
    ).all()
    return [to_task(task) for task in tasks]


@router.post("", response_model=TaskOut, status_code=201)
def post_task(payload: TaskCreate, db: Session = Depends(get_db)) -> TaskOut:
    try:
        task = create_task(
            db,
            title=payload.title,
            notes=payload.notes,
            due_on=payload.due_on,
            priority=payload.priority,
            bucket_id=payload.bucket_id,
            project_id=payload.project_id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    invalidate_dashboard()
    publish_activity("task", f"Added task {task.title}")
    return to_task(_load(db, task.id))


@router.patch("/{task_id}", response_model=TaskOut)
def patch_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)) -> TaskOut:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} was not found")
    changes = payload.model_dump(exclude_unset=True)
    if "project_id" in changes:
        project_id = changes.pop("project_id")
        if project_id is None:
            raise HTTPException(status_code=400, detail="A task must belong to a project")
        project = db.get(Project, project_id)
        if project is None:
            raise HTTPException(status_code=404, detail=f"Project {project_id} was not found")
        task.project_id = project.id
        task.bucket_id = project.bucket_id
    changes.pop("bucket_id", None)
    for field, value in changes.items():
        setattr(task, field, value)
    db.commit()
    invalidate_dashboard()
    publish_activity("task", f"Updated task {task.title}")
    return to_task(_load(db, task.id))


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)) -> Response:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} was not found")
    title = task.title
    db.delete(task)
    db.commit()
    invalidate_dashboard()
    publish_activity("task", f"Removed task {title}")
    return Response(status_code=204)
