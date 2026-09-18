# backend/app/api/ledgers.py
from pathlib import Path
from fastapi import APIRouter
from backend.app.core.config import get_settings

router = APIRouter(prefix="/api/ledgers", tags=["ledgers"])


@router.get("")
async def get_ledger_tree():
    settings = get_settings()
    tree = {}
    for sub in ["PROJECTS", "COMMAND_LOG", "TASK_LEDGER", "MEETING_LOG", "KNOWLEDGE_PATENT"]:
        sub_path = settings.LEDGER_DIR / sub
        if sub_path.exists():
            tree[sub] = [f.name for f in sub_path.glob("*") if f.is_file()]
        else:
            tree[sub] = []
    return tree


@router.get("/{subfolder}/{filename}")
async def read_ledger_file(subfolder: str, filename: str):
    settings = get_settings()
    file_path = settings.LEDGER_DIR / subfolder / filename
    if file_path.exists() and file_path.is_file():
        return {"content": file_path.read_text(encoding="utf-8")}
    return {"content": "파일을 찾을 수 없습니다."}
