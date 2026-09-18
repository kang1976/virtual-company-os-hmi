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


ALLOWED_SUBFOLDERS = {"PROJECTS", "COMMAND_LOG", "TASK_LEDGER", "MEETING_LOG", "KNOWLEDGE_PATENT"}


@router.get("/{subfolder}/{filename}")
async def read_ledger_file(subfolder: str, filename: str):
    if subfolder not in ALLOWED_SUBFOLDERS:
        return {"content": "잘못된 원장 폴더입니다."}
    settings = get_settings()
    base_dir = (settings.LEDGER_DIR / subfolder).resolve()
    file_path = (base_dir / filename).resolve()
    if not file_path.is_relative_to(base_dir):
        return {"content": "접근할 수 없는 경로입니다."}
    if file_path.exists() and file_path.is_file():
        return {"content": file_path.read_text(encoding="utf-8")}
    return {"content": "파일을 찾을 수 없습니다."}
