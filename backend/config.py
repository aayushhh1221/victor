"""PATHWISE — Application configuration."""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field
from .models.enums import DataMode


BASE_DIR = Path(__file__).parent


class Settings(BaseSettings):
    """PATHWISE runtime configuration via environment variables."""

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

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def ensure_dirs(self) -> None:
        """Create all required data directories."""
        for d in [self.DATA_DIR, self.CACHE_DIR, self.RAW_DIR,
                  self.TILES_DIR, self.DEMO_DIR]:
            d.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
