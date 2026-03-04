from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(255))

    users: Mapped[list["User"]] = relationship(back_populates="role")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar_focus_x: Mapped[int] = mapped_column(Integer, default=50)
    avatar_focus_y: Mapped[int] = mapped_column(Integer, default=50)
    avatar_scale: Mapped[int] = mapped_column(Integer, default=100)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    role: Mapped["Role"] = relationship(back_populates="users")
    preferences: Mapped[list["UserPreference"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserPreference(Base):
    """Key-value store for all user preferences (theme, layout, visibility, etc.)."""
    __tablename__ = "user_preferences"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_user_pref_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    key: Mapped[str] = mapped_column(String(100))
    value: Mapped[str] = mapped_column(Text, default="")

    user: Mapped["User"] = relationship(back_populates="preferences")


class WidgetCatalog(Base):
    """Available widgets that can be placed on the desktop."""
    __tablename__ = "widget_catalog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    widget_key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(255), default="")
    icon: Mapped[str] = mapped_column(String(20), default="")
    default_size: Mapped[str] = mapped_column(String(20), default="md")
    default_span: Mapped[int] = mapped_column(Integer, default=4)
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class WidgetPreference(Base):
    __tablename__ = "widget_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    widget_key: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(120))
    position: Mapped[int] = mapped_column(Integer, default=0)
    size: Mapped[str] = mapped_column(String(20), default="md")
    span: Mapped[int] = mapped_column(Integer, default=4)
    column_key: Mapped[str] = mapped_column(String(20), default="left")
    is_enabled: Mapped[bool] = mapped_column(default=True)


class UserDesktopSettings(Base):
    __tablename__ = "user_desktop_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    density: Mapped[str] = mapped_column(String(30), default="comfortable")
    columns: Mapped[int] = mapped_column(Integer, default=3)
    show_metrics: Mapped[bool] = mapped_column(default=True)


class Portal(Base):
    """Portals / business systems available in the platform."""
    __tablename__ = "portals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(40), default="active")
    url: Mapped[str] = mapped_column(String(255), default="")
    icon: Mapped[str] = mapped_column(String(20), default="🔗")
    gradient: Mapped[str] = mapped_column(String(100), default="linear-gradient(135deg,#19a35b,#36b46b)")
    owner: Mapped[str] = mapped_column(String(120), default="")
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PortalFavorite(Base):
    """User's favorite portals."""
    __tablename__ = "portal_favorites"
    __table_args__ = (UniqueConstraint("user_id", "portal_id", name="uq_portal_fav"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    portal_id: Mapped[int] = mapped_column(ForeignKey("portals.id"), index=True)


class ConstructionProject(Base):
    """Construction projects managed via ASKO system."""
    __tablename__ = "construction_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    city: Mapped[str] = mapped_column(String(80))
    manager: Mapped[str] = mapped_column(String(120))
    stage: Mapped[str] = mapped_column(String(80), index=True)
    readiness_percent: Mapped[int] = mapped_column(Integer, default=0)
    risk: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SidebarItem(Base):
    """Navigation sidebar items."""
    __tablename__ = "sidebar_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(80))
    icon: Mapped[str] = mapped_column(String(20), default="")
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AppConfig(Base):
    """Application-level configuration stored in database."""
    __tablename__ = "app_config"
    __table_args__ = (UniqueConstraint("key", name="uq_app_config_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String(100), index=True)
    value: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(String(255), default="")


class StoreProject(Base):
    __tablename__ = "store_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    city: Mapped[str] = mapped_column(String(80))
    address: Mapped[str] = mapped_column(String(180))
    stage: Mapped[str] = mapped_column(String(80), index=True)
    manager: Mapped[str] = mapped_column(String(120))
    readiness_percent: Mapped[int] = mapped_column(Integer, default=0)
    planned_open_date: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ActivityMetric(Base):
    __tablename__ = "activity_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(120))
    value: Mapped[str] = mapped_column(String(80))
    trend: Mapped[str] = mapped_column(String(20))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class NewsItem(Base):
    __tablename__ = "news_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(180))
    content: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(20), default="event", index=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    image_placement: Mapped[str] = mapped_column(String(20), default="top")
    text_layout: Mapped[str] = mapped_column(String(20), default="below")
    poll_chart_type: Mapped[str] = mapped_column(String(20), default="bar")
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class PollOption(Base):
    __tablename__ = "poll_options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    news_id: Mapped[int] = mapped_column(ForeignKey("news_items.id"), index=True)
    option_text: Mapped[str] = mapped_column(String(160))
    position: Mapped[int] = mapped_column(Integer, default=0)


class PollResponse(Base):
    __tablename__ = "poll_responses"
    __table_args__ = (UniqueConstraint("news_id", "user_id", name="uq_poll_news_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    news_id: Mapped[int] = mapped_column(ForeignKey("news_items.id"), index=True)
    option_id: Mapped[int] = mapped_column(ForeignKey("poll_options.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date_key: Mapped[str] = mapped_column(String(10), index=True)
    start_slot: Mapped[str] = mapped_column(String(5))
    duration_slots: Mapped[int] = mapped_column(Integer, default=1)
    title: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
