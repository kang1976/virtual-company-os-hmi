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
                f"# TASK LEDGER — {project_id}\n\n## 1. 업무 현황 요약표\n\n| ID | 업무명 | 담당 | 우선순위 | 상태 |",
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

            lines.append("\n---\n\n## 2. 부서별 4단계 심층 업무 내역 (상세지시 · 실행계획 · 구현내역 · 검증체크시트)\n")
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
                lines.append(f"### 📌 [{t.get('id')}] {t.get('title')}")
                lines.append(f"- **담당 에이전트**: `{t.get('assignee')}`")
                lines.append(f"- **우선순위 / 상태**: `{t.get('priority')}` / {status_icon} `{t.get('status')}`")
                
                # [Stage 1] COO 상세 지시
                directive = t.get("detailed_directive") or t.get("coo_prompt")
                if directive:
                    lines.append(f"\n#### 📋 [Stage 1] COO 상세 기술 업무 지시서 (Technical Directive Specification)\n{directive}\n")

                # [Stage 2] 에이전트 실행 계획
                plan = t.get("execution_plan")
                if plan:
                    lines.append(f"\n#### 📐 [Stage 2] 에이전트 기술 실행 계획서 (Technical Execution Plan)\n{plan}\n")

                # [Stage 3] 실제 구현 및 변경 내역
                action = t.get("action_log")
                deliverable = t.get("deliverable")
                if action or deliverable:
                    lines.append(f"\n#### 🛠️ [Stage 3] 실제 구현 및 변경 내역 (Implementation & Executed Actions)")
                    if action:
                        lines.append(f"{action}\n")
                    if deliverable:
                        lines.append(f"##### 📦 최종 산출물 (Deliverable):\n```\n{deliverable}\n```\n")

                # [Stage 4] 완료 검증 체크리스트
                checklist = t.get("verification_checklist")
                if checklist:
                    lines.append(f"\n#### 🛡️ [Stage 4] 완료 검증 체크리스트 (Verification & QA Checksheet)\n{checklist}\n")

                lines.append("\n---\n")

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

    async def sync_meeting_log(self, meeting: Dict[str, Any]):
        async with self.lock:
            meet_id = meeting["id"]
            meet_dir = self.settings.LEDGER_DIR / "MEETING_LOG"
            meet_dir.mkdir(parents=True, exist_ok=True)
            md_path = meet_dir / f"{meet_id}.md"
            json_path = meet_dir / f"{meet_id}.json"

            checked_items_str = "\n".join(
                f"- [x] {item}" for item in meeting.get("checked_items", [])
            )
            content = f"""# EXECUTIVE AUDIT MEETING LOG — {meet_id}

- **감사 ID**: {meet_id}
- **프로젝트**: {meeting.get('project_id', '')}
- **주관자**: {meeting.get('chairperson', 'COO')}
- **참석 에이전트**: {meeting.get('attendees', 'COOAgent, PatentSearchAgent, FrontendAgent, BackendAgent, SecurityAgent, QAAgent')}
- **감사 승인 여부**: {"승인 (APPROVED)" if meeting.get('approved', True) else "반려 (REJECTED)"}

## 총괄 품질 종합 감사 요약
{meeting.get('summary', '')}

## 세부 검증 확인 항목
{checked_items_str}

## 후속 지시 및 경영진 총평
{meeting.get('directive', '')}
"""
            async with aiofiles.open(md_path, mode="w", encoding="utf-8") as f:
                await f.write(content)
            async with aiofiles.open(json_path, mode="w", encoding="utf-8") as f:
                await f.write(json.dumps(meeting, ensure_ascii=False, indent=2))

    async def sync_marketing_doc(
        self, project_id: str, catalog: Dict[str, Any], manual: Dict[str, Any]
    ):
        async with self.lock:
            doc_dir = self.settings.LEDGER_DIR / "MARKETING_DOCS"
            doc_dir.mkdir(parents=True, exist_ok=True)

            # 1. 카탈로그 마크다운 & JSON
            cat_md_path = doc_dir / f"{project_id}-catalog.md"
            cat_json_path = doc_dir / f"{project_id}-catalog.json"

            usp_lines = "\n".join(f"- {u}" for u in catalog.get("usp_highlights", []))
            specs = catalog.get("technical_specifications", {})
            if isinstance(specs, dict):
                spec_lines = "\n".join(f"- **{k}**: {v}" for k, v in specs.items())
            else:
                spec_lines = str(specs)

            cat_content = f"""# 📄 B2B 제품 카탈로그 — {catalog.get('catalog_title', project_id)}

- **프로젝트 ID**: {project_id}
- **제품명**: {catalog.get('catalog_title', '')}
- **타깃 시장**: {catalog.get('target_market', '')}

---

## 1. 핵심 차별화 요소 (USP)
{usp_lines}

---

## 2. 주요 기술 규격 및 통신 사양
{spec_lines}

---

## 3. 정량적 도입 효과 및 ROI
{catalog.get('roi_and_benefits', '')}

---

## 4. 고객 배포용 브로슈어 본문
{catalog.get('brochure_markdown', '')}
"""
            async with aiofiles.open(cat_md_path, mode="w", encoding="utf-8") as f:
                await f.write(cat_content)
            async with aiofiles.open(cat_json_path, mode="w", encoding="utf-8") as f:
                await f.write(json.dumps(catalog, ensure_ascii=False, indent=2))

            # 2. 운용 매뉴얼 마크다운 & JSON
            man_md_path = doc_dir / f"{project_id}-manual.md"
            man_json_path = doc_dir / f"{project_id}-manual.json"

            man_content = f"""# 📘 사용자 및 엔지니어 운용 매뉴얼 — {manual.get('manual_title', project_id)}

- **프로젝트 ID**: {project_id}
- **문서명**: {manual.get('manual_title', '')}

---

## 1. 시스템 요구사양
{manual.get('system_requirements', '')}

---

## 2. 빠른 시작 (Quick Start)
{manual.get('quick_start_guide', '')}

---

## 3. 화면별 UI 조작 가이드
{manual.get('ui_operation_guide', '')}

---

## 4. 산업용 PLC 통신 연동 가이드
{manual.get('plc_connection_guide', '')}

---

## 5. 긴급 장애 조치 및 FAQ (Troubleshooting)
{manual.get('troubleshooting_faq', '')}

---

## 6. 운용 지침 전문
{manual.get('manual_markdown', '')}
"""
            async with aiofiles.open(man_md_path, mode="w", encoding="utf-8") as f:
                await f.write(man_content)
            async with aiofiles.open(man_json_path, mode="w", encoding="utf-8") as f:
                await f.write(json.dumps(manual, ensure_ascii=False, indent=2))


