from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..dependencies import get_current_user
from ..models import CalendarEvent, User
from ..schemas import CalendarEventCreate, CalendarEventResponse

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events", response_model=list[CalendarEventResponse])
def list_events(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CalendarEventResponse]:
    q = select(CalendarEvent).where(CalendarEvent.user_id == current_user.id).order_by(CalendarEvent.date_key, CalendarEvent.start_slot)
    if date_from:
        q = q.where(CalendarEvent.date_key >= date_from)
    if date_to:
        q = q.where(CalendarEvent.date_key <= date_to)
    events = db.scalars(q).all()
    return [
        CalendarEventResponse(
            id=e.id,
            date_key=e.date_key,
            start_slot=e.start_slot,
            duration_slots=e.duration_slots,
            title=e.title,
        )
        for e in events
    ]


@router.post("/events", response_model=CalendarEventResponse)
def create_event(
    payload: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CalendarEventResponse:
    event = CalendarEvent(
        user_id=current_user.id,
        date_key=payload.date_key,
        start_slot=payload.start_slot,
        duration_slots=max(1, payload.duration_slots),
        title=payload.title.strip(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return CalendarEventResponse(
        id=event.id,
        date_key=event.date_key,
        start_slot=event.start_slot,
        duration_slots=event.duration_slots,
        title=event.title,
    )


@router.delete("/events/{event_id}")
def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = db.get(CalendarEvent, event_id)
    if not event or event.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    db.delete(event)
    db.commit()
    return {"ok": True}
