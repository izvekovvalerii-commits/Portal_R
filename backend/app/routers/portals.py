from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..dependencies import get_current_user
from ..models import Portal, PortalFavorite, User
from ..schemas import (
    PortalCategoryResponse,
    PortalFavoriteToggle,
    PortalListResponse,
    PortalResponse,
)

router = APIRouter(prefix="/portals", tags=["portals"])


@router.get("", response_model=PortalListResponse)
def list_portals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PortalListResponse:
    portals = db.scalars(
        select(Portal).where(Portal.is_active == True).order_by(Portal.position)  # noqa: E712
    ).all()

    fav_ids = set(
        db.scalars(
            select(PortalFavorite.portal_id).where(PortalFavorite.user_id == current_user.id)
        ).all()
    )

    category_counts = Counter(p.category for p in portals)
    categories = [PortalCategoryResponse(name="Все", count=len(portals))]
    for name in sorted(category_counts):
        categories.append(PortalCategoryResponse(name=name, count=category_counts[name]))

    return PortalListResponse(
        portals=[
            PortalResponse(
                id=p.id,
                title=p.title,
                category=p.category,
                description=p.description,
                status=p.status,
                url=p.url,
                icon=p.icon,
                gradient=p.gradient,
                owner=p.owner,
                position=p.position,
                is_favorite=p.id in fav_ids,
            )
            for p in portals
        ],
        categories=categories,
    )


@router.post("/favorite", response_model=dict)
def toggle_favorite(
    payload: PortalFavoriteToggle,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    existing = db.scalar(
        select(PortalFavorite).where(
            PortalFavorite.user_id == current_user.id,
            PortalFavorite.portal_id == payload.portal_id,
        )
    )
    if existing:
        db.delete(existing)
        db.commit()
        return {"status": "removed"}

    db.add(PortalFavorite(user_id=current_user.id, portal_id=payload.portal_id))
    db.commit()
    return {"status": "added"}
