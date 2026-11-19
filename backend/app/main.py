import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.cache import invalidate_dashboard
from app.core.config import get_settings
from app.core.database import (
    engine,
    ensure_journal_columns,
    ensure_project_columns,
    ensure_task_project_required,
    session_scope,
    wait_for_database,
)
from app.models import Base
from app.services.catalog import assign_orphan_tasks
from app.services.seed import backfill_scope, seed_if_empty

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    wait_for_database()
    Base.metadata.create_all(bind=engine)
    ensure_project_columns()
    ensure_journal_columns()
    with session_scope() as db:
        seed_if_empty(db)
        backfill_scope(db)
        assign_orphan_tasks(db)
    ensure_task_project_required()
    invalidate_dashboard()
    logger.info("Life Buckets API is ready")
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Life Buckets", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix="/api/v1")

    @app.get("/")
    def root() -> dict[str, str]:
        return {"service": "life-buckets", "docs": "/docs"}

    return app


app = create_app()
