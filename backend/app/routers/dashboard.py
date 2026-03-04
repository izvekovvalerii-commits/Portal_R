from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..dependencies import get_current_user
from ..db import get_db
from ..desktop import DEFAULT_COLUMNS, DEFAULT_DENSITY, get_widget_catalog
from ..models import ActivityMetric, User, UserDesktopSettings, WidgetPreference
from ..seed import build_default_widgets
from ..schemas import (
    ActivityMetricResponse,
    DashboardResponse,
    DesktopSettingsResponse,
    DesktopSettingsUpdate,
    UserInfo,
    WidgetCatalogItem,
    WidgetPreferenceResponse,
    WidgetPreferenceUpdate,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def ensure_desktop_state(db: Session, user_id: int) -> tuple[UserDesktopSettings, list[WidgetPreference]]:
    settings = db.scalar(select(UserDesktopSettings).where(UserDesktopSettings.user_id == user_id))
    if not settings:
        settings = UserDesktopSettings(user_id=user_id, density=DEFAULT_DENSITY, columns=DEFAULT_COLUMNS, show_metrics=True)
        db.add(settings)

    existing = db.scalars(select(WidgetPreference).where(WidgetPreference.user_id == user_id)).all()
    existing_by_key = {w.widget_key: w for w in existing}
    defaults = build_default_widgets(user_id)
    added = False
    for default_widget in defaults:
        if default_widget.widget_key not in existing_by_key:
            db.add(default_widget)
            added = True

    if added:
        db.flush()
    db.flush()
    widgets = db.scalars(select(WidgetPreference).where(WidgetPreference.user_id == user_id)).all()
    return settings, widgets


@router.get("", response_model=DashboardResponse)
def get_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DashboardResponse:
    user = db.scalar(select(User).options(joinedload(User.role)).where(User.id == current_user.id))
    settings, widgets = ensure_desktop_state(db, current_user.id)
    widgets = sorted(widgets, key=lambda x: x.position)
    metrics = db.scalars(select(ActivityMetric).order_by(ActivityMetric.id)).all()
    catalog = get_widget_catalog(db)

    return DashboardResponse(
        user=UserInfo(
            id=user.id, full_name=user.full_name, email=user.email, avatar_url=user.avatar_url,
            avatar_focus_x=user.avatar_focus_x, avatar_focus_y=user.avatar_focus_y,
            avatar_scale=user.avatar_scale, role_code=user.role.code, role_name=user.role.name,
        ),
        widgets=[
            WidgetPreferenceResponse(
                id=w.id, widget_key=w.widget_key, title=w.title, position=w.position,
                size=w.size, span=getattr(w, "span", 4) or 4,
                column_key=getattr(w, "column_key", "left") or "left", is_enabled=w.is_enabled,
            )
            for w in widgets
        ],
        metrics=[
            ActivityMetricResponse(key=m.key, title=m.title, value=m.value, trend=m.trend, updated_at=m.updated_at.isoformat())
            for m in metrics
        ],
        desktop_settings=DesktopSettingsResponse(density=settings.density, columns=settings.columns, show_metrics=settings.show_metrics),
        widget_catalog=[WidgetCatalogItem(**item) for item in catalog],
    )


@router.put("/widgets", response_model=list[WidgetPreferenceResponse])
def update_widgets(
    updates: list[WidgetPreferenceUpdate], current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[WidgetPreferenceResponse]:
    _, existing = ensure_desktop_state(db, current_user.id)
    by_key = {w.widget_key: w for w in existing}
    for upd in updates:
        if upd.widget_key in by_key:
            w = by_key[upd.widget_key]
            w.position = upd.position
            w.is_enabled = upd.is_enabled
            w.size = upd.size
            w.span = upd.span
            w.column_key = upd.column_key

    db.commit()
    refreshed = db.scalars(
        select(WidgetPreference).where(WidgetPreference.user_id == current_user.id).order_by(WidgetPreference.position)
    ).all()
    return [
        WidgetPreferenceResponse(
            id=w.id, widget_key=w.widget_key, title=w.title, position=w.position,
            size=w.size, span=getattr(w, "span", 4) or 4,
            column_key=getattr(w, "column_key", "left") or "left", is_enabled=w.is_enabled,
        )
        for w in refreshed
    ]


@router.put("/settings", response_model=DesktopSettingsResponse)
def update_settings(
    payload: DesktopSettingsUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> DesktopSettingsResponse:
    settings, _ = ensure_desktop_state(db, current_user.id)
    settings.density = payload.density
    settings.columns = max(2, min(4, payload.columns))
    settings.show_metrics = payload.show_metrics
    db.commit()
    return DesktopSettingsResponse(density=settings.density, columns=settings.columns, show_metrics=settings.show_metrics)


@router.post("/widgets/reset", response_model=list[WidgetPreferenceResponse])
def reset_widgets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[WidgetPreferenceResponse]:
    existing = db.scalars(select(WidgetPreference).where(WidgetPreference.user_id == current_user.id)).all()
    for widget in existing:
        db.delete(widget)

    for default_widget in build_default_widgets(current_user.id):
        db.add(default_widget)

    settings, _ = ensure_desktop_state(db, current_user.id)
    settings.density = DEFAULT_DENSITY
    settings.columns = DEFAULT_COLUMNS
    settings.show_metrics = True
    db.commit()

    refreshed = db.scalars(
        select(WidgetPreference).where(WidgetPreference.user_id == current_user.id).order_by(WidgetPreference.position)
    ).all()
    return [
        WidgetPreferenceResponse(
            id=w.id, widget_key=w.widget_key, title=w.title, position=w.position,
            size=w.size, span=getattr(w, "span", 4) or 4,
            column_key=getattr(w, "column_key", "left") or "left", is_enabled=w.is_enabled,
        )
        for w in refreshed
    ]
