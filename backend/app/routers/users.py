from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db

from ..dependencies import get_current_user
from ..models import User
from ..schemas import UserAvatarUploadResponse, UserInfo, UserProfileUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserInfo)
def me(current_user: User = Depends(get_current_user)) -> UserInfo:
    return UserInfo(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        avatar_url=current_user.avatar_url,
        avatar_focus_x=current_user.avatar_focus_x or 50,
        avatar_focus_y=current_user.avatar_focus_y or 50,
        avatar_scale=current_user.avatar_scale or 100,
        role_code=current_user.role.code,
        role_name=current_user.role.name,
    )


@router.put("/me", response_model=UserInfo)
def update_me(
    payload: UserProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserInfo:
    current_user.full_name = payload.full_name.strip()
    current_user.avatar_url = payload.avatar_url
    current_user.avatar_focus_x = max(0, min(100, int(payload.avatar_focus_x)))
    current_user.avatar_focus_y = max(0, min(100, int(payload.avatar_focus_y)))
    current_user.avatar_scale = max(50, min(200, int(payload.avatar_scale)))
    db.commit()
    return UserInfo(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        avatar_url=current_user.avatar_url,
        avatar_focus_x=current_user.avatar_focus_x,
        avatar_focus_y=current_user.avatar_focus_y,
        avatar_scale=current_user.avatar_scale,
        role_code=current_user.role.code,
        role_name=current_user.role.name,
    )


@router.post("/upload-avatar", response_model=UserAvatarUploadResponse)
def upload_avatar(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserAvatarUploadResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image files are allowed")

    suffix = Path(file.filename or "avatar.jpg").suffix or ".jpg"
    file_name = f"{uuid4().hex}{suffix}"
    target_dir = Path(__file__).resolve().parent.parent.parent / "uploads" / "avatars"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / file_name
    target_path.write_bytes(file.file.read())

    current_user.avatar_url = f"{settings.backend_public_base_url}/uploads/avatars/{file_name}"
    db.commit()
    return UserAvatarUploadResponse(avatar_url=current_user.avatar_url)
