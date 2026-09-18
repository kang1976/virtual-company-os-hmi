# backend/app/api/system.py
from fastapi import APIRouter
from sqlalchemy import delete
from backend.app.core.config import get_settings
from backend.app.models.db import (
    get_db,
    ProjectModel,
    CommandModel,
    TaskModel,
    MeetingModel,
    PatentRecordModel,
)

router = APIRouter(prefix="/api/system", tags=["System"])


@router.post("/reset")
async def reset_system_data():
    """CEO 명령 데이터 및 4대 장부 초기화 (0건 클린 리셋)"""
    settings = get_settings()

    # 1. DB 초기화
    async for session in get_db():
        await session.execute(delete(TaskModel))
        await session.execute(delete(CommandModel))
        await session.execute(delete(MeetingModel))
        await session.execute(delete(PatentRecordModel))
        await session.execute(delete(ProjectModel))
        await session.commit()
        break

    # 2. 4대 장부 파일 초기화
    subfolders = [
        "PROJECTS",
        "COMMAND_LOG",
        "TASK_LEDGER",
        "MEETING_LOG",
        "KNOWLEDGE_PATENT",
    ]
    deleted_count = 0
    for folder in subfolders:
        folder_path = settings.LEDGER_DIR / folder
        folder_path.mkdir(parents=True, exist_ok=True)
        for f in folder_path.iterdir():
            if f.is_file():
                try:
                    f.unlink()
                    deleted_count += 1
                except Exception:
                    pass

    return {
        "status": "SUCCESS",
        "message": "가상회사 전사 데이터 및 4대 장부가 깨끗하게 초기화되었습니다 (0건 리셋).",
        "deleted_files": deleted_count,
    }
