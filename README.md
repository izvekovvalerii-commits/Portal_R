# Платформа развития ТСЧ

Корпоративная платформа для управления процессами открытия и развития торговых точек X5 Group.

## Архитектура

- **Frontend**: React 18 + Vite + @dnd-kit (SPA)
- **Backend**: FastAPI + SQLAlchemy + Pydantic (REST API)
- **Database**: PostgreSQL 16
- **Auth**: JWT (PBKDF2-SHA256 + HS256)

Подробная документация: [docs/architecture.md](docs/architecture.md)

## Быстрый старт

### 1. База данных

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --port 8001 --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Приложение: http://localhost:5190
API: http://localhost:8001/api
Health: http://localhost:8001/health

## Структура проекта

```
terra/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI приложение
│       ├── config.py            # Настройки (env)
│       ├── db.py                # SQLAlchemy engine
│       ├── models.py            # 17 моделей БД
│       ├── schemas.py           # Pydantic-схемы
│       ├── auth.py              # JWT + PBKDF2
│       ├── dependencies.py      # get_current_user, require_roles
│       ├── desktop.py           # Каталог виджетов (из БД)
│       ├── seed.py              # Начальные данные
│       └── routers/
│           ├── auth.py          # Аутентификация
│           ├── users.py         # Профиль и аватар
│           ├── dashboard.py     # Рабочий стол
│           ├── portals.py       # Порталы + избранное
│           ├── construction.py  # АСКО из БД
│           ├── activity.py      # Лента + сводка
│           ├── calendar.py      # События
│           ├── news.py          # Новости и опросы
│           ├── preferences.py   # Настройки пользователя
│           ├── sidebar.py       # Навигация из БД
│           ├── appconfig.py     # Конфигурация из БД
│           ├── catalog.py       # Бизнес-системы (legacy)
│           └── processes.py     # Проекты открытия
├── frontend/
│   └── src/
│       ├── App.jsx              # Основной компонент
│       ├── api.js               # HTTP-клиент
│       ├── styles.css           # Стили + дизайн-токены
│       ├── constants/           # Константы
│       ├── hooks/               # React-хуки (useAuth)
│       └── utils/               # Утилиты (date, widget, image, error)
├── docs/
│   └── architecture.md          # Техническая документация
└── docker-compose.yml           # PostgreSQL
```

## API

| Группа | Эндпоинты | Описание |
|--------|-----------|----------|
| Auth | 3 | Вход, быстрый доступ |
| Users | 3 | Профиль, аватар |
| Dashboard | 4 | Виджеты, настройки |
| Portals | 2 | Каталог, избранное |
| Construction | 1 | АСКО-аналитика |
| Activity | 2 | Лента, сводка загрузки |
| Calendar | 3 | CRUD событий |
| News | 8 | Новости, опросы, голосование |
| Preferences | 2 | Настройки пользователя |
| Sidebar | 1 | Навигация |
| Config | 2 | Конфигурация |
| Health | 1 | Мониторинг |

**Итого: 32 API-эндпоинта, 17 таблиц PostgreSQL**

## Тестовые учётные записи

| Email | Роль |
|-------|------|
| admin@platform.local | Администратор |
| expansion@platform.local | Менеджер развития |
| construction@platform.local | Руководитель стройки |
| property@platform.local | Управляющий недвижимостью |
