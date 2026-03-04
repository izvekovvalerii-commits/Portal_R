from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..dependencies import get_current_user
from ..models import SidebarItem, User
from ..schemas import SidebarItemResponse

router = APIRouter(prefix="/sidebar", tags=["sidebar"])


@router.get("", response_model=list[SidebarItemResponse])
def list_sidebar_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SidebarItemResponse]:
    items = db.scalars(
        select(SidebarItem).where(SidebarItem.is_active == True).order_by(SidebarItem.position)  # noqa: E712
    ).all()
    return [
        SidebarItemResponse(key=item.key, label=item.label, icon=item.icon, position=item.position)
        for item in items
    ]
