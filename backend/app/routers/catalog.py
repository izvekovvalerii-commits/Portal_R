from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..dependencies import get_current_user
from ..db import get_db
from ..models import Portal, User
from ..schemas import BusinessSystemResponse

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/systems", response_model=list[BusinessSystemResponse])
def list_systems(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[BusinessSystemResponse]:
    items = db.scalars(select(Portal).where(Portal.is_active == True).order_by(Portal.position)).all()  # noqa: E712
    return [
        BusinessSystemResponse(
            id=i.id,
            title=i.title,
            category=i.category,
            description=i.description,
            status=i.status,
            url=i.url,
            owner=i.owner,
        )
        for i in items
    ]
