from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..auth import create_access_token, verify_password
from ..db import get_db
from ..models import User
from ..schemas import (
    LoginRequest,
    QuickAccessLoginRequest,
    QuickAccessRoleGroup,
    QuickAccessUser,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/quick-access", response_model=list[QuickAccessUser])
def quick_access_users(db: Session = Depends(get_db)) -> list[QuickAccessUser]:
    users = db.scalars(select(User).options(joinedload(User.role)).order_by(User.id)).all()
    return [
        QuickAccessUser(
            id=user.id,
            full_name=user.full_name,
            role_code=user.role.code,
            role_name=user.role.name,
        )
        for user in users
    ]


@router.get("/quick-access-by-role", response_model=list[QuickAccessRoleGroup])
def quick_access_users_by_role(db: Session = Depends(get_db)) -> list[QuickAccessRoleGroup]:
    users = db.scalars(select(User).options(joinedload(User.role)).order_by(User.id)).all()
    groups: dict[str, QuickAccessRoleGroup] = {}
    for user in users:
        code = user.role.code
        if code not in groups:
            groups[code] = QuickAccessRoleGroup(
                role_code=code,
                role_name=user.role.name,
                users=[],
            )
        groups[code].users.append(
            QuickAccessUser(
                id=user.id,
                full_name=user.full_name,
                role_code=user.role.code,
                role_name=user.role.name,
            )
        )
    return list(groups.values())


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).options(joinedload(User.role)).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user_name=user.full_name, role_code=user.role.code)


@router.post("/quick-login", response_model=TokenResponse)
def quick_login(payload: QuickAccessLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).options(joinedload(User.role)).where(User.id == payload.user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user_name=user.full_name, role_code=user.role.code)
