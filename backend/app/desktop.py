"""Desktop widget catalog helpers — reads from DB when possible, falls back to seed data."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import WidgetCatalog


def get_widget_catalog(db: Session) -> list[dict]:
    items = db.scalars(select(WidgetCatalog).where(WidgetCatalog.is_active == True).order_by(WidgetCatalog.position)).all()  # noqa: E712
    if items:
        return [
            {
                "widget_key": item.widget_key,
                "title": item.title,
                "description": item.description,
                "icon": item.icon,
                "default_size": item.default_size,
                "default_span": item.default_span,
                "position": item.position,
            }
            for item in items
        ]
    from .seed import WIDGET_CATALOG_SEED
    return WIDGET_CATALOG_SEED


DEFAULT_DENSITY = "comfortable"
DEFAULT_COLUMNS = 3
