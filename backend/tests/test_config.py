# backend/tests/test_config.py
import os
import shutil
from pathlib import Path
from backend.app.core.config import get_settings

def test_settings_load_and_directories_created():
    settings = get_settings()
    assert settings.COMPANY_NAME == "AI VIRTUAL COMPANY OS"
    ledger_path = Path(settings.LEDGER_DIR)
    assert (ledger_path / "PROJECTS").exists()
    assert (ledger_path / "COMMAND_LOG").exists()
    assert (ledger_path / "TASK_LEDGER").exists()
    assert (ledger_path / "MEETING_LOG").exists()
    assert (ledger_path / "KNOWLEDGE_PATENT").exists()
