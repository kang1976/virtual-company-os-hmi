# backend/tests/test_e2e_scenario.py
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.core.config import get_settings
from backend.app.main import app
from backend.app.models.db import CommandModel, ProjectModel, TaskModel, get_db, init_db
from backend.app.services.orchestrator import CompanyOrchestrator


@pytest.mark.asyncio
async def test_complete_company_operation():
    """
    E2E 시나리오 검증:
    CEO 지시 발령 -> COO 업무 분해 -> IP팀 선행 특허 조사 및 보고서 발행
    -> 개발팀 아키텍처 및 시스템 구현 -> 품질팀 독립 QA 검증 및 원장 마감
    -> 파일 시스템 원장 동기화 -> SQLite DB 영속화
    """
    await init_db()
    settings = get_settings()

    import asyncio
    await asyncio.sleep(1.05)

    broadcasted_events = []

    def mock_broadcast(event: str, data: dict):
        broadcasted_events.append((event, data))

    orchestrator = CompanyOrchestrator(broadcast_fn=mock_broadcast)

    # 1. CEO 지시 발령
    command_text = "산업용 PLC 데이터 수신 모니터링 서버 개발"
    result = await orchestrator.dispatch_ceo_command(command_text)

    assert result["status"] == "SUCCESS"
    assert "project_id" in result
    assert "command_id" in result
    prj_id = result["project_id"]
    cmd_id = result["command_id"]

    # 2. COO 업무 분해 및 전문 에이전트 단계별 완료 확인
    completed_tasks = result.get("completed_tasks", [])
    assert len(completed_tasks) >= 3

    # 특허 에이전트 확인
    patent_task = next((t for t in completed_tasks if t["assignee"] == "PatentSearchAgent"), None)
    assert patent_task is not None
    assert patent_task["status"] == "CLOSED"

    # 개발 에이전트 산출물 확인
    dev_task = next((t for t in completed_tasks if t["assignee"] == "BackendAgent"), None)
    assert dev_task is not None
    assert dev_task["status"] == "CLOSED"

    # QA 에이전트 검증 확인
    qa_task = next((t for t in completed_tasks if t["assignee"] == "QAAgent"), None)
    assert qa_task is not None
    assert qa_task["status"] == "CLOSED"

    # 3. 특허 보고서 파일 생성 및 내용 확인 (COMPANY_LEDGERS/KNOWLEDGE_PATENT/)
    patent_files = list((settings.LEDGER_DIR / "KNOWLEDGE_PATENT").glob("*.md"))
    assert len(patent_files) > 0
    latest_patent_file = max(patent_files, key=lambda f: f.stat().st_mtime)
    patent_content = latest_patent_file.read_text(encoding="utf-8")
    assert "선행 기술 및 특허 조사 보고서" in patent_content or "PAT-" in patent_content
    assert command_text in patent_content or "FTO" in patent_content

    # 4. 태스크 원장 파일 생성 확인 (COMPANY_LEDGERS/TASK_LEDGER/)
    task_ledger_md = settings.LEDGER_DIR / "TASK_LEDGER" / f"{prj_id}-tasks.md"
    task_ledger_json = settings.LEDGER_DIR / "TASK_LEDGER" / f"{prj_id}-tasks.json"
    assert task_ledger_md.exists()
    assert task_ledger_json.exists()

    md_content = task_ledger_md.read_text(encoding="utf-8")
    assert f"# TASK LEDGER — {prj_id}" in md_content
    assert "PatentSearchAgent" in md_content
    assert "BackendAgent" in md_content
    assert "QAAgent" in md_content

    json_tasks = json.loads(task_ledger_json.read_text(encoding="utf-8"))
    assert len(json_tasks) >= 3

    # 5. 명령 원장 파일 생성 확인 (COMPANY_LEDGERS/COMMAND_LOG/)
    cmd_file_md = settings.LEDGER_DIR / "COMMAND_LOG" / f"{cmd_id}.md"
    assert cmd_file_md.exists()
    cmd_content = cmd_file_md.read_text(encoding="utf-8")
    assert cmd_id in cmd_content
    assert command_text in cmd_content

    # 6. 실시간 브로드캐스트 이벤트 검증
    event_names = [e[0] for e in broadcasted_events]
    assert "COMMAND_CREATED" in event_names
    assert "TASK_UPDATED" in event_names

    # 7. DB 영속화 검증
    async for session in get_db():
        # 프로젝트 조회
        prj_stmt = select(ProjectModel).where(ProjectModel.id == prj_id)
        prj_obj = (await session.execute(prj_stmt)).scalar_one_or_none()
        assert prj_obj is not None

        # 명령 조회
        cmd_stmt = select(CommandModel).where(CommandModel.id == cmd_id)
        cmd_obj = (await session.execute(cmd_stmt)).scalar_one_or_none()
        assert cmd_obj is not None
        assert cmd_obj.instruction == command_text

        # 태스크 조회
        tasks_stmt = select(TaskModel).where(TaskModel.project_id == prj_id)
        tasks_objs = (await session.execute(tasks_stmt)).scalars().all()
        assert len(tasks_objs) >= 3
        task_assignees = {t.assignee for t in tasks_objs}
        assert "PatentSearchAgent" in task_assignees
        assert "BackendAgent" in task_assignees
        assert "QAAgent" in task_assignees
        break


def test_e2e_rest_api_full_flow():
    """
    REST API 엔드투엔드 전체 흐름 검증:
    /api/health -> /api/commands (POST) -> /api/tasks (GET) -> /api/ledgers (GET/File)
    """
    import time
    time.sleep(1.1)
    client = TestClient(app)

    # 1. 헬스 체크
    health_resp = client.get("/api/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "ONLINE"

    # 2. REST API를 통한 CEO 명령 하달
    cmd_payload = {
        "instruction": "차세대 스마트 팩토리 실시간 공정 감시 시스템 구축",
        "target_team": "전체",
    }
    cmd_resp = client.post("/api/commands", json=cmd_payload)
    assert cmd_resp.status_code == 200
    cmd_data = cmd_resp.json()
    assert cmd_data["status"] == "SUCCESS"
    prj_id = cmd_data["project_id"]
    cmd_id = cmd_data["command_id"]
    assert len(cmd_data["completed_tasks"]) >= 3

    # 3. /api/tasks 엔드포인트에서 생성된 태스크 목록 조회
    tasks_resp = client.get("/api/tasks")
    assert tasks_resp.status_code == 200
    all_tasks = tasks_resp.json()
    assert isinstance(all_tasks, list)

    prj_tasks = [t for t in all_tasks if t.get("project_id") == prj_id]
    assert len(prj_tasks) >= 3
    assignees = {t["assignee"] for t in prj_tasks}
    assert "PatentSearchAgent" in assignees
    assert "BackendAgent" in assignees
    assert "QAAgent" in assignees

    # 4. /api/ledgers 엔드포인트 트리 구조 및 파일 확인
    tree_resp = client.get("/api/ledgers")
    assert tree_resp.status_code == 200
    tree_data = tree_resp.json()
    assert "TASK_LEDGER" in tree_data
    assert "COMMAND_LOG" in tree_data
    assert "KNOWLEDGE_PATENT" in tree_data

    # TASK_LEDGER 파일 확인
    expected_task_md = f"{prj_id}-tasks.md"
    assert expected_task_md in tree_data["TASK_LEDGER"]

    # COMMAND_LOG 파일 확인
    expected_cmd_md = f"{cmd_id}.md"
    assert expected_cmd_md in tree_data["COMMAND_LOG"]

    # 5. /api/ledgers/{subfolder}/{filename} 단일 파일 읽기 검증
    read_task_resp = client.get(f"/api/ledgers/TASK_LEDGER/{expected_task_md}")
    assert read_task_resp.status_code == 200
    task_content = read_task_resp.json().get("content", "")
    assert f"# TASK LEDGER — {prj_id}" in task_content
    assert "PatentSearchAgent" in task_content

    read_cmd_resp = client.get(f"/api/ledgers/COMMAND_LOG/{expected_cmd_md}")
    assert read_cmd_resp.status_code == 200
    cmd_content = read_cmd_resp.json().get("content", "")
    assert cmd_id in cmd_content
    assert cmd_payload["instruction"] in cmd_content
