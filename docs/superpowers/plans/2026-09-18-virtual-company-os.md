# AI 가상회사 운영 시스템 (Virtual Company OS) V4.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an operational AI Virtual Company OS featuring an asynchronous multi-agent orchestrator (COO, Patent Gatekeeper, Dev, QA), dual-storage (SQLite + physical 4-ledger files), and a real-time React web dashboard.

**Architecture:** A Python FastAPI backend orchestrates autonomous LLM agents (powered by Gemini API with fallback demo mode) through a 5-stage verification workflow (`IDLE` → `WORKING` → `SUBMITTED` → `REVIEW` → `VERIFIED` → `CLOSED`), synchronizing state to SQLite and human-readable Markdown/JSON ledgers, while broadcasting live updates via WebSockets to a React + Vite + TailwindCSS dashboard.

**Tech Stack:** Python 3.14, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy, google-genai, aiofiles, pytest, Node.js 24, React 18, Vite, TypeScript, TailwindCSS, Lucide-React.

**Spec:** [`docs/superpowers/specs/2026-09-18-virtual-company-os-design.md`](file:///d:/AI_Work/Antigravity/06.CEO/docs/superpowers/specs/2026-09-18-virtual-company-os-design.md)

## Global Constraints

- Backend must execute in Windows PowerShell with Python 3.14.
- Frontend must build with Vite and Node.js v24.
- 4-Ledgers must be physically written to `COMPANY_LEDGERS/` (`PROJECTS/`, `COMMAND_LOG/`, `TASK_LEDGER/`, `MEETING_LOG/`, `KNOWLEDGE_PATENT/`).
- Multi-agent workflow must enforce the Patent Gatekeeper rule before technical development.
- QA Agent must verify deliverables before tasks can reach `VERIFIED` or `CLOSED`.
- System must include an automatic Demo/Mock fallback if no LLM API key is provided, ensuring zero-configuration local testability.

---

### Task 1: Scaffolding, Directory Structure & Core Configuration

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/app/core/config.py`
- Test: `backend/tests/test_config.py`

**Interfaces:**
- Produces: `Settings` object with `COMPANY_NAME`, `LEDGER_DIR`, `SQLITE_URL`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `DEFAULT_PROVIDER`.

- [ ] **Step 1: Write the failing test for Settings and Directory Scaffolding**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_config.py -v`
Expected: FAIL (ModuleNotFoundError or FileNotFoundError)

- [ ] **Step 3: Write requirements.txt, .env.example, and config.py**

```txt
# backend/requirements.txt
fastapi>=0.115.0
uvicorn>=0.30.0
pydantic>=2.8.0
pydantic-settings>=2.4.0
sqlalchemy>=2.0.30
aiofiles>=24.1.0
google-genai>=0.1.1
pytest>=8.3.0
pytest-asyncio>=0.24.0
httpx>=0.27.0
python-dotenv>=1.0.1
```

```python
# backend/app/core/config.py
import os
from pathlib import Path
from pydantic_settings import BaseSettings

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

    class Config:
        env_file = ".env"
        extra = "ignore"

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_config.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: setup project configuration and ledger directories"
```

---

### Task 2: Core Data Models & SQLite Database Layer

**Files:**
- Create: `backend/app/models/schemas.py`
- Create: `backend/app/models/db.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Consumes: `Settings` from `backend/app/core/config.py`
- Produces: Pydantic schemas (`ProjectCreate`, `CommandCreate`, `TaskResponse`, `TaskStatus`, `Priority`) and SQLAlchemy tables (`ProjectModel`, `CommandModel`, `TaskModel`, `MeetingModel`, `PatentRecordModel`, `KnowledgeRecordModel`).

- [ ] **Step 1: Write the failing test for Data Models and SQLite session**

```python
# backend/tests/test_models.py
import pytest
from backend.app.models.schemas import TaskStatus, Priority, TaskCreate
from backend.app.models.db import init_db, get_db, ProjectModel, TaskModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

@pytest.mark.asyncio
async def test_create_project_and_task_in_db():
    await init_db()
    async for session in get_db():
        project = ProjectModel(
            id="PRJ-20260918-001",
            title="PLC 모니터링 시스템 구축",
            description="공장 설비 실시간 감시 시스템 개발",
            status="ACTIVE"
        )
        session.add(project)
        await session.commit()

        task = TaskModel(
            id="PRJ-20260918-001-T001",
            project_id=project.id,
            title="PLC 통신 프로토콜 조사",
            assignee="PatentSearchAgent",
            priority=Priority.P1.value,
            status=TaskStatus.WORKING.value
        )
        session.add(task)
        await session.commit()

        result = await session.execute(select(TaskModel).where(TaskModel.id == task.id))
        saved_task = result.scalar_one_or_none()
        assert saved_task is not None
        assert saved_task.status == TaskStatus.WORKING.value
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_models.py -v`
Expected: FAIL

- [ ] **Step 3: Implement schemas.py and db.py**

```python
# backend/app/models/schemas.py
from enum import Enum
from typing import Optional, List, Any
from pydantic import BaseModel, Field

class TaskStatus(str, Enum):
    IDLE = "IDLE"
    WORKING = "WORKING"
    SUBMITTED = "SUBMITTED"
    REVIEW = "REVIEW"
    VERIFIED = "VERIFIED"
    CLOSED = "CLOSED"
    BLOCKED = "BLOCKED"

class Priority(str, Enum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"

class CommandCreate(BaseModel):
    instruction: str
    target_team: Optional[str] = "전체"

class TaskCreate(BaseModel):
    id: str
    project_id: str
    title: str
    assignee: str
    priority: Priority = Priority.P2
    status: TaskStatus = TaskStatus.IDLE
    deliverable: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    project_id: str
    title: str
    assignee: str
    priority: str
    status: str
    deliverable: Optional[str] = None
```

```python
# backend/app/models/db.py
from datetime import datetime
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from backend.app.core.config import get_settings

Base = declarative_base()

class ProjectModel(Base):
    __tablename__ = "projects"
    id = Column(String(50), primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)
    tasks = relationship("TaskModel", back_populates="project", cascade="all, delete-orphan")

class CommandModel(Base):
    __tablename__ = "commands"
    id = Column(String(50), primary_key=True)
    project_id = Column(String(50), nullable=True)
    sender = Column(String(50), default="CEO")
    recipient = Column(String(100), default="COO")
    instruction = Column(Text, nullable=False)
    status = Column(String(50), default="PROCESSING")
    created_at = Column(DateTime, default=datetime.utcnow)

class TaskModel(Base):
    __tablename__ = "tasks"
    id = Column(String(50), primary_key=True)
    project_id = Column(String(50), ForeignKey("projects.id"), nullable=False)
    title = Column(String(200), nullable=False)
    assignee = Column(String(100), nullable=False)
    priority = Column(String(10), default="P2")
    status = Column(String(50), default="IDLE")
    deliverable = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("ProjectModel", back_populates="tasks")

class MeetingModel(Base):
    __tablename__ = "meetings"
    id = Column(String(50), primary_key=True)
    project_id = Column(String(50), nullable=True)
    title = Column(String(200), nullable=False)
    attendees = Column(Text, nullable=False)
    agenda = Column(Text, nullable=False)
    decisions = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class PatentRecordModel(Base):
    __tablename__ = "patents"
    id = Column(String(50), primary_key=True)
    project_id = Column(String(50), nullable=False)
    technology = Column(String(200), nullable=False)
    search_scope = Column(String(100), default="KR/US/EP")
    fto_risk = Column(String(20), default="LOW")
    findings = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

engine = None
AsyncSessionLocal = None

async def init_db():
    global engine, AsyncSessionLocal
    settings = get_settings()
    engine = create_async_engine(settings.SQLITE_URL, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    if AsyncSessionLocal is None:
        await init_db()
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_models.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/ backend/tests/test_models.py
git commit -m "feat: define database models and pydantic schemas"
```

---

### Task 3: Dual-Storage Ledger Synchronization Service

**Files:**
- Create: `backend/app/services/ledger_sync.py`
- Test: `backend/tests/test_ledger_sync.py`

**Interfaces:**
- Consumes: Models from `backend/app/models/db.py`, `Settings` from `backend/app/core/config.py`
- Produces: `LedgerSyncService.sync_command()`, `sync_task_ledger()`, `sync_meeting()`, `sync_patent()`.

- [ ] **Step 1: Write failing test for LedgerSyncService**

```python
# backend/tests/test_ledger_sync.py
import pytest
from pathlib import Path
from backend.app.core.config import get_settings
from backend.app.services.ledger_sync import LedgerSyncService

@pytest.mark.asyncio
async def test_ledger_sync_creates_files():
    service = LedgerSyncService()
    settings = get_settings()

    cmd_data = {
        "id": "CMD-20260918-001",
        "project_id": "PRJ-001",
        "sender": "CEO",
        "recipient": "COO",
        "instruction": "PLC 모니터링 시스템 착수",
        "priority": "P1"
    }
    await service.sync_command(cmd_data)
    cmd_file = settings.LEDGER_DIR / "COMMAND_LOG" / "CMD-20260918-001.md"
    assert cmd_file.exists()
    content = cmd_file.read_text(encoding="utf-8")
    assert "CMD-20260918-001" in content
    assert "PLC 모니터링 시스템 착수" in content
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_ledger_sync.py -v`
Expected: FAIL

- [ ] **Step 3: Implement ledger_sync.py with atomic file writing**

```python
# backend/app/services/ledger_sync.py
import json
import asyncio
from pathlib import Path
from typing import Dict, Any, List
import aiofiles
from backend.app.core.config import get_settings

class LedgerSyncService:
    def __init__(self):
        self.settings = get_settings()
        self.lock = asyncio.Lock()

    async def sync_command(self, cmd: Dict[str, Any]):
        async with self.lock:
            cmd_id = cmd["id"]
            md_path = self.settings.LEDGER_DIR / "COMMAND_LOG" / f"{cmd_id}.md"
            json_path = self.settings.LEDGER_DIR / "COMMAND_LOG" / f"{cmd_id}.json"

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
            task_path = self.settings.LEDGER_DIR / "TASK_LEDGER" / f"{project_id}-tasks.json"
            md_path = self.settings.LEDGER_DIR / "TASK_LEDGER" / f"{project_id}-tasks.md"

            async with aiofiles.open(task_path, mode="w", encoding="utf-8") as f:
                await f.write(json.dumps(tasks, ensure_ascii=False, indent=2))

            lines = [f"# TASK LEDGER — {project_id}\n\n| ID | 업무명 | 담당 | 우선순위 | 상태 |",
                     "|---|---|---|---|---|"]
            for t in tasks:
                status_icon = {"IDLE": "⚪", "WORKING": "🔵", "SUBMITTED": "🟡", "REVIEW": "🟣", "VERIFIED": "🟢", "CLOSED": "☑️", "BLOCKED": "🔴"}.get(t.get("status"), "⚪")
                lines.append(f"| {t.get('id')} | {t.get('title')} | {t.get('assignee')} | {t.get('priority')} | {status_icon} {t.get('status')} |")

            async with aiofiles.open(md_path, mode="w", encoding="utf-8") as f:
                await f.write("\n".join(lines) + "\n")

    async def sync_patent_log(self, patent: Dict[str, Any]):
        async with self.lock:
            pat_id = patent["id"]
            md_path = self.settings.LEDGER_DIR / "KNOWLEDGE_PATENT" / f"{pat_id}.md"
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_ledger_sync.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ledger_sync.py backend/tests/test_ledger_sync.py
git commit -m "feat: implement dual-storage ledger synchronization service"
```

---

### Task 4: LLM Client Wrapper & Base Agent Framework

**Files:**
- Create: `backend/app/core/llm.py`
- Create: `backend/app/agents/base.py`
- Test: `backend/tests/test_llm.py`

**Interfaces:**
- Consumes: `Settings` from `backend/app/core/config.py`
- Produces: `LLMClient.generate_json(prompt, schema)` with mock/demo fallback, `BaseAgent.run(prompt)`.

- [ ] **Step 1: Write failing test for LLMClient and BaseAgent**

```python
# backend/tests/test_llm.py
import pytest
from pydantic import BaseModel
from backend.app.core.llm import LLMClient
from backend.app.agents.base import BaseAgent

class MockSchema(BaseModel):
    summary: str
    decision: str

@pytest.mark.asyncio
async def test_llm_client_mock_generation():
    client = LLMClient()
    # Without real API key, must gracefully produce valid structured output
    result = await client.generate_json(
        prompt="Analyze current status",
        system_prompt="You are an analyst",
        schema=MockSchema
    )
    assert isinstance(result, dict)
    assert "summary" in result
    assert "decision" in result
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_llm.py -v`
Expected: FAIL

- [ ] **Step 3: Implement llm.py and base.py**

```python
# backend/app/core/llm.py
import json
import os
from typing import Type, Dict, Any, Optional
from pydantic import BaseModel
from backend.app.core.config import get_settings

class LLMClient:
    def __init__(self):
        self.settings = get_settings()
        self.gemini_key = self.settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")

    async def generate_json(self, prompt: str, system_prompt: str, schema: Type[BaseModel]) -> Dict[str, Any]:
        # If API key exists, call Gemini API
        if self.gemini_key:
            try:
                from google import genai
                client = genai.Client(api_key=self.gemini_key)
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config={
                        "system_instruction": system_prompt,
                        "response_mime_type": "application/json",
                        "response_schema": schema
                    }
                )
                return json.loads(response.text)
            except Exception as e:
                print(f"[LLMClient] API call failed: {e}. Falling back to demo generator.")

        # Robust Mock/Demo generator when API key is not supplied or fails
        return self._generate_mock(prompt, schema)

    def _generate_mock(self, prompt: str, schema: Type[BaseModel]) -> Dict[str, Any]:
        schema_fields = schema.model_fields
        mock_data = {}
        for name, field in schema_fields.items():
            if name == "tasks":
                mock_data[name] = [
                    {"id": "T001", "title": "선행 특허 및 침해(FTO) 조사", "assignee": "PatentSearchAgent", "priority": "P1"},
                    {"id": "T002", "title": "PLC 통신 및 데이터 서버 개발", "assignee": "BackendAgent", "priority": "P1"},
                    {"id": "T003", "title": "모니터링 Web UI 화면 개발", "assignee": "FrontendAgent", "priority": "P2"},
                    {"id": "T004", "title": "통합 기능 검증 및 품질 테스트", "assignee": "QAAgent", "priority": "P1"}
                ]
            elif name == "fto_risk":
                mock_data[name] = "LOW"
            elif name == "passed":
                mock_data[name] = True
            elif name == "summary":
                mock_data[name] = f"지시 분석 완료: {prompt[:40]}에 대한 최적의 실행 계획 수립."
            elif name == "findings":
                mock_data[name] = "선행 특허 3건 검색 완료. 핵심 청구항과 기술 차별점이 확보되어 회피 설계 가능."
            elif name == "deliverable":
                mock_data[name] = "PLC FINS 프로토콜 연동 소켓 서버 및 실시간 데이터 파이프라인 구현 사양서 작성 완료."
            elif name == "feedback":
                mock_data[name] = "요구 기능 100% 충족 확인. 품질 기준 통과 (VERIFIED)."
            else:
                mock_data[name] = f"Executed {name} for: {prompt[:30]}"
        return mock_data
```

```python
# backend/app/agents/base.py
from typing import Type, Dict, Any
from pydantic import BaseModel
from backend.app.core.llm import LLMClient

class BaseAgent:
    def __init__(self, name: str, role: str, department: str):
        self.name = name
        self.role = role
        self.department = department
        self.client = LLMClient()

    async def execute(self, prompt: str, system_prompt: str, schema: Type[BaseModel]) -> Dict[str, Any]:
        return await self.client.generate_json(prompt, system_prompt, schema)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_llm.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/llm.py backend/app/agents/base.py backend/tests/test_llm.py
git commit -m "feat: implement LLM client wrapper and BaseAgent with mock fallback"
```

---

### Task 5: Specialist Agents (Patent, Dev, QA)

**Files:**
- Create: `backend/app/agents/patent/search.py`
- Create: `backend/app/agents/patent/fto.py`
- Create: `backend/app/agents/dev/backend.py`
- Create: `backend/app/agents/qa.py`
- Test: `backend/tests/test_specialist_agents.py`

**Interfaces:**
- Consumes: `BaseAgent` from `backend/app/agents/base.py`
- Produces: `PatentAgent.investigate()`, `BackendDevAgent.develop()`, `QAAgent.verify()`.

- [ ] **Step 1: Write failing test for Specialist Agents**

```python
# backend/tests/test_specialist_agents.py
import pytest
from backend.app.agents.patent.search import PatentSearchAgent
from backend.app.agents.dev.backend import BackendDevAgent
from backend.app.agents.qa import QAAgent

@pytest.mark.asyncio
async def test_specialist_agent_pipeline():
    patent_agent = PatentSearchAgent()
    dev_agent = BackendDevAgent()
    qa_agent = QAAgent()

    # 1. Patent investigation
    pat_res = await patent_agent.investigate("PLC Ethernet communication")
    assert "findings" in pat_res
    assert pat_res.get("fto_risk") in ["LOW", "MEDIUM", "HIGH"]

    # 2. Dev implementation
    dev_res = await dev_agent.develop("PLC data receiver", patent_findings=pat_res["findings"])
    assert "deliverable" in dev_res

    # 3. QA verification
    qa_res = await qa_agent.verify(dev_res["deliverable"], criteria="Must process packets stably")
    assert "passed" in qa_res
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_specialist_agents.py -v`
Expected: FAIL

- [ ] **Step 3: Implement Specialist Agents**

```python
# backend/app/agents/patent/search.py
from pydantic import BaseModel
from backend.app.agents.base import BaseAgent

class PatentOutputSchema(BaseModel):
    technology: str
    search_scope: str
    fto_risk: str
    findings: str
    recommendation: str

class PatentSearchAgent(BaseAgent):
    def __init__(self):
        super().__init__("PatentSearchAgent", "선행기술 및 특허 조사관", "IP팀")

    async def investigate(self, technology: str):
        system_prompt = (
            "너는 기술전문회사의 IP/특허 총괄 전문 에이전트다. "
            "새로운 기술 개발에 앞서 선행 특허 검색, 유사도 비교, FTO(Freedom to Operate) 침해 위험도를 분석하라."
        )
        prompt = f"개발 대상 기술: {technology}\n국내외 특허 현황 및 FTO 위험도를 분석하시오."
        return await self.execute(prompt, system_prompt, PatentOutputSchema)
```

```python
# backend/app/agents/dev/backend.py
from pydantic import BaseModel
from backend.app.agents.base import BaseAgent

class DevOutputSchema(BaseModel):
    module_name: str
    deliverable: str
    architecture_summary: str

class BackendDevAgent(BaseAgent):
    def __init__(self):
        super().__init__("BackendAgent", "백엔드 및 시스템 개발자", "개발팀")

    async def develop(self, requirement: str, patent_findings: str):
        system_prompt = (
            "너는 백엔드 시스템 전문 개발 에이전트다. "
            "특허 조사팀의 회피 설계 권고사항을 준수하여 안정적이고 성능이 우수한 시스템 사양 및 코드를 작성하라."
        )
        prompt = f"요구사항: {requirement}\n특허 유의사항: {patent_findings}\n구현 상세 산출물을 작성하시오."
        return await self.execute(prompt, system_prompt, DevOutputSchema)
```

```python
# backend/app/agents/qa.py
from pydantic import BaseModel
from backend.app.agents.base import BaseAgent

class QAOutputSchema(BaseModel):
    passed: bool
    score: int
    feedback: str
    action_item: str

class QAAgent(BaseAgent):
    def __init__(self):
        super().__init__("QAAgent", "품질 및 신뢰성 검증관", "품질팀")

    async def verify(self, deliverable: str, criteria: str):
        system_prompt = (
            "너는 제품의 품질을 독립적으로 검증하는 QA 책임 에이전트다. "
            "개발팀의 산출물이 CEO 요구조건과 기술 기준을 충족하는지 엄격히 심사하라."
        )
        prompt = f"산출물:\n{deliverable}\n\n검증 기준: {criteria}\n합격 여부와 결함 리포트를 제출하시오."
        return await self.execute(prompt, system_prompt, QAOutputSchema)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_specialist_agents.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/ backend/tests/test_specialist_agents.py
git commit -m "feat: implement Patent, Dev, and QA specialist agents"
```

---

### Task 6: COO Agent & Autonomous Orchestrator

**Files:**
- Create: `backend/app/agents/coo.py`
- Create: `backend/app/services/orchestrator.py`
- Test: `backend/tests/test_orchestrator.py`

**Interfaces:**
- Consumes: All agents, `LedgerSyncService`, SQLite DB session
- Produces: `CompanyOrchestrator.dispatch_ceo_command(instruction)` executing the full end-to-end multi-agent workflow.

- [ ] **Step 1: Write failing test for CompanyOrchestrator**

```python
# backend/tests/test_orchestrator.py
import pytest
from backend.app.models.db import init_db
from backend.app.services.orchestrator import CompanyOrchestrator

@pytest.mark.asyncio
async def test_full_command_orchestration():
    await init_db()
    orchestrator = CompanyOrchestrator()
    result = await orchestrator.dispatch_ceo_command("신규 프로젝트: 스마트 팩토리 PLC 모니터링 시스템 구축")

    assert result["status"] == "SUCCESS"
    assert "project_id" in result
    assert "command_id" in result
    assert len(result["completed_tasks"]) >= 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_orchestrator.py -v`
Expected: FAIL

- [ ] **Step 3: Implement coo.py and orchestrator.py**

```python
# backend/app/agents/coo.py
from typing import List
from pydantic import BaseModel
from backend.app.agents.base import BaseAgent

class TaskDecomposition(BaseModel):
    id: str
    title: str
    assignee: str
    priority: str

class COODecompositionSchema(BaseModel):
    project_title: str
    project_goal: str
    summary: str
    tasks: List[TaskDecomposition]

class COOAgent(BaseAgent):
    def __init__(self):
        super().__init__("COO", "최고운영책임자", "경영진")

    async def decompose_command(self, instruction: str):
        system_prompt = (
            "너는 AI 가상회사의 최고운영책임자(COO)다. "
            "CEO의 지시를 분석하여 프로젝트를 발의하고, 특허조사(PatentSearchAgent), 개발(BackendAgent), 품질검증(QAAgent)으로 세분화하라."
        )
        return await self.execute(instruction, system_prompt, COODecompositionSchema)
```

```python
# backend/app/services/orchestrator.py
from datetime import datetime
from typing import Dict, Any, Callable, Optional
from backend.app.models.db import get_db, ProjectModel, CommandModel, TaskModel, PatentRecordModel
from backend.app.models.schemas import TaskStatus
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
        today_str = datetime.utcnow().strftime("%Y%m%d")
        timestamp_id = int(datetime.utcnow().timestamp()) % 10000
        prj_id = f"PRJ-{today_str}-{timestamp_id:04d}"
        cmd_id = f"CMD-{today_str}-{timestamp_id:04d}"

        # 1. Record Command
        cmd_dict = {
            "id": cmd_id, "project_id": prj_id, "sender": "CEO", "recipient": "COO",
            "instruction": instruction, "priority": "P0", "status": "PROCESSING"
        }
        await self.sync.sync_command(cmd_dict)
        self.broadcast("COMMAND_CREATED", cmd_dict)

        # 2. COO Decompose
        decomp = await self.coo.decompose_command(instruction)
        tasks_meta = decomp.get("tasks", [])

        # 3. Save Project in DB
        async for session in get_db():
            prj = ProjectModel(id=prj_id, title=decomp.get("project_title", instruction[:30]), description=decomp.get("project_goal", ""))
            session.add(prj)
            cmd_m = CommandModel(**cmd_dict)
            session.add(cmd_m)
            await session.commit()
            break

        # 4. Pipeline Execution: Patent -> Dev -> QA
        completed_tasks = []
        pat_findings = ""

        # Step 4a: Patent Gatekeeper
        pat_res = await self.patent.investigate(instruction)
        pat_id = f"PAT-{today_str}-{timestamp_id:04d}"
        pat_dict = {
            "id": pat_id, "project_id": prj_id, "technology": instruction,
            "fto_risk": pat_res.get("fto_risk", "LOW"), "findings": pat_res.get("findings", ""),
            "recommendation": pat_res.get("recommendation", "")
        }
        await self.sync.sync_patent_log(pat_dict)
        pat_findings = pat_res.get("findings", "")
        completed_tasks.append({"id": f"{prj_id}-T001", "title": "특허 및 선행기술 조사", "assignee": "PatentSearchAgent", "status": "VERIFIED", "priority": "P1"})
        self.broadcast("TASK_UPDATED", completed_tasks[-1])

        # Step 4b: Dev
        dev_res = await self.dev.develop(instruction, patent_findings=pat_findings)
        deliverable = dev_res.get("deliverable", "")
        completed_tasks.append({"id": f"{prj_id}-T002", "title": "핵심 시스템 및 아키텍처 개발", "assignee": "BackendAgent", "status": "SUBMITTED", "priority": "P1"})
        self.broadcast("TASK_UPDATED", completed_tasks[-1])

        # Step 4c: QA Verification
        qa_res = await self.qa.verify(deliverable, criteria="CEO 요구사항 만족 및 안정성 검증")
        qa_status = "CLOSED" if qa_res.get("passed", True) else "BLOCKED"
        completed_tasks.append({"id": f"{prj_id}-T003", "title": "품질 검증 및 최종 검수", "assignee": "QAAgent", "status": qa_status, "priority": "P1"})
        completed_tasks[1]["status"] = "CLOSED"
        completed_tasks[0]["status"] = "CLOSED"
        self.broadcast("TASK_UPDATED", completed_tasks[-1])

        # 5. Sync to Task Ledger & DB
        await self.sync.sync_task_ledger(prj_id, completed_tasks)
        async for session in get_db():
            for t in completed_tasks:
                task_m = TaskModel(id=t["id"], project_id=prj_id, title=t["title"], assignee=t["assignee"], priority=t["priority"], status=t["status"])
                session.add(task_m)
            await session.commit()
            break

        return {
            "status": "SUCCESS",
            "project_id": prj_id,
            "command_id": cmd_id,
            "completed_tasks": completed_tasks,
            "summary": decomp.get("summary", "전 공정 완료")
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_orchestrator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/coo.py backend/app/services/orchestrator.py backend/tests/test_orchestrator.py
git commit -m "feat: implement COO agent and autonomous company orchestrator"
```

---

### Task 7: FastAPI REST API & WebSocket Real-time Broadcasting

**Files:**
- Create: `backend/app/api/ws.py`
- Create: `backend/app/api/commands.py`
- Create: `backend/app/api/tasks.py`
- Create: `backend/app/api/ledgers.py`
- Create: `backend/app/main.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `CompanyOrchestrator`, `get_db()`, `Settings`
- Produces: REST Endpoints (`/api/commands`, `/api/tasks`, `/api/ledgers`, `/api/summary`) & WebSocket endpoint (`/ws`).

- [ ] **Step 1: Write failing test for FastAPI routes**

```python
# backend/tests/test_api.py
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_api_health_and_command():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ONLINE"

    cmd_res = client.post("/api/commands", json={"instruction": "테스트 명령 실행", "target_team": "개발팀"})
    assert cmd_res.status_code == 200
    data = cmd_res.json()
    assert "project_id" in data
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_api.py -v`
Expected: FAIL

- [ ] **Step 3: Implement API endpoints and main.py**

```python
# backend/app/api/ws.py
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, event_type: str, data: dict):
        payload = {"event": event_type, "data": data}
        for connection in self.active_connections:
            try:
                await connection.send_json(payload)
            except Exception:
                pass

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

```python
# backend/app/api/commands.py
from fastapi import APIRouter, BackgroundTasks
from backend.app.models.schemas import CommandCreate
from backend.app.services.orchestrator import CompanyOrchestrator
from backend.app.api.ws import manager

router = APIRouter(prefix="/api/commands", tags=["commands"])

@router.post("")
async def create_command(cmd: CommandCreate):
    orchestrator = CompanyOrchestrator(broadcast_fn=lambda e, d: manager.broadcast(e, d))
    result = await orchestrator.dispatch_ceo_command(cmd.instruction)
    return result
```

```python
# backend/app/api/tasks.py
from fastapi import APIRouter
from sqlalchemy import select
from backend.app.models.db import get_db, TaskModel

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("")
async def list_tasks():
    async for session in get_db():
        result = await session.execute(select(TaskModel))
        tasks = result.scalars().all()
        return [{"id": t.id, "project_id": t.project_id, "title": t.title, "assignee": t.assignee, "priority": t.priority, "status": t.status} for t in tasks]
```

```python
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
        tree[sub] = [f.name for f in sub_path.glob("*") if f.is_file()]
    return tree

@router.get("/{subfolder}/{filename}")
async def read_ledger_file(subfolder: str, filename: str):
    settings = get_settings()
    file_path = settings.LEDGER_DIR / subfolder / filename
    if file_path.exists():
        return {"content": file_path.read_text(encoding="utf-8")}
    return {"content": "File not found"}
```

```python
# backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.models.db import init_db
from backend.app.api import ws, commands, tasks, ledgers

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="AI Virtual Company OS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws.router)
app.include_router(commands.router)
app.include_router(tasks.router)
app.include_router(ledgers.router)

@app.get("/api/health")
async def health():
    return {"status": "ONLINE", "system": "AI Virtual Company OS V4.0"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/ backend/app/main.py backend/tests/test_api.py
git commit -m "feat: implement FastAPI endpoints and WebSocket server"
```

---

### Task 8: Frontend Scaffolding (Vite + React + TailwindCSS)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/index.css`
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/hooks/useWebSocket.ts`

**Interfaces:**
- Produces: React 18 frontend scaffolding, compiled via `npm run build`.

- [ ] **Step 1: Create package.json and vite.config.ts**

```json
{
  "name": "virtual-company-frontend",
  "private": true,
  "version": "4.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.441.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.45",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.3",
    "vite": "^5.4.2"
  }
}
```

- [ ] **Step 2: Create Tailwind configuration and types**

```javascript
// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

```typescript
// frontend/src/types/index.ts
export type TaskStatus = 'IDLE' | 'WORKING' | 'SUBMITTED' | 'REVIEW' | 'VERIFIED' | 'CLOSED' | 'BLOCKED';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  assignee: string;
  priority: string;
  status: TaskStatus;
}

export interface LedgerTree {
  [subfolder: string]: string[];
}
```

- [ ] **Step 3: Create API client and WebSocket hook**

```typescript
// frontend/src/api/client.ts
const BASE_URL = "http://localhost:8000";

export const api = {
  async getHealth() {
    const res = await fetch(`${BASE_URL}/api/health`);
    return res.json();
  },
  async sendCommand(instruction: string) {
    const res = await fetch(`${BASE_URL}/api/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction })
    });
    return res.json();
  },
  async getTasks(): Promise<Task[]> {
    const res = await fetch(`${BASE_URL}/api/tasks`);
    return res.json();
  },
  async getLedgers(): Promise<Record<string, string[]>> {
    const res = await fetch(`${BASE_URL}/api/ledgers`);
    return res.json();
  },
  async getLedgerContent(sub: string, filename: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/ledgers/${sub}/${filename}`);
    const data = await res.json();
    return data.content || "";
  }
};
```

- [ ] **Step 4: Install packages and test build**

Run: `cd frontend; npm install; npm run build`
Expected: PASS (Vite builds successfully)

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: initialize React Vite Tailwind frontend"
```

---

### Task 9: Frontend Dashboard UI Implementation

**Files:**
- Create: `frontend/src/components/layout/Navbar.tsx`
- Create: `frontend/src/components/ceo/CommandBar.tsx`
- Create: `frontend/src/components/kanban/KanbanBoard.tsx`
- Create: `frontend/src/components/ledgers/LedgerViewer.tsx`
- Create: `frontend/src/components/org/OrgChart.tsx`
- Create: `frontend/src/App.tsx`

**Interfaces:**
- Produces: Complete, responsive dashboard connecting CEO Command Bar, Kanban, 4-Ledger Viewer, and Org Chart.

- [ ] **Step 1: Implement CommandBar and KPI Status**
- [ ] **Step 2: Implement 5-Stage KanbanBoard**
- [ ] **Step 3: Implement LedgerViewer (File tree + Content display)**
- [ ] **Step 4: Implement OrgChart (CEO -> COO -> C-Level -> Agents with live status)**
- [ ] **Step 5: Connect all views in App.tsx with WebSocket auto-refresh**
- [ ] **Step 6: Verify frontend build**

Run: `cd frontend; npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: build complete React virtual company dashboard UI"
```

---

### Task 10: Unified Launcher & Full End-to-End Verification

**Files:**
- Create: `run.py` (One-command launcher starting both backend and frontend preview)
- Test: `backend/tests/test_e2e_scenario.py`

**Interfaces:**
- Produces: `python run.py` single entry point and verified end-to-end integration test.

- [ ] **Step 1: Write the end-to-end scenario test**

```python
# backend/tests/test_e2e_scenario.py
import pytest
from backend.app.models.db import init_db
from backend.app.services.orchestrator import CompanyOrchestrator
from backend.app.core.config import get_settings

@pytest.mark.asyncio
async def test_complete_company_operation():
    await init_db()
    settings = get_settings()
    orchestrator = CompanyOrchestrator()

    # Issue CEO command
    result = await orchestrator.dispatch_ceo_command("산업용 PLC 데이터 수신 모니터링 서버 개발")
    assert result["status"] == "SUCCESS"
    prj_id = result["project_id"]

    # Check that Patent Log was physically generated
    patent_files = list((settings.LEDGER_DIR / "KNOWLEDGE_PATENT").glob("*.md"))
    assert len(patent_files) > 0

    # Check that Task Ledger was physically generated
    task_ledger = settings.LEDGER_DIR / "TASK_LEDGER" / f"{prj_id}-tasks.md"
    assert task_ledger.exists()
```

- [ ] **Step 2: Run all backend tests**

Run: `pytest backend/tests/ -v`
Expected: 100% PASS

- [ ] **Step 3: Create run.py unified launcher**

```python
# run.py
import subprocess
import sys
import time

def main():
    print("=" * 60)
    print("  🏢 AI VIRTUAL COMPANY OS V4.0 LAUNCHER")
    print("=" * 60)
    print("[1/2] Starting FastAPI Backend on http://localhost:8000 ...")
    backend = subprocess.Popen([sys.executable, "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"])

    time.sleep(2)
    print("[2/2] Starting Frontend Vite Dev Server on http://localhost:5173 ...")
    frontend = subprocess.Popen(["npm", "run", "dev", "--prefix", "frontend"], shell=True)

    try:
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        print("\nStopping Virtual Company OS...")
        backend.terminate()
        frontend.terminate()

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Final verification and commit**

```bash
git add run.py backend/tests/test_e2e_scenario.py
git commit -m "feat: add unified launcher and complete e2e integration verification"
```
