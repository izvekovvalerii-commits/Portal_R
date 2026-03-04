from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_PATH), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Platform Razvitiya API"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 240
    database_url: str = "postgresql+psycopg2://platform:platform@localhost:5432/platform_dev"
    frontend_origin: str = "http://localhost:5190"
    backend_public_base_url: str = "http://localhost:8005"
    cors_extra_origins: str = ""

    @property
    def cors_origins(self) -> list[str]:
        origins = [self.frontend_origin]
        if self.cors_extra_origins:
            origins.extend(o.strip() for o in self.cors_extra_origins.split(",") if o.strip())
        for port in ("5190", "5191", "5192"):
            for host in ("localhost", "127.0.0.1"):
                candidate = f"http://{host}:{port}"
                if candidate not in origins:
                    origins.append(candidate)
        return origins


settings = Settings()
