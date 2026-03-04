"""Activity feed and summary — aggregated on backend."""
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..dependencies import get_current_user
from ..models import AppConfig, CalendarEvent, ConstructionProject, NewsItem, StoreProject, User
from ..schemas import ActivityFeedItem, ActivityFeedResponse, ActivitySummaryResponse

router = APIRouter(prefix="/activity", tags=["activity"])


def _get_config_int(db: Session, key: str, default: int) -> int:
    val = db.scalar(select(AppConfig.value).where(AppConfig.key == key))
    try:
        return int(val) if val else default
    except (ValueError, TypeError):
        return default


@router.get("/feed", response_model=ActivityFeedResponse)
def get_activity_feed(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=120, ge=1, le=500),
    source: str = Query(default="all"),
) -> ActivityFeedResponse:
    items: list[ActivityFeedItem] = []
    now_iso = datetime.utcnow().isoformat()

    if source in ("all", "calendar"):
        events = db.scalars(
            select(CalendarEvent)
            .where(CalendarEvent.user_id == current_user.id)
            .order_by(CalendarEvent.date_key.desc(), CalendarEvent.start_slot)
            .limit(limit)
        ).all()
        for ev in events:
            dur_hours = max(1, ev.duration_slots) * 0.5
            items.append(ActivityFeedItem(
                id=f"cal-{ev.id}",
                type="calendar",
                title=ev.title,
                subtitle=f"{ev.start_slot}, {dur_hours:.1g}ч",
                source="calendar",
                timestamp=now_iso,
                date_key=ev.date_key,
                icon="🗓",
            ))

    if source in ("all", "projects"):
        projects = db.scalars(select(StoreProject).order_by(StoreProject.code)).all()
        for p in projects:
            items.append(ActivityFeedItem(
                id=f"proj-{p.id}",
                type="project",
                title=f"{p.code} — {p.city}",
                subtitle=f"{p.stage}, {p.readiness_percent}%",
                source="projects",
                timestamp=now_iso,
                icon="📋",
            ))

    if source in ("all", "construction"):
        c_projects = db.scalars(select(ConstructionProject).order_by(ConstructionProject.code)).all()
        for cp in c_projects:
            risk_label = " ⚠" if cp.risk else ""
            items.append(ActivityFeedItem(
                id=f"constr-{cp.id}",
                type="construction",
                title=f"{cp.code} — {cp.city}{risk_label}",
                subtitle=f"{cp.stage}, {cp.readiness_percent}%",
                source="construction",
                timestamp=now_iso,
                icon="🏗",
            ))

    if source in ("all", "news"):
        news = db.scalars(
            select(NewsItem)
            .where(NewsItem.status == "published")
            .order_by(NewsItem.published_at.desc())
            .limit(20)
        ).all()
        for n in news:
            items.append(ActivityFeedItem(
                id=f"news-{n.id}",
                type="news",
                title=n.title,
                subtitle=n.kind,
                source="news",
                timestamp=n.published_at.isoformat() if n.published_at else now_iso,
                icon="📰",
            ))

    items = items[:limit]
    return ActivityFeedResponse(items=items, total=len(items))


@router.get("/summary", response_model=ActivitySummaryResponse)
def get_activity_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    month: str = Query(default=""),
) -> ActivitySummaryResponse:
    target_hours = float(_get_config_int(db, "activity_target_hours", 6))

    if month:
        year_str, month_str = month.split("-")
        year, mon = int(year_str), int(month_str)
    else:
        now = datetime.utcnow()
        year, mon = now.year, now.month

    from calendar import monthrange
    _, days_in_month = monthrange(year, mon)

    events = db.scalars(
        select(CalendarEvent).where(
            CalendarEvent.user_id == current_user.id,
            CalendarEvent.date_key.like(f"{year:04d}-{mon:02d}-%"),
        )
    ).all()

    hours_by_date: dict[str, float] = {}
    for ev in events:
        hours = max(1, ev.duration_slots) * 0.5
        hours_by_date[ev.date_key] = hours_by_date.get(ev.date_key, 0) + hours

    days = []
    overload_count = 0
    max_hours = 0.0
    for d in range(1, days_in_month + 1):
        date_key = f"{year:04d}-{mon:02d}-{d:02d}"
        dt = datetime(year, mon, d)
        hours = round(hours_by_date.get(date_key, 0), 1)
        if hours > max_hours:
            max_hours = hours
        if hours > target_hours:
            overload_count += 1
        days.append({
            "dateKey": date_key,
            "dayLabel": str(d),
            "weekday": dt.strftime("%a"),
            "hours": hours,
        })

    return ActivitySummaryResponse(
        days=days,
        max_hours=max(max_hours, 1),
        target_hours=target_hours,
        overload_count=overload_count,
    )
