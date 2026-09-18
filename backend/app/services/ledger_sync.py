# backend/app/services/ledger_sync.py
import asyncio
import json
from pathlib import Path
from typing import Any, Dict, List
import aiofiles
from backend.app.core.config import get_settings


class LedgerSyncService:
    """4대 장부(COMPANY_LEDGERS) 파일 동기화 서비스

    Command, Task, Patent 기록을 Markdown 및 JSON 파일로 원자적(Lock 기반) 동기화 저장합니다.
    """

    def __init__(self):
        self.settings = get_settings()
        self.lock = asyncio.Lock()

    async def sync_command(self, cmd: Dict[str, Any]):
        async with self.lock:
            cmd_id = cmd["id"]
            cmd_dir = self.settings.LEDGER_DIR / "COMMAND_LOG"
            cmd_dir.mkdir(parents=True, exist_ok=True)
            md_path = cmd_dir / f"{cmd_id}.md"
            json_path = cmd_dir / f"{cmd_id}.json"

            md_content = f"""# COMMAND LOG — {cmd_id}

- **Command ID**: {cmd_id}
- **Project**: {cmd.get('project_id', 'N/A')}
- **지시자**: {cmd.get('sender', 'CEO')}
- **수신자**: {cmd.get('recipient', 'COO')}
- **우선순위**: {cmd.get('priority', 'P1')}
- **지시시간**: {cmd.get('created_at', '2026-09-18')}

## 업무 지시 내용
{cmd.get('instruction', '')}

## 상태
{cmd.get('status', 'RECORDED')}
"""
            async with aiofiles.open(md_path, mode="w", encoding="utf-8") as f:
                await f.write(md_content)
            async with aiofiles.open(json_path, mode="w", encoding="utf-8") as f:
                await f.write(json.dumps(cmd, ensure_ascii=False, indent=2))

    async def sync_task_ledger(self, project_id: str, tasks: List[Dict[str, Any]]):
        async with self.lock:
            task_dir = self.settings.LEDGER_DIR / "TASK_LEDGER"
            task_dir.mkdir(parents=True, exist_ok=True)
            task_path = task_dir / f"{project_id}-tasks.json"
            md_path = task_dir / f"{project_id}-tasks.md"

            async with aiofiles.open(task_path, mode="w", encoding="utf-8") as f:
                await f.write(json.dumps(tasks, ensure_ascii=False, indent=2))

            lines = [
                f"# TASK LEDGER — {project_id}\n\n| ID | 업무명 | 담당 | 우선순위 | 상태 |",
                "|---|---|---|---|---|",
            ]
            for t in tasks:
                status_icon = {
                    "IDLE": "⚪",
                    "WORKING": "🔵",
                    "SUBMITTED": "🟡",
                    "REVIEW": "🟣",
                    "VERIFIED": "🟢",
                    "CLOSED": "☑️",
                    "BLOCKED": "🔴",
                }.get(t.get("status"), "⚪")
                lines.append(
                    f"| {t.get('id')} | {t.get('title')} | {t.get('assignee')} | {t.get('priority')} | {status_icon} {t.get('status')} |"
                )

            async with aiofiles.open(md_path, mode="w", encoding="utf-8") as f:
                await f.write("\n".join(lines) + "\n")

    async def sync_patent_log(self, patent: Dict[str, Any]):
        async with self.lock:
            pat_id = patent["id"]
            pat_dir = self.settings.LEDGER_DIR / "KNOWLEDGE_PATENT"
            pat_dir.mkdir(parents=True, exist_ok=True)
            md_path = pat_dir / f"{pat_id}.md"
            content = f"""# PATENT INTELLIGENCE REPORT — {pat_id}

- **조사 ID**: {pat_id}
- **프로젝트**: {patent.get('project_id', '')}
- **조사 대상 기술**: {patent.get('technology', '')}
- **검색 국가**: {patent.get('search_scope', 'KR/US/EP')}
- **FTO 침해 위험도**: {patent.get('fto_risk', 'LOW')}

## 선행 특허 및 상세 분석
{patent.get('findings', '')}

## 개발팀 권고사항
{patent.get('recommendation', '기존 특허 청구항 범위를 회피하여 독자 설계 진행할 것.')}
"""
            async with aiofiles.open(md_path, mode="w", encoding="utf-8") as f:
                await f.write(content)
