# backend/tests/test_orchestrator.py
import pytest
from sqlalchemy import select
from backend.app.models.db import init_db, get_db, ProjectModel, CommandModel, TaskModel
from backend.app.services.orchestrator import CompanyOrchestrator
from backend.app.agents.coo import COOAgent, TaskDecomposition, COODecompositionSchema


@pytest.mark.asyncio
async def test_full_command_orchestration():
    await init_db()
    broadcast_events = []

    def mock_broadcast(event: str, data: dict):
        broadcast_events.append((event, data))

    orchestrator = CompanyOrchestrator(broadcast_fn=mock_broadcast)
    instruction = "신규 프로젝트: 스마트 팩토리 PLC 모니터링 시스템 구축"
    result = await orchestrator.dispatch_ceo_command(instruction)

    assert result["status"] == "SUCCESS"
    assert "project_id" in result
    assert "command_id" in result
    assert len(result["completed_tasks"]) == 4
    assignees = [t["assignee"] for t in result["completed_tasks"]]
    assert "PatentSearchAgent" in assignees
    assert "BackendAgent" in assignees
    assert "SecurityAgent" in assignees
    assert "QAAgent" in assignees

    # 검증: broadcast 이벤트 확인
    event_names = [e[0] for e in broadcast_events]
    assert "COMMAND_CREATED" in event_names
    assert "TASK_UPDATED" in event_names

    # 검증: DB 저장 확인
    async for session in get_db():
        prj_stmt = select(ProjectModel).where(ProjectModel.id == result["project_id"])
        prj_res = await session.execute(prj_stmt)
        prj = prj_res.scalar_one_or_none()
        assert prj is not None

        cmd_stmt = select(CommandModel).where(CommandModel.id == result["command_id"])
        cmd_res = await session.execute(cmd_stmt)
        cmd = cmd_res.scalar_one_or_none()
        assert cmd is not None
        assert cmd.instruction == instruction

        tasks_stmt = select(TaskModel).where(TaskModel.project_id == result["project_id"])
        tasks_res = await session.execute(tasks_stmt)
        tasks = tasks_res.scalars().all()
        assert len(tasks) >= 3
        break


@pytest.mark.asyncio
async def test_coo_agent_decomposition():
    coo = COOAgent()
    assert coo.name == "COO"
    assert coo.role == "최고운영책임자"
    assert coo.department == "경영진"

    decomp = await coo.decompose_command("차세대 물류 로봇 관제 시스템 구축")
    assert "project_title" in decomp
    assert "project_goal" in decomp
    assert "tasks" in decomp
    assert len(decomp["tasks"]) > 0


def test_coo_schemas():
    task = TaskDecomposition(
        id="T001",
        title="선행 기술 분석",
        assignee="PatentSearchAgent",
        priority="P1"
    )
    assert task.id == "T001"

    schema = COODecompositionSchema(
        project_title="PLC 모니터링",
        project_goal="실시간 공정 감시",
        summary="프로젝트 분해 완료",
        tasks=[task]
    )
    assert schema.project_title == "PLC 모니터링"
    assert len(schema.tasks) == 1
