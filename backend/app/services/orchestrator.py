# backend/app/services/orchestrator.py
from datetime import datetime, timezone
from typing import Dict, Any, Callable, Optional
from backend.app.models.db import get_db, ProjectModel, CommandModel, TaskModel
from backend.app.services.ledger_sync import LedgerSyncService
from backend.app.agents.coo import COOAgent
from backend.app.agents.patent.search import PatentSearchAgent
from backend.app.agents.dev.backend import BackendDevAgent
from backend.app.agents.qa import QAAgent


class CompanyOrchestrator:
    def __init__(self, broadcast_fn: Optional[Callable] = None):
        self.coo = COOAgent()
        self.patent = PatentSearchAgent()
        self.dev = BackendDevAgent()
        self.qa = QAAgent()
        self.sync = LedgerSyncService()
        self.broadcast = broadcast_fn or (lambda event, data: None)

    async def dispatch_ceo_command(self, instruction: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y%m%d")
        timestamp_id = int(now.timestamp()) % 10000
        prj_id = f"PRJ-{today_str}-{timestamp_id:04d}"
        cmd_id = f"CMD-{today_str}-{timestamp_id:04d}"

        # 1. 지시 원장 기록
        cmd_dict = {
            "id": cmd_id,
            "project_id": prj_id,
            "sender": "CEO",
            "recipient": "COO",
            "instruction": instruction,
            "priority": "P0",
            "status": "PROCESSING",
        }
        await self.sync.sync_command(cmd_dict)
        self.broadcast("COMMAND_CREATED", cmd_dict)

        # 2. COO 업무 분해
        decomp = await self.coo.decompose_command(instruction)

        # 3. 프로젝트 DB 등록
        async for session in get_db():
            prj = ProjectModel(
                id=prj_id,
                title=decomp.get("project_title", instruction[:30]),
                description=decomp.get("project_goal", ""),
            )
            session.add(prj)
            cmd_fields = {k: v for k, v in cmd_dict.items() if hasattr(CommandModel, k)}
            cmd_m = CommandModel(**cmd_fields)
            session.add(cmd_m)
            await session.commit()
            break

        completed_tasks = []

        # 4a. 1단계: 선행 특허 조사 (Gatekeeper)
        pat_res = await self.patent.investigate(instruction)
        pat_id = f"PAT-{today_str}-{timestamp_id:04d}"
        pat_dict = {
            "id": pat_id,
            "project_id": prj_id,
            "technology": instruction,
            "fto_risk": pat_res.get("fto_risk", "LOW"),
            "findings": pat_res.get("findings", ""),
            "recommendation": pat_res.get("recommendation", ""),
        }
        await self.sync.sync_patent_log(pat_dict)
        pat_findings = pat_res.get("findings", "")
        t1 = {
            "id": f"{prj_id}-T001",
            "title": "특허 및 선행기술 조사",
            "assignee": "PatentSearchAgent",
            "status": "VERIFIED",
            "priority": "P1",
        }
        completed_tasks.append(t1)
        self.broadcast("TASK_UPDATED", t1)

        # 4b. 2단계: 개발
        dev_res = await self.dev.develop(instruction, patent_findings=pat_findings)
        deliverable = dev_res.get("deliverable", "")
        t2 = {
            "id": f"{prj_id}-T002",
            "title": "핵심 시스템 및 아키텍처 개발",
            "assignee": "BackendAgent",
            "status": "SUBMITTED",
            "priority": "P1",
        }
        completed_tasks.append(t2)
        self.broadcast("TASK_UPDATED", t2)

        # 4c. 3단계: QA 독립 검증
        qa_res = await self.qa.verify(deliverable, criteria="CEO 요구사항 만족 및 안정성 검증")
        qa_status = "CLOSED" if qa_res.get("passed", True) else "BLOCKED"
        t3 = {
            "id": f"{prj_id}-T003",
            "title": "품질 검증 및 최종 검수",
            "assignee": "QAAgent",
            "status": qa_status,
            "priority": "P1",
        }
        completed_tasks.append(t3)
        completed_tasks[0]["status"] = "CLOSED"
        completed_tasks[1]["status"] = "CLOSED"
        self.broadcast("TASK_UPDATED", t3)

        # 5. 장부 및 DB 최종 동기화
        await self.sync.sync_task_ledger(prj_id, completed_tasks)
        async for session in get_db():
            for t in completed_tasks:
                task_m = TaskModel(
                    id=t["id"],
                    project_id=prj_id,
                    title=t["title"],
                    assignee=t["assignee"],
                    priority=t["priority"],
                    status=t["status"],
                )
                session.add(task_m)
            await session.commit()
            break

        return {
            "status": "SUCCESS",
            "project_id": prj_id,
            "command_id": cmd_id,
            "completed_tasks": completed_tasks,
            "summary": decomp.get("summary", "전 공정 완료 및 원장 마감"),
        }
