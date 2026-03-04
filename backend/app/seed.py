from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import get_password_hash
from .models import (
    ActivityMetric,
    AppConfig,
    CalendarEvent,
    ConstructionProject,
    NewsItem,
    PollOption,
    PollResponse,
    Portal,
    Role,
    SidebarItem,
    StoreProject,
    User,
    UserDesktopSettings,
    WidgetCatalog,
    WidgetPreference,
)

WIDGET_CATALOG_SEED = [
    {"widget_key": "quick_actions", "title": "Быстрые действия", "description": "Частые операции для ежедневной работы", "icon": "⚡", "default_size": "md", "default_span": 4, "position": 0},
    {"widget_key": "requests", "title": "Мои заявки", "description": "Текущий статус задач и согласований", "icon": "📋", "default_size": "lg", "default_span": 4, "position": 1},
    {"widget_key": "asko", "title": "АСКО", "description": "Строительные проекты и аналитика", "icon": "🏗", "default_size": "md", "default_span": 4, "position": 2},
    {"widget_key": "news", "title": "Новости", "description": "Обновления регламентов и инициатив", "icon": "📰", "default_size": "md", "default_span": 4, "position": 3},
    {"widget_key": "calendar", "title": "Календарь", "description": "План на день и события по слотам", "icon": "🗓", "default_size": "md", "default_span": 4, "position": 4},
    {"widget_key": "activity", "title": "Моя активность", "description": "Загрузка по дням из календаря", "icon": "📊", "default_size": "md", "default_span": 4, "position": 5},
    {"widget_key": "activity_feed", "title": "Лента активностей", "description": "Все активности по проектам", "icon": "📡", "default_size": "md", "default_span": 4, "position": 6},
    {"widget_key": "notes", "title": "Заметки", "description": "Быстрые персональные записи", "icon": "📝", "default_size": "md", "default_span": 4, "position": 7},
    {"widget_key": "services", "title": "Сервисы", "description": "Статус связанных систем и сервисов", "icon": "🔧", "default_size": "md", "default_span": 4, "position": 8},
]

SIDEBAR_ITEMS_SEED = [
    {"key": "desktop", "label": "Рабочий стол", "icon": "⌂", "position": 0},
    {"key": "portals", "label": "Порталы", "icon": "◫", "position": 1},
    {"key": "construction", "label": "Стройка", "icon": "◧", "position": 2},
    {"key": "tasks", "label": "Задачи", "icon": "✓", "position": 3},
    {"key": "analytics", "label": "Аналитика", "icon": "◔", "position": 4},
]

PORTALS_SEED = [
    {"title": "Платформа развития ТСЧ", "category": "Проекты", "description": "Единый контур управления процессами открытия магазинов", "status": "active", "url": "https://platform.local/systems/dev-platform", "icon": "🏢", "gradient": "linear-gradient(135deg,#19a35b,#36b46b)", "owner": "Офис развития", "position": 0},
    {"title": "Портал по взаимодействию с Росреестром", "category": "Документы", "description": "Регистрация договоров и юридически значимых действий", "status": "active", "url": "https://platform.local/systems/rosreestr", "icon": "📜", "gradient": "linear-gradient(135deg,#2f73ff,#1f67f1)", "owner": "Юридический департамент", "position": 1},
    {"title": "Портал ИК ТСБ", "category": "Финансы", "description": "Бюджетирование, отчетность и инвестиционная аналитика", "status": "active", "url": "https://platform.local/systems/invest", "icon": "💰", "gradient": "linear-gradient(135deg,#ff9800,#f57c00)", "owner": "Финансы", "position": 2},
    {"title": "X5 Nova Partner", "category": "Партнерство", "description": "Регистрация поставщиков и управление партнерскими кабинетами", "status": "active", "url": "https://platform.local/systems/partners", "icon": "🤝", "gradient": "linear-gradient(135deg,#af5bff,#9640f0)", "owner": "Коммерческий блок", "position": 3},
    {"title": "ДизайнТ", "category": "Дизайн", "description": "Дизайн-шаблоны, бренд-материалы и оформление карточек объектов", "status": "active", "url": "https://platform.local/systems/designt", "icon": "🎨", "gradient": "linear-gradient(135deg,#e91e63,#c2185b)", "owner": "Дирекция форматов", "position": 4},
    {"title": "База Знаний", "category": "Документы", "description": "Методические материалы и регламенты по запуску магазинов", "status": "active", "url": "https://platform.local/systems/knowledge-base", "icon": "📚", "gradient": "linear-gradient(135deg,#00bcd4,#0097a7)", "owner": "Центр экспертизы", "position": 5},
    {"title": "IT Поддержка", "category": "Сервисы", "description": "Заявки и консультации по ИТ-инфраструктуре и доступам", "status": "active", "url": "https://platform.local/systems/it-support", "icon": "🖥", "gradient": "linear-gradient(135deg,#607d8b,#455a64)", "owner": "ИТ-служба", "position": 6},
    {"title": "Аренда в Пятёрочке", "category": "Недвижимость", "description": "Подбор, согласование и ведение арендных объектов Пятёрочки", "status": "active", "url": "https://platform.local/systems/pyaterochka-rent", "icon": "🏪", "gradient": "linear-gradient(135deg,#f44336,#d32f2f)", "owner": "Блок недвижимости", "position": 7},
    {"title": "Франчайзинг Пятёрочка", "category": "Партнерство", "description": "Работа с франчайзи и запуск франчайзинговых магазинов", "status": "active", "url": "https://platform.local/systems/pyaterochka-franchise", "icon": "🏬", "gradient": "linear-gradient(135deg,#ff5722,#e64a19)", "owner": "Команда франчайзинга", "position": 8},
    {"title": "Портал аренды Чижик", "category": "Недвижимость", "description": "Арендные процессы и объекты формата Чижик", "status": "active", "url": "https://platform.local/systems/chizhik-rent", "icon": "🐦", "gradient": "linear-gradient(135deg,#ffb22d,#f9a825)", "owner": "Команда формата Чижик", "position": 9},
    {"title": "Поиск и оценка", "category": "Аналитика", "description": "Оценка локаций и потенциала трафика для новых магазинов", "status": "active", "url": "https://platform.local/systems/location-search", "icon": "🔍", "gradient": "linear-gradient(135deg,#4caf50,#388e3c)", "owner": "Аналитика развития", "position": 10},
    {"title": "Проектирование", "category": "Проекты", "description": "Проектные решения, чертежи и согласование планировок", "status": "active", "url": "https://platform.local/systems/design-planning", "icon": "📐", "gradient": "linear-gradient(135deg,#9c27b0,#7b1fa2)", "owner": "Проектный офис", "position": 11},
    {"title": "Управление проектами", "category": "Проекты", "description": "Контроль сроков, задач и этапов открытия объектов", "status": "active", "url": "https://platform.local/systems/project-management", "icon": "📅", "gradient": "linear-gradient(135deg,#3f51b5,#303f9f)", "owner": "Офис управления проектами", "position": 12},
    {"title": "Партнеры", "category": "Партнерство", "description": "Взаимодействие с подрядчиками и внешними партнерами", "status": "active", "url": "https://platform.local/systems/partners-hub", "icon": "🏭", "gradient": "linear-gradient(135deg,#795548,#5d4037)", "owner": "Коммерческий блок", "position": 13},
    {"title": "Лицензирование", "category": "Документы", "description": "Учет лицензий, разрешений и контроль сроков продления", "status": "active", "url": "https://platform.local/systems/licensing", "icon": "📄", "gradient": "linear-gradient(135deg,#009688,#00796b)", "owner": "Юридический департамент", "position": 14},
]

CONSTRUCTION_PROJECTS_SEED = [
    {"code": "MSK-312", "city": "Москва", "manager": "А. Лавров", "stage": "Аудит", "readiness_percent": 20, "risk": False},
    {"code": "KZN-154", "city": "Казань", "manager": "И. Демидов", "stage": "Аудит", "readiness_percent": 18, "risk": False},
    {"code": "EKB-098", "city": "Екатеринбург", "manager": "М. Трошина", "stage": "Аудит", "readiness_percent": 25, "risk": True},
    {"code": "SPB-221", "city": "Санкт-Петербург", "manager": "А. Блинова", "stage": "Бюджет", "readiness_percent": 38, "risk": False},
    {"code": "RND-067", "city": "Ростов-на-Дону", "manager": "А. Лавров", "stage": "Бюджет", "readiness_percent": 35, "risk": False},
    {"code": "NNV-140", "city": "Нижний Новгород", "manager": "И. Демидов", "stage": "ИК", "readiness_percent": 52, "risk": False},
    {"code": "VLG-209", "city": "Волгоград", "manager": "А. Блинова", "stage": "ИК", "readiness_percent": 57, "risk": False},
    {"code": "SMR-133", "city": "Самара", "manager": "А. Лавров", "stage": "ИК", "readiness_percent": 49, "risk": True},
    {"code": "TUL-081", "city": "Тула", "manager": "И. Демидов", "stage": "ИК", "readiness_percent": 55, "risk": False},
    {"code": "YAR-072", "city": "Ярославль", "manager": "М. Трошина", "stage": "Подряд", "readiness_percent": 63, "risk": False},
    {"code": "KRD-117", "city": "Краснодар", "manager": "А. Блинова", "stage": "Подряд", "readiness_percent": 61, "risk": True},
    {"code": "UFA-205", "city": "Уфа", "manager": "И. Демидов", "stage": "РСР", "readiness_percent": 74, "risk": False},
    {"code": "PER-041", "city": "Пермь", "manager": "А. Лавров", "stage": "РСР", "readiness_percent": 79, "risk": False},
    {"code": "TMN-055", "city": "Тюмень", "manager": "М. Трошина", "stage": "РСР", "readiness_percent": 76, "risk": False},
    {"code": "OMS-188", "city": "Омск", "manager": "И. Демидов", "stage": "РСР", "readiness_percent": 72, "risk": True},
    {"code": "CHB-039", "city": "Чебоксары", "manager": "А. Блинова", "stage": "РСР", "readiness_percent": 81, "risk": False},
    {"code": "NOV-090", "city": "Новосибирск", "manager": "И. Демидов", "stage": "ВПК", "readiness_percent": 86, "risk": False},
    {"code": "TYV-121", "city": "Тверь", "manager": "А. Лавров", "stage": "ВПК", "readiness_percent": 88, "risk": False},
    {"code": "IZH-064", "city": "Ижевск", "manager": "М. Трошина", "stage": "ВПК", "readiness_percent": 84, "risk": True},
    {"code": "KLG-017", "city": "Калуга", "manager": "А. Блинова", "stage": "Открытие", "readiness_percent": 96, "risk": False},
]

APP_CONFIG_SEED = [
    {"key": "construction_system_name", "value": "АСКО", "description": "Название системы стройки"},
    {"key": "construction_card_title", "value": "Карточка объекта", "description": "Заголовок карточки стройки"},
    {"key": "construction_action_url", "value": "https://platform.local/systems/asko", "description": "URL кнопки АСКО"},
    {"key": "construction_action_label", "value": "Открыть АСКО", "description": "Текст кнопки АСКО"},
    {"key": "activity_target_hours", "value": "6", "description": "Целевая загрузка часов в день"},
    {"key": "calendar_slot_start_hour", "value": "8", "description": "Начало рабочего дня (час)"},
    {"key": "calendar_slot_end_hour", "value": "21", "description": "Конец рабочего дня (час)"},
    {"key": "logo_url", "value": "https://www.x5.ru/wp-content/uploads/2025/10/x5_mainlogo_color.svg", "description": "URL логотипа"},
    {"key": "platform_name", "value": "Платформа развития", "description": "Название платформы"},
    {"key": "default_density", "value": "comfortable", "description": "Плотность рабочего стола"},
    {"key": "default_columns", "value": "3", "description": "Кол-во колонок рабочего стола"},
]

CALENDAR_EVENTS_FEB_2026 = [
    {"date_key": "2026-02-02", "start_slot": "09:00", "duration_slots": 2, "title": "Старт недели: планёрка"},
    {"date_key": "2026-02-02", "start_slot": "14:00", "duration_slots": 1, "title": "Созвон с регионом"},
    {"date_key": "2026-02-03", "start_slot": "10:00", "duration_slots": 2, "title": "Ревью заявок на объекты"},
    {"date_key": "2026-02-04", "start_slot": "09:00", "duration_slots": 1, "title": "Проверка KZN-117"},
    {"date_key": "2026-02-04", "start_slot": "11:00", "duration_slots": 2, "title": "Согласование с подрядчиком"},
    {"date_key": "2026-02-05", "start_slot": "09:30", "duration_slots": 2, "title": "Weekly standup"},
    {"date_key": "2026-02-05", "start_slot": "14:00", "duration_slots": 1, "title": "Интервью кандидата"},
    {"date_key": "2026-02-09", "start_slot": "09:00", "duration_slots": 2, "title": "Совещание по MSK-241"},
    {"date_key": "2026-02-09", "start_slot": "14:00", "duration_slots": 1, "title": "Согласование аренды"},
    {"date_key": "2026-02-10", "start_slot": "10:00", "duration_slots": 2, "title": "Ревью проектов стройки"},
    {"date_key": "2026-02-10", "start_slot": "15:30", "duration_slots": 1, "title": "Звонок с подрядчиком"},
    {"date_key": "2026-02-11", "start_slot": "09:00", "duration_slots": 1, "title": "Планёрка отдела развития"},
    {"date_key": "2026-02-11", "start_slot": "11:00", "duration_slots": 3, "title": "Выезд на объект SPB-084"},
    {"date_key": "2026-02-12", "start_slot": "09:00", "duration_slots": 2, "title": "Демо нового модуля Карьера"},
    {"date_key": "2026-02-12", "start_slot": "12:00", "duration_slots": 1, "title": "Обед с командой"},
    {"date_key": "2026-02-12", "start_slot": "14:00", "duration_slots": 2, "title": "Обучение по регламенту командировок"},
    {"date_key": "2026-02-13", "start_slot": "10:00", "duration_slots": 1, "title": "Согласование бюджета KZN-117"},
    {"date_key": "2026-02-13", "start_slot": "14:00", "duration_slots": 2, "title": "Подготовка отчёта за месяц"},
    {"date_key": "2026-02-16", "start_slot": "09:30", "duration_slots": 2, "title": "Weekly standup"},
    {"date_key": "2026-02-16", "start_slot": "13:00", "duration_slots": 1, "title": "Интервью кандидата"},
    {"date_key": "2026-02-17", "start_slot": "09:00", "duration_slots": 2, "title": "Совещание по открытию MSK-241"},
    {"date_key": "2026-02-17", "start_slot": "14:00", "duration_slots": 1, "title": "Согласование аренды"},
    {"date_key": "2026-02-18", "start_slot": "10:00", "duration_slots": 2, "title": "Ревью проектов стройки"},
    {"date_key": "2026-02-18", "start_slot": "15:30", "duration_slots": 1, "title": "Звонок с подрядчиком"},
    {"date_key": "2026-02-19", "start_slot": "09:00", "duration_slots": 1, "title": "Планёрка отдела развития"},
    {"date_key": "2026-02-19", "start_slot": "11:00", "duration_slots": 3, "title": "Выезд на объект SPB-084"},
    {"date_key": "2026-02-20", "start_slot": "09:00", "duration_slots": 2, "title": "Демо нового модуля Карьера"},
    {"date_key": "2026-02-20", "start_slot": "12:00", "duration_slots": 1, "title": "Обед с командой"},
    {"date_key": "2026-02-20", "start_slot": "14:00", "duration_slots": 2, "title": "Обучение по регламенту командировок"},
    {"date_key": "2026-02-21", "start_slot": "10:00", "duration_slots": 1, "title": "Согласование бюджета KZN-117"},
    {"date_key": "2026-02-21", "start_slot": "14:00", "duration_slots": 2, "title": "Подготовка отчёта за месяц"},
    {"date_key": "2026-02-24", "start_slot": "09:30", "duration_slots": 2, "title": "Weekly standup"},
    {"date_key": "2026-02-24", "start_slot": "13:00", "duration_slots": 1, "title": "Интервью кандидата"},
    {"date_key": "2026-02-25", "start_slot": "11:00", "duration_slots": 2, "title": "Презентация для руководства"},
    {"date_key": "2026-02-26", "start_slot": "09:00", "duration_slots": 1, "title": "Проверка чек-листа NNV-038"},
    {"date_key": "2026-02-26", "start_slot": "15:00", "duration_slots": 2, "title": "Ретро команды"},
    {"date_key": "2026-02-27", "start_slot": "10:00", "duration_slots": 2, "title": "Итоги месяца"},
    {"date_key": "2026-02-27", "start_slot": "14:00", "duration_slots": 1, "title": "Планирование марта"},
    {"date_key": "2026-02-28", "start_slot": "09:00", "duration_slots": 2, "title": "Совещание по кварталу"},
]

CALENDAR_EVENTS_EXTRA = [
    {"date_key": "2026-03-02", "start_slot": "10:00", "duration_slots": 2, "title": "Планирование квартала"},
    {"date_key": "2026-03-03", "start_slot": "14:00", "duration_slots": 1, "title": "Созвон с регионом"},
    {"date_key": "2026-03-05", "start_slot": "09:00", "duration_slots": 3, "title": "Конференция по развитию"},
]

ROLES_SEED = [
    {"code": "admin", "name": "Администратор", "description": "Полный доступ ко всем сервисам"},
    {"code": "expansion_manager", "name": "Менеджер развития", "description": "Поиск и запуск объектов"},
    {"code": "construction_manager", "name": "Руководитель стройки", "description": "Контроль строительства"},
    {"code": "property_manager", "name": "Управляющий недвижимостью", "description": "Эксплуатация и аренда"},
]

USERS_SEED = [
    {"full_name": "Андрей", "email": "admin@platform.local", "password": "admin123", "role_code": "admin"},
    {"full_name": "Анна Блинова", "email": "expansion@platform.local", "password": "expansion123", "role_code": "expansion_manager"},
    {"full_name": "Иван Демидов", "email": "construction@platform.local", "password": "construction123", "role_code": "construction_manager"},
    {"full_name": "Мария Трошина", "email": "property@platform.local", "password": "property123", "role_code": "property_manager"},
]


def build_default_widgets(user_id: int) -> list[WidgetPreference]:
    catalog_items = WIDGET_CATALOG_SEED
    return [
        WidgetPreference(
            user_id=user_id,
            widget_key=item["widget_key"],
            title=item["title"],
            position=item["position"],
            size=item["default_size"],
            span=item.get("default_span", 4),
            column_key="left",
            is_enabled=True,
        )
        for item in catalog_items
    ]


def ensure_base_data(db: Session) -> None:
    if db.scalar(select(Role.id).limit(1)):
        return

    roles = [Role(**r) for r in ROLES_SEED]
    db.add_all(roles)
    db.flush()
    roles_map = {r.code: r for r in roles}

    users = []
    for u in USERS_SEED:
        users.append(User(
            full_name=u["full_name"],
            email=u["email"],
            hashed_password=get_password_hash(u["password"]),
            role_id=roles_map[u["role_code"]].id,
        ))
    db.add_all(users)
    db.flush()

    for user in users:
        db.add_all(build_default_widgets(user.id))
        db.add(UserDesktopSettings(user_id=user.id, density="comfortable", columns=3, show_metrics=True))

    db.add_all([ActivityMetric(**m) for m in [
        {"key": "openings_month", "title": "Открытия в месяц", "value": "18", "trend": "+12%"},
        {"key": "cycle_time", "title": "Средний цикл", "value": "124 дня", "trend": "-5%"},
        {"key": "capex", "title": "CAPEX на объект", "value": "31.2 млн", "trend": "-2%"},
        {"key": "sla", "title": "SLA согласований", "value": "96.4%", "trend": "+1.8%"},
    ]])

    db.add_all([StoreProject(**p) for p in [
        {"code": "MSK-241", "city": "Москва", "address": "Варшавское шоссе, 112", "stage": "Поиск объекта", "manager": "Анна Блинова", "readiness_percent": 22, "planned_open_date": "2026-06-20"},
        {"code": "SPB-084", "city": "Санкт-Петербург", "address": "Лиговский проспект, 65", "stage": "Строительство объекта", "manager": "Иван Демидов", "readiness_percent": 64, "planned_open_date": "2026-05-14"},
        {"code": "KZN-117", "city": "Казань", "address": "ул. Чистопольская, 18", "stage": "Запуск объекта", "manager": "Анна Блинова", "readiness_percent": 89, "planned_open_date": "2026-03-28"},
        {"code": "NNV-038", "city": "Нижний Новгород", "address": "пр-т Гагарина, 77", "stage": "Управление недвижимостью", "manager": "Мария Трошина", "readiness_percent": 100, "planned_open_date": "2025-10-11"},
    ]])

    db.commit()


def ensure_widget_catalog(db: Session) -> None:
    existing_keys = set(db.scalars(select(WidgetCatalog.widget_key)).all())
    missing = [item for item in WIDGET_CATALOG_SEED if item["widget_key"] not in existing_keys]
    if missing:
        db.add_all([WidgetCatalog(**item) for item in missing])
        db.commit()


def ensure_sidebar_items(db: Session) -> None:
    existing_keys = set(db.scalars(select(SidebarItem.key)).all())
    missing = [item for item in SIDEBAR_ITEMS_SEED if item["key"] not in existing_keys]
    if missing:
        db.add_all([SidebarItem(**item) for item in missing])
        db.commit()


def ensure_portals(db: Session) -> None:
    existing_titles = set(db.scalars(select(Portal.title)).all())
    missing = [item for item in PORTALS_SEED if item["title"] not in existing_titles]
    if missing:
        db.add_all([Portal(**item) for item in missing])
        db.commit()


def ensure_construction_projects(db: Session) -> None:
    existing_codes = set(db.scalars(select(ConstructionProject.code)).all())
    missing = [item for item in CONSTRUCTION_PROJECTS_SEED if item["code"] not in existing_codes]
    if missing:
        db.add_all([ConstructionProject(**item) for item in missing])
        db.commit()


def ensure_app_config(db: Session) -> None:
    existing_keys = set(db.scalars(select(AppConfig.key)).all())
    missing = [item for item in APP_CONFIG_SEED if item["key"] not in existing_keys]
    if missing:
        db.add_all([AppConfig(**item) for item in missing])
        db.commit()


def ensure_news_seed(db: Session) -> None:
    if db.scalar(select(NewsItem.id).limit(1)):
        return

    admin = db.scalar(select(User).where(User.email == "admin@platform.local"))
    if not admin:
        return

    published_at = datetime.utcnow() - timedelta(days=2)
    event_news = [
        NewsItem(title="Запуск нового модуля Карьера в портале развития", content="В production выведен обновленный модуль Карьера. Добавлены карточки вакансий и интеграция с HR-контуром.", kind="event", status="published", author_id=admin.id, image_placement="top", text_layout="below", poll_chart_type="bar", published_at=published_at),
        NewsItem(title="Актуализирован регламент по командировкам проектных команд", content="Обновлены лимиты и сроки согласования для выездов на этапах строительства и запуска объектов.", kind="event", status="published", author_id=admin.id, image_placement="left", text_layout="compact", poll_chart_type="bar", published_at=published_at + timedelta(hours=6)),
    ]
    db.add_all(event_news)
    db.flush()

    poll_1 = NewsItem(title="Опрос: как улучшить процесс запуска объектов?", content="Выберите направление, которое даст наибольший эффект в ближайший квартал.", kind="poll", status="published", author_id=admin.id, image_placement="right", text_layout="below", poll_chart_type="donut", published_at=published_at + timedelta(hours=12))
    poll_2 = NewsItem(title="Опрос: предпочитаемый формат еженедельной отчетности", content="Нужен выбор формата, который будет самым удобным для команд в регионах.", kind="poll", status="published", author_id=admin.id, image_placement="top", text_layout="compact", poll_chart_type="compact", published_at=published_at + timedelta(hours=18))
    db.add_all([poll_1, poll_2])
    db.flush()

    poll_1_options = [
        PollOption(news_id=poll_1.id, option_text="Ускорить согласование аренды", position=0),
        PollOption(news_id=poll_1.id, option_text="Сократить сроки строй-контроля", position=1),
        PollOption(news_id=poll_1.id, option_text="Автоматизировать чек-листы запуска", position=2),
    ]
    poll_2_options = [
        PollOption(news_id=poll_2.id, option_text="Короткий weekly dashboard", position=0),
        PollOption(news_id=poll_2.id, option_text="Подробный отчет 1 раз в 2 недели", position=1),
        PollOption(news_id=poll_2.id, option_text="Комбинированный формат", position=2),
    ]
    db.add_all(poll_1_options + poll_2_options)
    db.flush()

    users_sorted = sorted(db.scalars(select(User)).all(), key=lambda u: u.id)
    if len(users_sorted) >= 4:
        db.add_all([
            PollResponse(news_id=poll_1.id, option_id=poll_1_options[0].id, user_id=users_sorted[0].id),
            PollResponse(news_id=poll_1.id, option_id=poll_1_options[2].id, user_id=users_sorted[1].id),
            PollResponse(news_id=poll_1.id, option_id=poll_1_options[2].id, user_id=users_sorted[2].id),
            PollResponse(news_id=poll_1.id, option_id=poll_1_options[1].id, user_id=users_sorted[3].id),
            PollResponse(news_id=poll_2.id, option_id=poll_2_options[0].id, user_id=users_sorted[0].id),
            PollResponse(news_id=poll_2.id, option_id=poll_2_options[2].id, user_id=users_sorted[1].id),
            PollResponse(news_id=poll_2.id, option_id=poll_2_options[2].id, user_id=users_sorted[2].id),
        ])
    db.commit()


def ensure_calendar_seed(db: Session) -> None:
    if db.scalar(select(CalendarEvent.id).limit(1)):
        return

    admin = db.scalar(select(User).where(User.email == "admin@platform.local"))
    if not admin:
        return

    all_events = CALENDAR_EVENTS_FEB_2026 + CALENDAR_EVENTS_EXTRA
    db.add_all([CalendarEvent(user_id=admin.id, **e) for e in all_events])
    db.commit()


def ensure_admin_name_fix(db: Session) -> None:
    """Обновить имя администратора, если в базе осталось старое значение."""
    admin = db.scalar(select(User).where(User.email == "admin@platform.local"))
    if admin and admin.full_name == "Косинов Андрей":
        admin.full_name = "Андрей"
        db.commit()


def seed_data(db: Session) -> None:
    ensure_base_data(db)
    ensure_admin_name_fix(db)
    ensure_widget_catalog(db)
    ensure_sidebar_items(db)
    ensure_portals(db)
    ensure_construction_projects(db)
    ensure_app_config(db)
    ensure_news_seed(db)
    ensure_calendar_seed(db)
