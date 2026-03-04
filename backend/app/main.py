from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session

from .config import settings
from .db import Base, SessionLocal, engine
from .routers import activity, appconfig, auth, calendar, catalog, construction, dashboard, news, portals, preferences, processes, sidebar, users
from .seed import seed_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)


class StaticFilesCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/uploads"):
            origin = request.headers.get("origin", "")
            allowed = settings.cors_origins
            if origin and (origin in allowed or origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:")):
                response.headers["Access-Control-Allow-Origin"] = origin
            else:
                response.headers["Access-Control-Allow-Origin"] = settings.frontend_origin
        return response


app.add_middleware(StaticFilesCORSMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/health")
def health() -> dict:
    db: Session = SessionLocal()
    try:
        db.execute(Base.metadata.tables["roles"].select().limit(1))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        return {"status": "degraded", "database": str(exc)}
    finally:
        db.close()


for router_module in [
    auth, users, dashboard, catalog, processes, construction, news,
    calendar, portals, preferences, sidebar, appconfig, activity,
]:
    app.include_router(router_module.router, prefix="/api")
