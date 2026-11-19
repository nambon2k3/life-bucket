from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.journal import JournalEvent
from app.schemas.journal import JournalEventCreate, JournalEventOut, JournalEventUpdate
from app.services.bus import publish_activity

router = APIRouter()


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return start, end


def _load(db: Session, event_id: int) -> JournalEvent:
    event = db.get(JournalEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Journal event {event_id} was not found")
    return event


def _ordered(db: Session, start: date, end: date) -> list[JournalEvent]:
    return list(
        db.scalars(
            select(JournalEvent)
            .where(JournalEvent.entry_on >= start, JournalEvent.entry_on < end)
            .order_by(JournalEvent.entry_on, JournalEvent.at_time.asc().nulls_last(), JournalEvent.id)
        ).all()
    )


@router.get("", response_model=list[JournalEventOut])
def list_events(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
) -> list[JournalEvent]:
    if (year is None) != (month is None):
        raise HTTPException(status_code=400, detail="Pass both year and month, or neither")
    if year is None or month is None:
        return list(
            db.scalars(
                select(JournalEvent).order_by(
                    JournalEvent.entry_on.desc(),
                    JournalEvent.at_time.asc().nulls_last(),
                    JournalEvent.id,
                )
            ).all()
        )
    start, end = _month_bounds(year, month)
    return _ordered(db, start, end)


@router.post("", response_model=JournalEventOut, status_code=201)
def post_event(payload: JournalEventCreate, db: Session = Depends(get_db)) -> JournalEvent:
    event = JournalEvent(
        entry_on=payload.entry_on,
        at_time=payload.at_time,
        title=payload.title.strip(),
        note=payload.note.strip(),
        tag=payload.tag.strip(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    publish_activity("journal", f"Recorded {event.title}")
    return event


@router.patch("/{event_id}", response_model=JournalEventOut)
def patch_event(event_id: int, payload: JournalEventUpdate, db: Session = Depends(get_db)) -> JournalEvent:
    event = _load(db, event_id)
    changes = payload.model_dump(exclude_unset=True)
    if "title" in changes and changes["title"] is not None:
        event.title = changes["title"].strip()
    if "note" in changes and changes["note"] is not None:
        event.note = changes["note"].strip()
    if "tag" in changes and changes["tag"] is not None:
        event.tag = changes["tag"].strip()
    if "entry_on" in changes and changes["entry_on"] is not None:
        event.entry_on = changes["entry_on"]
    if "at_time" in changes:
        event.at_time = changes["at_time"]
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)) -> Response:
    event = _load(db, event_id)
    title = event.title
    db.delete(event)
    db.commit()
    publish_activity("journal", f"Removed journal event {title}")
    return Response(status_code=204)
