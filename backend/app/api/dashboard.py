from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.dashboard import DashboardOut
from app.services.dashboard import get_dashboard

router = APIRouter()


@router.get("/dashboard", response_model=DashboardOut)
def read_dashboard(db: Session = Depends(get_db)) -> DashboardOut:
    return get_dashboard(db)
