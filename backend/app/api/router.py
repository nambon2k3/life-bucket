from fastapi import APIRouter

from app.api import agent, buckets, dashboard, habits, jobs, journal, projects, system, tasks

api_router = APIRouter()
api_router.include_router(system.router, tags=["system"])
api_router.include_router(dashboard.router, tags=["dashboard"])
api_router.include_router(buckets.router, prefix="/buckets", tags=["buckets"])
api_router.include_router(habits.router, prefix="/habits", tags=["habits"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(journal.router, prefix="/journal", tags=["journal"])
api_router.include_router(agent.router, prefix="/agent", tags=["agent"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
