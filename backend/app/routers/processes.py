from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..dependencies import get_current_user
from ..db import get_db
from ..models import StoreProject, User
from ..schemas import StoreProjectResponse

router = APIRouter(prefix="/processes", tags=["processes"])


@router.get("/store-opening", response_model=list[StoreProjectResponse])
def store_opening_pipeline(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[StoreProjectResponse]:
    _ = current_user
    projects = db.scalars(select(StoreProject).order_by(StoreProject.id)).all()
    return [
        StoreProjectResponse(
            id=p.id,
            code=p.code,
            city=p.city,
            address=p.address,
            stage=p.stage,
            manager=p.manager,
            readiness_percent=p.readiness_percent,
            planned_open_date=p.planned_open_date,
        )
        for p in projects
    ]
