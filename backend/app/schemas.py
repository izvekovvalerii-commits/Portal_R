from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_name: str
    role_code: str


class LoginRequest(BaseModel):
    email: str
    password: str


class QuickAccessUser(BaseModel):
    id: int
    full_name: str
    role_code: str
    role_name: str


class QuickAccessRoleGroup(BaseModel):
    role_code: str
    role_name: str
    users: list[QuickAccessUser]


class QuickAccessLoginRequest(BaseModel):
    user_id: int


class UserInfo(BaseModel):
    id: int
    full_name: str
    email: str
    avatar_url: Optional[str] = None
    avatar_focus_x: int = 50
    avatar_focus_y: int = 50
    avatar_scale: int = 100
    role_code: str
    role_name: str


class WidgetPreferenceResponse(BaseModel):
    id: int
    widget_key: str
    title: str
    position: int
    size: str
    span: int = 4
    column_key: str = "left"
    is_enabled: bool


class WidgetPreferenceUpdate(BaseModel):
    widget_key: str
    position: int
    is_enabled: bool
    size: str
    span: int = 4
    column_key: str = "left"


class DesktopSettingsResponse(BaseModel):
    density: str
    columns: int
    show_metrics: bool


class DesktopSettingsUpdate(BaseModel):
    density: str
    columns: int
    show_metrics: bool


class WidgetCatalogItem(BaseModel):
    widget_key: str
    title: str
    description: str
    icon: str = ""
    default_size: str
    default_span: int = 4
    position: int = 0


class ActivityMetricResponse(BaseModel):
    key: str
    title: str
    value: str
    trend: str
    updated_at: str


class DashboardResponse(BaseModel):
    user: UserInfo
    widgets: list[WidgetPreferenceResponse]
    metrics: list[ActivityMetricResponse]
    desktop_settings: DesktopSettingsResponse
    widget_catalog: list[WidgetCatalogItem]


# --- Portals ---

class PortalResponse(BaseModel):
    id: int
    title: str
    category: str
    description: str
    status: str
    url: str
    icon: str
    gradient: str
    owner: str
    position: int
    is_favorite: bool = False


class PortalCategoryResponse(BaseModel):
    name: str
    count: int


class PortalListResponse(BaseModel):
    portals: list[PortalResponse]
    categories: list[PortalCategoryResponse]


class PortalFavoriteToggle(BaseModel):
    portal_id: int


# --- Business systems (legacy compat) ---

class BusinessSystemResponse(BaseModel):
    id: int
    title: str
    category: str
    description: str
    status: str
    url: str
    owner: str


# --- Store projects ---

class StoreProjectResponse(BaseModel):
    id: int
    code: str
    city: str
    address: str
    stage: str
    manager: str
    readiness_percent: int
    planned_open_date: str


# --- Construction ---

class ConstructionStageStat(BaseModel):
    stage: str
    count: int


class ConstructionProjectCard(BaseModel):
    id: int = 0
    code: str
    city: str
    manager: str
    stage: str
    readiness_percent: int
    risk: bool = False


class ConstructionAskoResponse(BaseModel):
    system_name: str
    card_title: str
    total_projects: int
    active_projects: int
    on_schedule: int
    at_risk: int
    needs_attention: int
    stages: list[ConstructionStageStat]
    projects_by_stage: dict[str, list[ConstructionProjectCard]]
    action_url: str
    action_label: str


# --- News ---

class PollOptionInput(BaseModel):
    option_text: str


class NewsCreateRequest(BaseModel):
    title: str
    content: str
    kind: str = "event"
    image_url: Optional[str] = None
    options: list[PollOptionInput] = []
    image_placement: str = "top"
    text_layout: str = "below"
    poll_chart_type: str = "bar"


class NewsUpdateRequest(BaseModel):
    title: str
    content: str
    kind: str = "event"
    image_url: Optional[str] = None
    options: list[PollOptionInput] = []
    image_placement: str = "top"
    text_layout: str = "below"
    poll_chart_type: str = "bar"


class NewsPublishResponse(BaseModel):
    id: int
    status: str
    published_at: str


class PollVoteRequest(BaseModel):
    option_id: int


class PollAnalyticsOption(BaseModel):
    option_id: int
    option_text: str
    votes: int
    share_percent: float


class PollAnalyticsResponse(BaseModel):
    total_votes: int
    options: list[PollAnalyticsOption]


class NewsFeedItem(BaseModel):
    id: int
    title: str
    content: str
    kind: str
    status: str
    image_url: Optional[str]
    image_placement: str
    text_layout: str
    poll_chart_type: str
    author_name: str
    created_at: str
    published_at: Optional[str]
    options: list[PollAnalyticsOption]
    total_votes: int
    user_vote_option_id: Optional[int] = None


class NewsImageUploadResponse(BaseModel):
    image_url: str


# --- User profile ---

class UserProfileUpdate(BaseModel):
    full_name: str
    avatar_url: Optional[str] = None
    avatar_focus_x: int = 50
    avatar_focus_y: int = 50
    avatar_scale: int = 100


class UserAvatarUploadResponse(BaseModel):
    avatar_url: str


# --- Calendar ---

class CalendarEventResponse(BaseModel):
    id: int
    date_key: str
    start_slot: str
    duration_slots: int
    title: str


class CalendarEventCreate(BaseModel):
    date_key: str
    start_slot: str
    duration_slots: int = 1
    title: str


# --- User preferences ---

class UserPreferenceResponse(BaseModel):
    key: str
    value: str


class UserPreferenceBulkUpdate(BaseModel):
    preferences: dict[str, str]


# --- Sidebar ---

class SidebarItemResponse(BaseModel):
    key: str
    label: str
    icon: str
    position: int


# --- App config ---

class AppConfigResponse(BaseModel):
    key: str
    value: str
    description: str


# --- Activity feed (computed on backend) ---

class ActivityFeedItem(BaseModel):
    id: str
    type: str
    title: str
    subtitle: str
    source: str
    timestamp: str
    date_key: Optional[str] = None
    icon: str = ""


class ActivityFeedResponse(BaseModel):
    items: list[ActivityFeedItem]
    total: int


class ActivitySummaryResponse(BaseModel):
    days: list[dict]
    max_hours: float
    target_hours: float
    overload_count: int
