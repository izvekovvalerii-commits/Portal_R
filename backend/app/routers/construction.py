from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..dependencies import get_current_user
from ..models import AppConfig, ConstructionProject, User
from ..schemas import ConstructionAskoResponse, ConstructionProjectCard, ConstructionStageStat

router = APIRouter(prefix="/construction", tags=["construction"])


def _get_config(db: Session, key: str, default: str = "") -> str:
    val = db.scalar(select(AppConfig.value).where(AppConfig.key == key))
    return val if val is not None else default


@router.get("/asko", response_model=ConstructionAskoResponse)
def get_asko_widget(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConstructionAskoResponse:
    projects = db.scalars(select(ConstructionProject).order_by(ConstructionProject.stage, ConstructionProject.code)).all()

    stage_counts = Counter(p.stage for p in projects)
    stages = [ConstructionStageStat(stage=stage, count=count) for stage, count in stage_counts.items()]

    projects_by_stage: dict[str, list[ConstructionProjectCard]] = {}
    for p in projects:
        card = ConstructionProjectCard(
            id=p.id, code=p.code, city=p.city, manager=p.manager,
            stage=p.stage, readiness_percent=p.readiness_percent, risk=p.risk,
        )
        projects_by_stage.setdefault(p.stage, []).append(card)

    total = len(projects)
    at_risk = sum(1 for p in projects if p.risk)

    return ConstructionAskoResponse(
        system_name=_get_config(db, "construction_system_name", "АСКО"),
        card_title=_get_config(db, "construction_card_title", "Карточка объекта"),
        total_projects=total,
        active_projects=total,
        on_schedule=total - at_risk,
        at_risk=at_risk,
        needs_attention=at_risk,
        stages=stages,
        projects_by_stage=projects_by_stage,
        action_url=_get_config(db, "construction_action_url", ""),
        action_label=_get_config(db, "construction_action_label", "Открыть АСКО"),
    )
