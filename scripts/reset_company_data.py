# scripts/reset_company_data.py
import asyncio
import os
import sys
from pathlib import Path

# 프로젝트 루트 디렉터리를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete
from backend.app.core.config import get_settings
from backend.app.models.db import (
    init_db,
    get_db,
    ProjectModel,
    CommandModel,
    TaskModel,
    MeetingModel,
    PatentRecordModel,
)


async def reset_all_company_data():
    """가상 회사 OS의 모든 DB 레코드 및 4대 장부 파일을 초기화(Clean State)합니다."""
    settings = get_settings()
    await init_db()

    # 1. SQLite DB 데이터 비우기
    async for session in get_db():
        await session.execute(delete(TaskModel))
        await session.execute(delete(CommandModel))
        await session.execute(delete(MeetingModel))
        await session.execute(delete(PatentRecordModel))
        await session.execute(delete(ProjectModel))
        await session.commit()
        print("[DB] All table records deleted successfully (0 items reset)")
        break

    # 2. 4대 장부(COMPANY_LEDGERS) 파일 비우기
    ledger_dir = settings.LEDGER_DIR
    subfolders = [
        "PROJECTS",
        "COMMAND_LOG",
        "TASK_LEDGER",
        "MEETING_LOG",
        "KNOWLEDGE_PATENT",
    ]

    deleted_files_count = 0
    for folder in subfolders:
        target_path = ledger_dir / folder
        target_path.mkdir(parents=True, exist_ok=True)
        for file in target_path.iterdir():
            if file.is_file():
                try:
                    file.unlink()
                    deleted_files_count += 1
                except Exception as e:
                    print(f"[WARN] Failed to delete file ({file}): {e}")

    print(f"[LEDGERS] Deleted {deleted_files_count} files in COMPANY_LEDGERS")
    print("[SUCCESS] Virtual Company OS clean state ready!")


if __name__ == "__main__":
    asyncio.run(reset_all_company_data())
