from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def ensure_project_columns() -> None:
    """create_all does not alter an existing table. Scope arrived after the first boot."""

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT ''"))
        connection.execute(text("ALTER TABLE projects ALTER COLUMN overview TYPE TEXT"))


def ensure_journal_columns() -> None:
    """create_all does not alter an existing table. Tags arrived with the journal list."""

    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE journal_events ADD COLUMN IF NOT EXISTS tag VARCHAR(40) NOT NULL DEFAULT ''")
        )


def ensure_task_project_required() -> None:
    """Tasks always belong to a project. Existing rows are filled before this runs."""

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE tasks ALTER COLUMN project_id SET NOT NULL"))


def wait_for_database(attempts: int = 30, delay_seconds: float = 1.0) -> None:
    """Block startup until Postgres accepts connections.

    Compose starts the API as soon as the database container is healthy, but the
    first connection can still lose the race. A short retry keeps the lesson
    focused on the app instead of on boot order.
    """

    import time

    from sqlalchemy.exc import OperationalError

    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return
        except OperationalError as exc:
            last_error = exc
            time.sleep(delay_seconds)
    raise RuntimeError("Postgres is not reachable") from last_error
