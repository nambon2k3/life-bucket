from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.cache import invalidate_dashboard
from app.core.database import get_db
from app.models import Bucket, Project, Task
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.services.bus import publish_activity
from app.services.catalog import create_project, delete_project
from app.services.serialize import to_project

router = APIRouter()


def _load(db: Session, project_id: int) -> Project:
    project = db.scalar(
        select(Project)
        .options(selectinload(Project.bucket), selectinload(Project.tasks))
        .where(Project.id == project_id)
    )
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project {project_id} was not found")
    return project


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)) -> list[ProjectOut]:
    projects = db.scalars(
        select(Project).options(selectinload(Project.bucket), selectinload(Project.tasks)).order_by(Project.created_at.desc())
    ).all()
    return [to_project(project) for project in projects]


@router.get("/{project_id}", response_model=ProjectOut)
def read_project(project_id: int, db: Session = Depends(get_db)) -> ProjectOut:
    return to_project(_load(db, project_id))


@router.post("", response_model=ProjectOut, status_code=201)
def post_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> ProjectOut:
    try:
        project = create_project(
            db,
            payload.bucket_id,
            payload.name,
            payload.overview,
            payload.status,
            payload.start_on,
            payload.end_on,
            payload.scope,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    invalidate_dashboard()
    publish_activity("project", f"Added project {project.name}")
    return to_project(_load(db, project.id))


@router.delete("/{project_id}", status_code=204)
def remove_project(project_id: int, db: Session = Depends(get_db)) -> Response:
    try:
        name = delete_project(db, project_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    invalidate_dashboard()
    publish_activity("project", f"Removed project {name}")
    return Response(status_code=204)


@router.patch("/{project_id}", response_model=ProjectOut)
def patch_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)) -> ProjectOut:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project {project_id} was not found")
    for field in ("name", "overview", "scope", "status", "start_on", "end_on"):
        value = getattr(payload, field)
        if value is not None:
            setattr(project, field, value)
    if payload.bucket_id is not None:
        target = db.get(Bucket, payload.bucket_id)
        if target is None:
            raise HTTPException(status_code=404, detail=f"Bucket {payload.bucket_id} was not found")
        project.bucket_id = target.id
        for task in db.scalars(select(Task).where(Task.project_id == project.id)).all():
            task.bucket_id = target.id
    db.commit()
    invalidate_dashboard()
    publish_activity("project", f"Updated project {project.name}")
    return to_project(_load(db, project.id))
