# backend/app/core/config.py
import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    COMPANY_NAME: str = "AI VIRTUAL COMPANY OS"
    CEO_NAME: str = "KANG SEUNG HEON"
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    ROOT_DIR: Path = BASE_DIR.parent
    LEDGER_DIR: Path = ROOT_DIR / "COMPANY_LEDGERS"
    DATA_DIR: Path = BASE_DIR / "data"
    SQLITE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR}/data/virtual_company.db"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    DEFAULT_PROVIDER: str = "gemini"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

def ensure_directories(settings: Settings):
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    for sub in ["PROJECTS", "COMMAND_LOG", "TASK_LEDGER", "MEETING_LOG", "KNOWLEDGE_PATENT"]:
        (settings.LEDGER_DIR / sub).mkdir(parents=True, exist_ok=True)

_settings = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
        ensure_directories(_settings)
    return _settings
