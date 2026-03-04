import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..dependencies import get_current_user
from ..models import User, UserPreference
from ..schemas import UserPreferenceBulkUpdate, UserPreferenceResponse

router = APIRouter(prefix="/user-preferences", tags=["preferences"])


@router.get("", response_model=list[UserPreferenceResponse])
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserPreferenceResponse]:
    prefs = db.scalars(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    ).all()
    return [UserPreferenceResponse(key=p.key, value=p.value) for p in prefs]


@router.put("", response_model=list[UserPreferenceResponse])
def update_preferences(
    payload: UserPreferenceBulkUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserPreferenceResponse]:
    existing = db.scalars(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    ).all()
    existing_map = {p.key: p for p in existing}

    for key, value in payload.preferences.items():
        if key in existing_map:
            existing_map[key].value = value
        else:
            db.add(UserPreference(user_id=current_user.id, key=key, value=value))

    db.commit()

    all_prefs = db.scalars(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    ).all()
    return [UserPreferenceResponse(key=p.key, value=p.value) for p in all_prefs]
