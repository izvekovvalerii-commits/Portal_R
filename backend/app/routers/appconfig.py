from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..dependencies import get_current_user
from ..models import AppConfig, User
from ..schemas import AppConfigResponse

router = APIRouter(prefix="/app-config", tags=["config"])


@router.get("", response_model=list[AppConfigResponse])
def list_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AppConfigResponse]:
    items = db.scalars(select(AppConfig).order_by(AppConfig.key)).all()
    return [
        AppConfigResponse(key=item.key, value=item.value, description=item.description)
        for item in items
    ]


@router.get("/{key}", response_model=AppConfigResponse)
def get_config_item(
    key: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AppConfigResponse:
    item = db.scalar(select(AppConfig).where(AppConfig.key == key))
    if not item:
        return AppConfigResponse(key=key, value="", description="")
    return AppConfigResponse(key=item.key, value=item.value, description=item.description)
