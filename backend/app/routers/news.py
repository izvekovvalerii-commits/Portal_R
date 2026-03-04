from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..dependencies import get_current_user, require_roles
from ..db import get_db
from ..models import NewsItem, PollOption, PollResponse, User
from ..schemas import (
    NewsCreateRequest,
    NewsFeedItem,
    NewsImageUploadResponse,
    NewsPublishResponse,
    NewsUpdateRequest,
    PollAnalyticsOption,
    PollAnalyticsResponse,
    PollVoteRequest,
)

router = APIRouter(prefix="/news", tags=["news"])


ALLOWED_IMAGE_PLACEMENTS = {"top", "left", "right"}
ALLOWED_TEXT_LAYOUTS = {"below", "overlay", "compact"}
ALLOWED_POLL_CHARTS = {"bar", "donut", "compact"}


def build_poll_analytics(db: Session, news_id: int) -> PollAnalyticsResponse:
    options = db.scalars(select(PollOption).where(PollOption.news_id == news_id).order_by(PollOption.position)).all()
    vote_rows = db.execute(
        select(PollResponse.option_id, func.count(PollResponse.id)).where(PollResponse.news_id == news_id).group_by(PollResponse.option_id)
    ).all()
    votes_by_option = {row[0]: int(row[1]) for row in vote_rows}
    total_votes = sum(votes_by_option.values())

    option_payload: list[PollAnalyticsOption] = []
    for option in options:
        votes = votes_by_option.get(option.id, 0)
        share = (votes / total_votes * 100) if total_votes else 0.0
        option_payload.append(
            PollAnalyticsOption(
                option_id=option.id,
                option_text=option.option_text,
                votes=votes,
                share_percent=round(share, 2),
            )
        )
    return PollAnalyticsResponse(total_votes=total_votes, options=option_payload)


@router.get("/feed", response_model=list[NewsFeedItem])
def news_feed(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[NewsFeedItem]:
    _ = current_user
    news_items = db.scalars(select(NewsItem).where(NewsItem.status == "published").order_by(NewsItem.published_at.desc())).all()
    users = db.scalars(select(User)).all()
    user_names = {u.id: u.full_name for u in users}

    payload: list[NewsFeedItem] = []
    for item in news_items:
        analytics = build_poll_analytics(db, item.id) if item.kind == "poll" else PollAnalyticsResponse(total_votes=0, options=[])
        my_vote = db.scalar(select(PollResponse.option_id).where(PollResponse.news_id == item.id, PollResponse.user_id == current_user.id))
        payload.append(
            NewsFeedItem(
                id=item.id,
                title=item.title,
                content=item.content,
                kind=item.kind,
                status=item.status,
                image_url=item.image_url,
                image_placement=item.image_placement or "top",
                text_layout=item.text_layout or "below",
                poll_chart_type=item.poll_chart_type or "bar",
                author_name=user_names.get(item.author_id, "Система"),
                created_at=item.created_at.isoformat(),
                published_at=item.published_at.isoformat() if item.published_at else None,
                options=analytics.options,
                total_votes=analytics.total_votes,
                user_vote_option_id=my_vote,
            )
        )
    return payload


@router.post("", response_model=NewsFeedItem)
def create_news(
    payload: NewsCreateRequest,
    current_user: User = Depends(require_roles({"admin"})),
    db: Session = Depends(get_db),
) -> NewsFeedItem:
    if payload.kind not in {"event", "poll"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid news kind")
    if payload.kind == "poll" and len(payload.options) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Poll should have at least 2 options")
    if payload.image_placement not in ALLOWED_IMAGE_PLACEMENTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image placement")
    if payload.text_layout not in ALLOWED_TEXT_LAYOUTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid text layout")
    if payload.poll_chart_type not in ALLOWED_POLL_CHARTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid poll chart type")

    news = NewsItem(
        title=payload.title.strip(),
        content=payload.content.strip(),
        kind=payload.kind,
        status="draft",
        image_url=payload.image_url,
        image_placement=payload.image_placement,
        text_layout=payload.text_layout,
        poll_chart_type=payload.poll_chart_type,
        author_id=current_user.id,
    )
    db.add(news)
    db.flush()

    if payload.kind == "poll":
        for idx, option in enumerate(payload.options):
            db.add(PollOption(news_id=news.id, option_text=option.option_text.strip(), position=idx))

    db.commit()
    db.refresh(news)
    analytics = build_poll_analytics(db, news.id) if news.kind == "poll" else PollAnalyticsResponse(total_votes=0, options=[])
    return NewsFeedItem(
        id=news.id,
        title=news.title,
        content=news.content,
        kind=news.kind,
        status=news.status,
        image_url=news.image_url,
        image_placement=news.image_placement,
        text_layout=news.text_layout,
        poll_chart_type=news.poll_chart_type,
        author_name=current_user.full_name,
        created_at=news.created_at.isoformat(),
        published_at=None,
        options=analytics.options,
        total_votes=analytics.total_votes,
        user_vote_option_id=None,
    )


@router.put("/{news_id}", response_model=NewsFeedItem)
def update_news(
    news_id: int,
    payload: NewsUpdateRequest,
    current_user: User = Depends(require_roles({"admin"})),
    db: Session = Depends(get_db),
) -> NewsFeedItem:
    if payload.kind not in {"event", "poll"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid news kind")
    if payload.kind == "poll" and len(payload.options) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Poll should have at least 2 options")
    if payload.image_placement not in ALLOWED_IMAGE_PLACEMENTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image placement")
    if payload.text_layout not in ALLOWED_TEXT_LAYOUTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid text layout")
    if payload.poll_chart_type not in ALLOWED_POLL_CHARTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid poll chart type")

    news = db.get(NewsItem, news_id)
    if not news:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="News item not found")

    existing_vote_count = db.scalar(select(func.count(PollResponse.id)).where(PollResponse.news_id == news_id)) or 0

    news.title = payload.title.strip()
    news.content = payload.content.strip()
    news.image_url = payload.image_url
    news.image_placement = payload.image_placement
    news.text_layout = payload.text_layout
    news.poll_chart_type = payload.poll_chart_type
    news.kind = payload.kind
    news.author_id = current_user.id

    if payload.kind == "poll":
        existing_options = db.scalars(select(PollOption).where(PollOption.news_id == news_id).order_by(PollOption.position)).all()
        incoming_options = [item.option_text.strip() for item in payload.options if item.option_text.strip()]
        current_options = [item.option_text.strip() for item in existing_options]

        options_changed = incoming_options != current_options
        if options_changed:
            # Published polls should still be editable; if structure changes, reset old voting data.
            if existing_vote_count > 0:
                for response in db.scalars(select(PollResponse).where(PollResponse.news_id == news_id)).all():
                    db.delete(response)
            for option in existing_options:
                db.delete(option)
            db.flush()
            for idx, option_text in enumerate(incoming_options):
                db.add(PollOption(news_id=news_id, option_text=option_text, position=idx))
    else:
        if existing_vote_count > 0:
            for response in db.scalars(select(PollResponse).where(PollResponse.news_id == news_id)).all():
                db.delete(response)
        for option in db.scalars(select(PollOption).where(PollOption.news_id == news_id)).all():
            db.delete(option)

    db.commit()
    db.refresh(news)
    analytics = build_poll_analytics(db, news.id) if news.kind == "poll" else PollAnalyticsResponse(total_votes=0, options=[])
    return NewsFeedItem(
        id=news.id,
        title=news.title,
        content=news.content,
        kind=news.kind,
        status=news.status,
        image_url=news.image_url,
        image_placement=news.image_placement or "top",
        text_layout=news.text_layout or "below",
        poll_chart_type=news.poll_chart_type or "bar",
        author_name=current_user.full_name,
        created_at=news.created_at.isoformat(),
        published_at=news.published_at.isoformat() if news.published_at else None,
        options=analytics.options,
        total_votes=analytics.total_votes,
        user_vote_option_id=None,
    )


@router.delete("/{news_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_news(
    news_id: int,
    current_user: User = Depends(require_roles({"admin"})),
    db: Session = Depends(get_db),
) -> None:
    _ = current_user
    news = db.get(NewsItem, news_id)
    if not news:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="News item not found")

    for response in db.scalars(select(PollResponse).where(PollResponse.news_id == news_id)).all():
        db.delete(response)
    for option in db.scalars(select(PollOption).where(PollOption.news_id == news_id)).all():
        db.delete(option)
    db.delete(news)
    db.commit()


@router.post("/{news_id}/publish", response_model=NewsPublishResponse)
def publish_news(
    news_id: int,
    current_user: User = Depends(require_roles({"admin"})),
    db: Session = Depends(get_db),
) -> NewsPublishResponse:
    _ = current_user
    news = db.get(NewsItem, news_id)
    if not news:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="News item not found")
    if news.status == "published":
        return NewsPublishResponse(id=news.id, status=news.status, published_at=news.published_at.isoformat())

    news.status = "published"
    news.published_at = datetime.now(timezone.utc)
    db.commit()
    return NewsPublishResponse(id=news.id, status=news.status, published_at=news.published_at.isoformat())


@router.post("/{news_id}/vote", response_model=PollAnalyticsResponse)
def vote_poll(
    news_id: int,
    payload: PollVoteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PollAnalyticsResponse:
    news = db.get(NewsItem, news_id)
    if not news or news.status != "published" or news.kind != "poll":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll is not available")

    option = db.get(PollOption, payload.option_id)
    if not option or option.news_id != news_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid poll option")

    existing_vote = db.scalar(select(PollResponse).where(PollResponse.news_id == news_id, PollResponse.user_id == current_user.id))
    if existing_vote:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already voted in this poll")

    db.add(PollResponse(news_id=news_id, option_id=payload.option_id, user_id=current_user.id))
    db.commit()
    return build_poll_analytics(db, news_id)


@router.get("/{news_id}/analytics", response_model=PollAnalyticsResponse)
def poll_analytics(news_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PollAnalyticsResponse:
    _ = current_user
    news = db.get(NewsItem, news_id)
    if not news or news.kind != "poll" or news.status != "published":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll is not available")
    return build_poll_analytics(db, news_id)


@router.post("/upload-image", response_model=NewsImageUploadResponse)
def upload_news_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles({"admin"})),
) -> NewsImageUploadResponse:
    _ = current_user
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image files are allowed")

    suffix = Path(file.filename or "image.jpg").suffix or ".jpg"
    file_name = f"{uuid4().hex}{suffix}"
    target_dir = Path(__file__).resolve().parent.parent.parent / "uploads" / "news"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / file_name
    data = file.file.read()
    target_path.write_bytes(data)

    return NewsImageUploadResponse(image_url=f"{settings.backend_public_base_url}/uploads/news/{file_name}")
