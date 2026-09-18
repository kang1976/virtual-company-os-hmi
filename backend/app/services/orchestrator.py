# backend/app/services/orchestrator.py
from datetime import datetime, timezone
from typing import Dict, Any, Callable, Optional
from backend.app.models.db import get_db, ProjectModel, CommandModel, TaskModel
from backend.app.services.ledger_sync import LedgerSyncService
from backend.app.agents.coo import COOAgent
from backend.app.agents.patent.search import PatentSearchAgent
from backend.app.agents.dev.backend import BackendDevAgent
from backend.app.agents.dev.frontend import FrontendDevAgent
from backend.app.agents.security import SecurityAgent
from backend.app.agents.qa import QAAgent


class CompanyOrchestrator:
    def __init__(self, broadcast_fn: Optional[Callable] = None):
        self.coo = COOAgent()
        self.patent = PatentSearchAgent()
        self.frontend = FrontendDevAgent()
        self.dev = BackendDevAgent()
        self.security = SecurityAgent()
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
            "coo_prompt": f"CEO 지시: '{instruction}'에 대한 선행 특허 및 관련 기술을 글로벌 DB(KR/US/EP)에서 전수 검색하고, FTO(자유실시권) 침해 리스크와 특허 회피 설계 방안을 수립하여 보고하라.",
            "deliverable": f"FTO 위험도: {pat_res.get('fto_risk', 'LOW')}\n조사 결과: {pat_findings}\n권고사항: {pat_res.get('recommendation', '특허 회피 설계 준수')}",
        }
        completed_tasks.append(t1)
        self.broadcast("TASK_UPDATED", t1)

        # 4b. 2단계: UI/UX 및 프론트엔드 개발 (FrontendDevAgent)
        front_res = await self.frontend.develop_ui(
            instruction,
            design_guide="모바일 360~430px 반응형 최적화, 3종 테마 지원, WCAG 2.1 AA 준수, 터치 친화적 인터랙션"
        )
        front_deliverable = front_res.get("deliverable", "")
        t2 = {
            "id": f"{prj_id}-T002",
            "title": "UI/UX 디자인 및 반응형 프론트엔드 구현",
            "assignee": "FrontendAgent",
            "status": "SUBMITTED",
            "priority": "P1",
            "coo_prompt": f"CEO 지시: '{instruction}'에 대한 전용 UI/UX 화면을 설계하라. 모바일 360~430px 반응형 최적화, 3종 테마(사이버다크/모던라이트/OLED), WCAG 2.1 AA 접근성 표준을 준수하는 React 컴포넌트를 구현하라.",
            "deliverable": front_deliverable,
        }
        completed_tasks.append(t2)
        self.broadcast("TASK_UPDATED", t2)

        # 4c. 3단계: 핵심 백엔드 시스템 및 API 개발 (BackendDevAgent)
        dev_res = await self.dev.develop(instruction, patent_findings=pat_findings)
        back_deliverable = dev_res.get("deliverable", "")
        t3 = {
            "id": f"{prj_id}-T003",
            "title": "핵심 시스템 아키텍처 및 백엔드 API 개발",
            "assignee": "BackendAgent",
            "status": "SUBMITTED",
            "priority": "P1",
            "coo_prompt": f"CEO 지시: '{instruction}'를 실행하는 백엔드 아키텍처 및 API를 구현하라. 특허조사팀의 FTO 권고사항을 반영하여 독자적 기술 구조를 수립하고 REST/WebSocket 엔드포인트를 완성하라.",
            "deliverable": back_deliverable,
        }
        completed_tasks.append(t3)
        self.broadcast("TASK_UPDATED", t3)

        # 4d. 4단계: 보안 전문 심사 (Security Gatekeeper)
        full_code_deliverable = f"[Frontend UI/UX]:\n{front_deliverable}\n\n[Backend System]:\n{back_deliverable}"
        sec_res = await self.security.audit(full_code_deliverable, tech_stack="FastAPI/React/Tailwind")
        sec_passed = sec_res.get("passed", True)
        sec_status = "VERIFIED" if sec_passed else "BLOCKED"
        t4 = {
            "id": f"{prj_id}-T004",
            "title": "보안성 및 취약점 심사 (OWASP Top 10/CVE)",
            "assignee": "SecurityAgent",
            "status": sec_status,
            "priority": "P1",
            "coo_prompt": f"프론트엔드 및 백엔드 개발 산출물 전체에 대해 OWASP Top 10 취약점, CVE 위험도, 데이터 유출 가능성을 정밀 심사하고 보안 점수 및 기술적 보완책을 제시하라.",
            "deliverable": f"보안 점수: {sec_res.get('security_score', 96)}점 / CVE 위험도: {sec_res.get('cve_risk', 'LOW')}\n감사 피드백: {sec_res.get('audit_feedback', '보안 심사 통과')}",
        }
        completed_tasks.append(t4)
        self.broadcast("TASK_UPDATED", t4)

        # 4e. 5단계: 독립 품질 검증 (QAAgent)
        qa_res = await self.qa.verify(
            full_code_deliverable,
            criteria="CEO 요구사항 만족, 모바일 터치 사용성 및 안정성 검증"
        )
        qa_passed = qa_res.get("passed", True) and sec_passed
        qa_status = "VERIFIED" if qa_passed else "BLOCKED"
        t5 = {
            "id": f"{prj_id}-T005",
            "title": "독립 품질 및 기능 규격 검수",
            "assignee": "QAAgent",
            "status": qa_status,
            "priority": "P1",
            "coo_prompt": f"개발된 시스템 산출물에 대해 CEO의 최초 지시사항 충족 여부, 모바일 터치 사용성, 예외 처리 및 견고성을 제3자 시각에서 엄격하게 품질 검증하라.",
            "deliverable": qa_res.get("feedback", "품질 검증 완료"),
        }
        completed_tasks.append(t5)
        self.broadcast("TASK_UPDATED", t5)

        # 4f. 6단계: COO 최종 종합 품질검수 (COO Final Quality Gate)
        deliverables_summary = {
            "PatentSearchAgent (T001)": f"FTO 위험도: {pat_dict.get('fto_risk')}, 소견: {pat_findings[:100]}",
            "FrontendAgent (T002)": f"컴포넌트: {front_res.get('component_name', 'UI')}, 산출물: {front_deliverable[:100]}",
            "BackendAgent (T003)": f"모듈명: {dev_res.get('module_name', 'System')}, 아키텍처: {dev_res.get('architecture_summary', 'API')[:100]}",
            "SecurityAgent (T004)": f"보안점수: {sec_res.get('security_score', 96)}점, CVE: {sec_res.get('cve_risk', 'LOW')}",
            "QAAgent (T005)": f"품질결과: {'합격' if qa_passed else '불합격'}, 피드백: {qa_res.get('feedback', '완료')[:100]}",
        }
        coo_audit = await self.coo.verify_final_quality(instruction, deliverables_summary)
        coo_approved = coo_audit.get("approved", True) and qa_passed

        # COO 승인 시 전 태스크 최종 종결(CLOSED) 마감
        if coo_approved:
            for t in completed_tasks:
                t["status"] = "CLOSED"
        else:
            for t in completed_tasks:
                if t["status"] not in ["VERIFIED", "CLOSED"]:
                    t["status"] = "BLOCKED"

        # 회의록 원장(MEETING_LOG)에 COO 최종 감사 회의 기록 저장
        meet_id = f"MEET-{today_str}-{timestamp_id:04d}"
        meet_dict = {
            "id": meet_id,
            "project_id": prj_id,
            "chairperson": "COOAgent",
            "approved": coo_approved,
            "summary": coo_audit.get("executive_summary", "전사 산출물 최종 감사 완료"),
            "checked_items": coo_audit.get("checked_items", []),
            "directive": coo_audit.get("directive_feedback", "품질 기준 충족 승인"),
        }
        await self.sync.sync_meeting_log(meet_dict)

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
                    coo_prompt=t.get("coo_prompt"),
                    deliverable=t.get("deliverable"),
                    detailed_directive=t.get("detailed_directive"),
                    execution_plan=t.get("execution_plan"),
                    action_log=t.get("action_log"),
                    verification_checklist=t.get("verification_checklist"),
                )
                session.add(task_m)
            await session.commit()
            break

        return {
            "status": "SUCCESS" if coo_approved else "NEEDS_REVISION",
            "project_id": prj_id,
            "command_id": cmd_id,
            "completed_tasks": completed_tasks,
            "summary": decomp.get("summary", "전 공정 완료 및 원장 마감"),
            "coo_audit": coo_audit,
        }
