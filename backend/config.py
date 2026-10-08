"""VICTOR — Application configuration."""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field
from .models.enums import DataMode


BASE_DIR = Path(__file__).parent


class Settings(BaseSettings):
    """VICTOR runtime configuration via environment variables."""

    # Data directories
    DATA_DIR: Path = BASE_DIR / "data"
    CACHE_DIR: Path = BASE_DIR / "data" / "cache"
    RAW_DIR: Path = BASE_DIR / "data" / "raw"
    TILES_DIR: Path = BASE_DIR / "data" / "tiles"
    DEMO_DIR: Path = BASE_DIR / "data" / "demo"

    # Data mode — VERIFIED_SNAPSHOT is primary (real pre-downloaded NASA data)
    DATA_MODE: DataMode = DataMode.VERIFIED_SNAPSHOT

    # AI (optional, not required for core computation)
    GEMINI_API_KEY: str = ""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS. FRONTEND_URL is the primary origin; ALLOWED_ORIGINS accepts a
    # comma-separated list for additional ones (preview deployments, a custom
    # domain). Localhost is always permitted so local development keeps working
    # against a deployed backend.
    FRONTEND_URL: str = "http://localhost:3000"
    ALLOWED_ORIGINS: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def cors_origins(self) -> list[str]:
        """Resolved list of permitted browser origins, de-duplicated."""
        origins = [
            self.FRONTEND_URL,
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
        origins += [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        seen: set[str] = set()
        return [o for o in origins if o and not (o in seen or seen.add(o))]

    def ensure_dirs(self) -> None:
        """Create all required data directories."""
        for d in [self.DATA_DIR, self.CACHE_DIR, self.RAW_DIR,
                  self.TILES_DIR, self.DEMO_DIR]:
            d.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
