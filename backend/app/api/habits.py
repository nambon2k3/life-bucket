from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.cache import invalidate_dashboard
from app.core.database import get_db
from app.models import Habit
from app.schemas.habit import HabitCreate, HabitOut
from app.services.bus import publish_activity
from app.services.catalog import create_habit, record_checkin, remove_checkin
from app.services.serialize import to_habit

router = APIRouter()


def _load(db: Session, habit_id: int) -> Habit:
    habit = db.scalar(
        select(Habit)
        .options(selectinload(Habit.bucket), selectinload(Habit.checkins))
        .where(Habit.id == habit_id)
    )
    if habit is None:
        raise HTTPException(status_code=404, detail=f"Habit {habit_id} was not found")
    return habit


@router.get("", response_model=list[HabitOut])
def list_habits(db: Session = Depends(get_db)) -> list[HabitOut]:
    today = date.today()
    habits = db.scalars(
        select(Habit)
        .options(selectinload(Habit.bucket), selectinload(Habit.checkins))
        .where(Habit.archived.is_(False))
        .order_by(Habit.id)
    ).all()
    return [to_habit(habit, today) for habit in habits]


@router.post("", response_model=HabitOut, status_code=201)
def post_habit(payload: HabitCreate, db: Session = Depends(get_db)) -> HabitOut:
    try:
        habit = create_habit(db, payload.bucket_id, payload.name, payload.description, payload.frequency)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    invalidate_dashboard()
    publish_activity("habit", f"Added habit {habit.name}")
    return to_habit(_load(db, habit.id), date.today())


@router.post("/{habit_id}/checkins", response_model=HabitOut)
def check_in(habit_id: int, db: Session = Depends(get_db)) -> HabitOut:
    try:
        habit = record_checkin(db, habit_id, date.today())
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    name = habit.name
    db.commit()
    invalidate_dashboard()
    publish_activity("checkin", f"{name} checked in")
    return to_habit(_load(db, habit_id), date.today())


@router.delete("/{habit_id}/checkins/today", response_model=HabitOut)
def uncheck_today(habit_id: int, db: Session = Depends(get_db)) -> HabitOut:
    try:
        habit = remove_checkin(db, habit_id, date.today())
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    name = habit.name
    db.commit()
    invalidate_dashboard()
    publish_activity("checkin", f"{name} unchecked")
    return to_habit(_load(db, habit_id), date.today())
