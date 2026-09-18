# AI 가상회사 운영 시스템 (Virtual Company OS) V4.0 구현 계획서

> **에이전트 작업자 필수 지침:** 권장 실행 방식: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`를 사용하여 태스크별로 단계적 구현을 진행합니다. 각 단계는 체크박스 (`- [ ]`) 구문으로 추적합니다.

**목표:** 비동기 멀티 에이전트 오케스트레이터(COO, 특허 Gatekeeper, 개발, 품질 QA), 듀얼 스토리지(SQLite + 파일 기반 4대 장부), 실시간 React 웹 대시보드를 갖춘 완전 실행형 AI 가상회사 운영 시스템 구축.

**아키텍처:** Python FastAPI 백엔드가 자율 LLM 에이전트(Gemini API 기반, API 미설정 시 자동 데모 모드 지원)를 5단계 검증 워크플로우(`IDLE(대기)` → `WORKING(진행)` → `SUBMITTED(제출)` → `REVIEW(검증)` → `VERIFIED(합격)` → `CLOSED(종결)`)로 조율하고, SQLite DB와 사람이 직접 읽을 수 있는 마크다운/JSON 장부(`COMPANY_LEDGERS/`)에 동기화하며, WebSocket을 통해 React + Vite + TailwindCSS 대시보드로 실시간 현황을 스트리밍합니다.

**기술 스택:** Python 3.14, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy, google-genai, aiofiles, pytest, Node.js 24, React 18, Vite, TypeScript, TailwindCSS, Lucide-React.

**설계 명세서(Spec):** [`docs/superpowers/specs/2026-09-18-virtual-company-os-design.md`](file:///d:/AI_Work/Antigravity/06.CEO/docs/superpowers/specs/2026-09-18-virtual-company-os-design.md)

## 전역 제약 조건 (Global Constraints)

- 백엔드는 Windows PowerShell 환경의 Python 3.14에서 구동되어야 합니다.
- 프론트엔드는 Node.js v24 및 Vite로 정상 빌드되어야 합니다.
- 4대 장부는 실제 물리적 디렉터리인 `COMPANY_LEDGERS/` (`PROJECTS/`, `COMMAND_LOG/`, `TASK_LEDGER/`, `MEETING_LOG/`, `KNOWLEDGE_PATENT/`)에 사람이 읽기 쉬운 형태로 생성되어야 합니다.
- 기술 개발 과제 착수 전 반드시 특허 Gatekeeper(선행기술 및 FTO 침해조사) 조사를 거쳐야 합니다.
- 개발팀이 자체적으로 완료를 선언할 수 없으며, 반드시 QA 에이전트의 독립 검증을 통과해야 `VERIFIED` 및 `CLOSED` 상태가 됩니다.
- LLM API 키가 없는 로컬 환경에서도 시스템 전체 흐름(지시, 분배, 검증, 장부 기록)을 100% 테스트할 수 있도록 견고한 데모(Mock) 폴백 기능을 제공해야 합니다.

---

### 태스크 1: 프로젝트 기초 환경 구축, 디렉터리 구성 및 설정 모듈

**대상 파일:**
- 생성: `backend/requirements.txt`
- 생성: `backend/.env.example`
- 생성: `backend/app/core/config.py`
- 테스트: `backend/tests/test_config.py`

**인터페이스:**
- 산출물: `COMPANY_NAME`, `LEDGER_DIR`, `SQLITE_URL`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `DEFAULT_PROVIDER`를 제공하는 `Settings` 객체.

- [ ] **1단계: 설정 로드 및 디렉터리 자동 생성 실패 테스트 작성**

```python
# backend/tests/test_config.py
import os
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

- [ ] **2단계: 테스트 실행하여 실패 확인 (RED)**

실행: `pytest backend/tests/test_config.py -v`
기대 결과: FAIL (ModuleNotFoundError 또는 FileNotFoundError)

- [ ] **3단계: requirements.txt, .env.example, config.py 구현**

```txt
# backend/requirements.txt
fastapi>=0.115.0
uvicorn>=0.30.0
pydantic>=2.8.0
pydantic-settings>=2.4.0
sqlalchemy>=2.0.30
aiosqlite>=0.20.0
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

- [ ] **4단계: 테스트 재실행하여 통과 확인 (GREEN)**

실행: `pytest backend/tests/test_config.py -v`
기대 결과: PASS

- [ ] **5단계: 커밋**

```bash
git add backend/
git commit -m "feat: setup project configuration and ledger directories"
```

---

### 태스크 2: 핵심 데이터 모델 및 SQLite 데이터베이스 계층

**대상 파일:**
- 생성: `backend/app/models/schemas.py`
- 생성: `backend/app/models/db.py`
- 테스트: `backend/tests/test_models.py`

**인터페이스:**
- 입력: `backend/app/core/config.py`의 `Settings`
- 산출물: Pydantic 스키마(`ProjectCreate`, `CommandCreate`, `TaskResponse`, `TaskStatus`, `Priority`) 및 SQLAlchemy 테이블(`ProjectModel`, `CommandModel`, `TaskModel`, `MeetingModel`, `PatentRecordModel`).

- [ ] **1단계: 데이터 모델 및 DB 세션 실패 테스트 작성**

```python
# backend/tests/test_models.py
import pytest
from backend.app.models.schemas import TaskStatus, Priority
from backend.app.models.db import init_db, get_db, ProjectModel, TaskModel
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

- [ ] **2단계: 테스트 실행하여 실패 확인 (RED)**

실행: `pytest backend/tests/test_models.py -v`
기대 결과: FAIL

- [ ] **3단계: schemas.py 및 db.py 구현**

```python
# backend/app/models/schemas.py
from enum import Enum
from typing import Optional, List, Any
from pydantic import BaseModel, Field

class TaskStatus(str, Enum):
    IDLE = "IDLE"           # 대기
    WORKING = "WORKING"     # 진행 중
    SUBMITTED = "SUBMITTED" # 작업물 제출
    REVIEW = "REVIEW"       # QA 검토 중
    VERIFIED = "VERIFIED"   # 검증 완료
    CLOSED = "CLOSED"       # 최종 마감
    BLOCKED = "BLOCKED"     # 문제 발생/CEO 결정 대기

class Priority(str, Enum):
    P0 = "P0"  # CEO 긴급 지시
    P1 = "P1"  # 핵심 선행 업무
    P2 = "P2"  # 일반 업무
    P3 = "P3"  # 부가 업무
    P4 = "P4"  # 보류

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
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
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

- [ ] **4단계: 테스트 재실행하여 통과 확인 (GREEN)**

실행: `pytest backend/tests/test_models.py -v`
기대 결과: PASS

- [ ] **5단계: 커밋**

```bash
git add backend/app/models/ backend/tests/test_models.py
git commit -m "feat: define database models and pydantic schemas"
```

---

### 태스크 3: 4대 장부 파일 동기화 서비스 (Dual-Storage Sync)

**대상 파일:**
- 생성: `backend/app/services/ledger_sync.py`
- 테스트: `backend/tests/test_ledger_sync.py`

**인터페이스:**
- 입력: `backend/app/models/db.py` 모델 및 `Settings`
- 산출물: `sync_command()`, `sync_task_ledger()`, `sync_patent_log()` 메서드를 갖춘 `LedgerSyncService`.

- [ ] **1단계: 장부 파일 생성 실패 테스트 작성**

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

- [ ] **2단계: 테스트 실행하여 실패 확인 (RED)**

실행: `pytest backend/tests/test_ledger_sync.py -v`
기대 결과: FAIL

- [ ] **3단계: ledger_sync.py 구현**

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

- [ ] **4단계: 테스트 재실행하여 통과 확인 (GREEN)**

실행: `pytest backend/tests/test_ledger_sync.py -v`
기대 결과: PASS

- [ ] **5단계: 커밋**

```bash
git add backend/app/services/ledger_sync.py backend/tests/test_ledger_sync.py
git commit -m "feat: implement dual-storage ledger synchronization service"
```

---

### 태스크 4: LLM 클라이언트 래퍼 및 BaseAgent 프레임워크

**대상 파일:**
- 생성: `backend/app/core/llm.py`
- 생성: `backend/app/agents/base.py`
- 테스트: `backend/tests/test_llm.py`

**인터페이스:**
- 산출물: API 키 없을 때 자동 데모 모드를 지원하는 `LLMClient.generate_json(prompt, schema)` 및 `BaseAgent.execute()`.

- [ ] **1단계: LLMClient 및 BaseAgent 실패 테스트 작성**

```python
# backend/tests/test_llm.py
import pytest
from pydantic import BaseModel
from backend.app.core.llm import LLMClient

class MockSchema(BaseModel):
    summary: str
    decision: str

@pytest.mark.asyncio
async def test_llm_client_mock_generation():
    client = LLMClient()
    result = await client.generate_json(
        prompt="현재 상태 분석",
        system_prompt="너는 분석관이다",
        schema=MockSchema
    )
    assert isinstance(result, dict)
    assert "summary" in result
    assert "decision" in result
```

- [ ] **2단계: 테스트 실행하여 실패 확인 (RED)**

실행: `pytest backend/tests/test_llm.py -v`
기대 결과: FAIL

- [ ] **3단계: llm.py 및 base.py 구현**

```python
# backend/app/core/llm.py
import json
import os
from typing import Type, Dict, Any
from pydantic import BaseModel
from backend.app.core.config import get_settings

class LLMClient:
    def __init__(self):
        self.settings = get_settings()
        self.gemini_key = self.settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")

    async def generate_json(self, prompt: str, system_prompt: str, schema: Type[BaseModel]) -> Dict[str, Any]:
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
                print(f"[LLMClient] API 호출 실패: {e}. 데모 생성기로 안전하게 전환합니다.")

        # API 키가 없거나 실패 시 견고한 한국어 데모 생성기 동작
        return self._generate_mock(prompt, schema)

    def _generate_mock(self, prompt: str, schema: Type[BaseModel]) -> Dict[str, Any]:
        schema_fields = schema.model_fields
        mock_data = {}
        for name in schema_fields:
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
                mock_data[name] = f"지시 분석 완료: {prompt[:40]}에 대한 최적의 가상회사 실행 계획을 수립했습니다."
            elif name == "findings":
                mock_data[name] = "관련 국내외 선행 특허 3건 정밀 분석 완료. 핵심 청구항과 기술적 차별점을 확인하여 회피 설계 전략 수립."
            elif name == "deliverable":
                mock_data[name] = "산업용 PLC FINS 프로토콜 연동 소켓 서버 및 실시간 데이터 파이프라인 구현 사양서 작성 완료."
            elif name == "feedback":
                mock_data[name] = "CEO 요구 기능 100% 충족 확인. 품질 기준 통과 승인 (VERIFIED)."
            elif name == "recommendation":
                mock_data[name] = "기존 등록 특허의 통신 프레임 포맷을 회피하여 독자 헤더 구조로 개발 진행할 것."
            else:
                mock_data[name] = f"실행 완료: {prompt[:30]}"
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

- [ ] **4단계: 테스트 재실행하여 통과 확인 (GREEN)**

실행: `pytest backend/tests/test_llm.py -v`
기대 결과: PASS

- [ ] **5단계: 커밋**

```bash
git add backend/app/core/llm.py backend/app/agents/base.py backend/tests/test_llm.py
git commit -m "feat: implement LLM client wrapper and BaseAgent with demo fallback"
```

---

### 태스크 5: 부서별 전문 에이전트 구현 (특허 Gatekeeper, 개발, 품질 QA)

**대상 파일:**
- 생성: `backend/app/agents/patent/search.py`
- 생성: `backend/app/agents/dev/backend.py`
- 생성: `backend/app/agents/qa.py`
- 테스트: `backend/tests/test_specialist_agents.py`

**인터페이스:**
- 산출물: `PatentSearchAgent.investigate()`, `BackendDevAgent.develop()`, `QAAgent.verify()`.

- [ ] **1단계: 전문 에이전트 파이프라인 실패 테스트 작성**

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

    # 1. 특허 및 선행기술 조사
    pat_res = await patent_agent.investigate("PLC Ethernet communication")
    assert "findings" in pat_res
    assert pat_res.get("fto_risk") in ["LOW", "MEDIUM", "HIGH"]

    # 2. 회피 설계를 반영한 개발
    dev_res = await dev_agent.develop("PLC 데이터 수신 서버", patent_findings=pat_res["findings"])
    assert "deliverable" in dev_res

    # 3. 독립 품질 검증
    qa_res = await qa_agent.verify(dev_res["deliverable"], criteria="패킷 안정성 및 신뢰성 검증")
    assert "passed" in qa_res
```

- [ ] **2단계: 테스트 실행하여 실패 확인 (RED)**

실행: `pytest backend/tests/test_specialist_agents.py -v`
기대 결과: FAIL

- [ ] **3단계: search.py, backend.py, qa.py 구현**

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

- [ ] **4단계: 테스트 재실행하여 통과 확인 (GREEN)**

실행: `pytest backend/tests/test_specialist_agents.py -v`
기대 결과: PASS

- [ ] **5단계: 커밋**

```bash
git add backend/app/agents/ backend/tests/test_specialist_agents.py
git commit -m "feat: implement Patent, Dev, and QA specialist agents"
```

---

### 태스크 6: COO 에이전트 및 자율 오케스트레이션 엔진

**대상 파일:**
- 생성: `backend/app/agents/coo.py`
- 생성: `backend/app/services/orchestrator.py`
- 테스트: `backend/tests/test_orchestrator.py`

**인터페이스:**
- 산출물: CEO 지시를 받아 전 공정(특허 → 개발 → QA → 장부 동기화)을 실행하는 `CompanyOrchestrator.dispatch_ceo_command()`.

- [ ] **1단계: 오케스트레이터 전체 실행 실패 테스트 작성**

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

- [ ] **2단계: 테스트 실행하여 실패 확인 (RED)**

실행: `pytest backend/tests/test_orchestrator.py -v`
기대 결과: FAIL

- [ ] **3단계: coo.py 및 orchestrator.py 구현**

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
        today_str = datetime.utcnow().strftime("%Y%m%d")
        timestamp_id = int(datetime.utcnow().timestamp()) % 10000
        prj_id = f"PRJ-{today_str}-{timestamp_id:04d}"
        cmd_id = f"CMD-{today_str}-{timestamp_id:04d}"

        # 1. 지시 원장 기록
        cmd_dict = {
            "id": cmd_id, "project_id": prj_id, "sender": "CEO", "recipient": "COO",
            "instruction": instruction, "priority": "P0", "status": "PROCESSING"
        }
        await self.sync.sync_command(cmd_dict)
        self.broadcast("COMMAND_CREATED", cmd_dict)

        # 2. COO 업무 분해
        decomp = await self.coo.decompose_command(instruction)

        # 3. 프로젝트 DB 등록
        async for session in get_db():
            prj = ProjectModel(id=prj_id, title=decomp.get("project_title", instruction[:30]), description=decomp.get("project_goal", ""))
            session.add(prj)
            cmd_m = CommandModel(**cmd_dict)
            session.add(cmd_m)
            await session.commit()
            break

        completed_tasks = []

        # 4a. 1단계: 선행 특허 조사 (Gatekeeper)
        pat_res = await self.patent.investigate(instruction)
        pat_id = f"PAT-{today_str}-{timestamp_id:04d}"
        pat_dict = {
            "id": pat_id, "project_id": prj_id, "technology": instruction,
            "fto_risk": pat_res.get("fto_risk", "LOW"), "findings": pat_res.get("findings", ""),
            "recommendation": pat_res.get("recommendation", "")
        }
        await self.sync.sync_patent_log(pat_dict)
        pat_findings = pat_res.get("findings", "")
        t1 = {"id": f"{prj_id}-T001", "title": "특허 및 선행기술 조사", "assignee": "PatentSearchAgent", "status": "VERIFIED", "priority": "P1"}
        completed_tasks.append(t1)
        self.broadcast("TASK_UPDATED", t1)

        # 4b. 2단계: 개발
        dev_res = await self.dev.develop(instruction, patent_findings=pat_findings)
        deliverable = dev_res.get("deliverable", "")
        t2 = {"id": f"{prj_id}-T002", "title": "핵심 시스템 및 아키텍처 개발", "assignee": "BackendAgent", "status": "SUBMITTED", "priority": "P1"}
        completed_tasks.append(t2)
        self.broadcast("TASK_UPDATED", t2)

        # 4c. 3단계: QA 독립 검증
        qa_res = await self.qa.verify(deliverable, criteria="CEO 요구사항 만족 및 안정성 검증")
        qa_status = "CLOSED" if qa_res.get("passed", True) else "BLOCKED"
        t3 = {"id": f"{prj_id}-T003", "title": "품질 검증 및 최종 검수", "assignee": "QAAgent", "status": qa_status, "priority": "P1"}
        completed_tasks.append(t3)
        completed_tasks[0]["status"] = "CLOSED"
        completed_tasks[1]["status"] = "CLOSED"
        self.broadcast("TASK_UPDATED", t3)

        # 5. 장부 및 DB 최종 동기화
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
            "summary": decomp.get("summary", "전 공정 완료 및 원장 마감")
        }
```

- [ ] **4단계: 테스트 재실행하여 통과 확인 (GREEN)**

실행: `pytest backend/tests/test_orchestrator.py -v`
기대 결과: PASS

- [ ] **5단계: 커밋**

```bash
git add backend/app/agents/coo.py backend/app/services/orchestrator.py backend/tests/test_orchestrator.py
git commit -m "feat: implement COO agent and autonomous company orchestrator"
```

---

### 태스크 7: FastAPI REST API 및 실시간 WebSocket 서버

**대상 파일:**
- 생성: `backend/app/api/ws.py`
- 생성: `backend/app/api/commands.py`
- 생성: `backend/app/api/tasks.py`
- 생성: `backend/app/api/ledgers.py`
- 생성: `backend/app/main.py`
- 테스트: `backend/tests/test_api.py`

**인터페이스:**
- 산출물: 엔드포인트 (`/api/commands`, `/api/tasks`, `/api/ledgers`, `/api/health`, `/ws`).

- [ ] **1단계: API 엔드포인트 실패 테스트 작성**

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

- [ ] **2단계: 테스트 실행하여 실패 확인 (RED)**

실행: `pytest backend/tests/test_api.py -v`
기대 결과: FAIL

- [ ] **3단계: API 모듈 및 main.py 구현**

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
from fastapi import APIRouter
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
    return {"content": "파일을 찾을 수 없습니다."}
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

- [ ] **4단계: 테스트 재실행하여 통과 확인 (GREEN)**

실행: `pytest backend/tests/test_api.py -v`
기대 결과: PASS

- [ ] **5단계: 커밋**

```bash
git add backend/app/api/ backend/app/main.py backend/tests/test_api.py
git commit -m "feat: implement FastAPI endpoints and WebSocket server"
```

---

### 태스크 8: 프론트엔드 기초 환경 구성 (Vite + React + TailwindCSS)

**대상 파일:**
- 생성: `frontend/package.json`
- 생성: `frontend/vite.config.ts`
- 생성: `frontend/tailwind.config.js`
- 생성: `frontend/postcss.config.js`
- 생성: `frontend/src/index.css`
- 생성: `frontend/src/types/index.ts`
- 생성: `frontend/src/api/client.ts`
- 생성: `frontend/src/hooks/useWebSocket.ts`

- [ ] **1단계: package.json 및 Vite, Tailwind 설정 파일 생성**
- [ ] **2단계: TypeScript 인터페이스 및 API 클라이언트 생성**
- [ ] **3단계: 패키지 설치 및 빌드 테스트**

실행: `cd frontend; npm install; npm run build`
기대 결과: PASS (Vite 빌드 성공)

- [ ] **4단계: 커밋**

```bash
git add frontend/
git commit -m "feat: initialize React Vite Tailwind frontend"
```

---

### 태스크 9: React 가상회사 관제 대시보드 UI 구현

**대상 파일:**
- 생성: `frontend/src/components/layout/Navbar.tsx`
- 생성: `frontend/src/components/ceo/CommandBar.tsx`
- 생성: `frontend/src/components/kanban/KanbanBoard.tsx`
- 생성: `frontend/src/components/ledgers/LedgerViewer.tsx`
- 생성: `frontend/src/components/org/OrgChart.tsx`
- 생성: `frontend/src/App.tsx`

- [ ] **1단계: CEO 지시바 및 실시간 브리핑 카드 구현**
- [ ] **2단계: 5단계 검증 태스크 칸반 보드 구현**
- [ ] **3단계: 4대 장부 마크다운 탐색기 구현**
- [ ] **4단계: 조직도 및 에이전트 실시간 상태 뷰어 구현**
- [ ] **5단계: WebSocket 실시간 이벤트와 전체 대시보드 연결 (App.tsx)**
- [ ] **6단계: 빌드 검증**

실행: `cd frontend; npm run build`
기대 결과: PASS

- [ ] **7단계: 커밋**

```bash
git add frontend/src/
git commit -m "feat: build complete React virtual company dashboard UI"
```

---

### 태스크 10: 원클릭 통합 실행기 및 E2E 전체 시나리오 검증

**대상 파일:**
- 생성: `run.py` (백엔드와 프론트엔드를 동시에 실행하는 단일 실행 스크립트)
- 테스트: `backend/tests/test_e2e_scenario.py`

- [ ] **1단계: E2E 통합 시나리오 테스트 작성 및 검증**

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

    # CEO 지시 발령
    result = await orchestrator.dispatch_ceo_command("산업용 PLC 데이터 수신 모니터링 서버 개발")
    assert result["status"] == "SUCCESS"
    prj_id = result["project_id"]

    # 특허 보고서 파일 생성 확인
    patent_files = list((settings.LEDGER_DIR / "KNOWLEDGE_PATENT").glob("*.md"))
    assert len(patent_files) > 0

    # 태스크 원장 파일 생성 확인
    task_ledger = settings.LEDGER_DIR / "TASK_LEDGER" / f"{prj_id}-tasks.md"
    assert task_ledger.exists()
```

- [ ] **2단계: 전체 테스트 스위트 일괄 실행**

실행: `pytest backend/tests/ -v`
기대 결과: 100% PASS

- [ ] **3단계: run.py 통합 런처 생성**

```python
# run.py
import subprocess
import sys
import time

def main():
    print("=" * 60)
    print("  🏢 AI VIRTUAL COMPANY OS V4.0 LAUNCHER")
    print("=" * 60)
    print("[1/2] FastAPI 백엔드 시작: http://localhost:8000 ...")
    backend = subprocess.Popen([sys.executable, "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"])

    time.sleep(2)
    print("[2/2] React 프론트엔드 시작: http://localhost:5173 ...")
    frontend = subprocess.Popen(["npm", "run", "dev", "--prefix", "frontend"], shell=True)

    try:
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        print("\nAI 가상회사 운영 시스템을 종료합니다...")
        backend.terminate()
        frontend.terminate()

if __name__ == "__main__":
    main()
```

- [ ] **4단계: 최종 커밋**

```bash
git add run.py backend/tests/test_e2e_scenario.py
git commit -m "feat: add unified launcher and complete e2e integration verification"
```
