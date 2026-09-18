# backend/tests/test_models.py
import pytest
from sqlalchemy import select
from backend.app.models.schemas import (
    TaskStatus,
    Priority,
    CommandCreate,
    TaskCreate,
    TaskResponse,
    ProjectCreate,
)
from backend.app.models.db import (
    init_db,
    get_db,
    ProjectModel,
    CommandModel,
    TaskModel,
    MeetingModel,
    PatentRecordModel,
)


@pytest.mark.asyncio
async def test_create_project_and_task_in_db():
    await init_db()
    async for session in get_db():
        # Ensure test isolation / idempotency across multiple test runs
        existing_task = await session.get(TaskModel, "PRJ-20260918-001-T001")
        if existing_task:
            await session.delete(existing_task)
        existing_proj = await session.get(ProjectModel, "PRJ-20260918-001")
        if existing_proj:
            await session.delete(existing_proj)
        await session.commit()

        project = ProjectModel(
            id="PRJ-20260918-001",
            title="PLC 모니터링 시스템 구축",
            description="공장 설비 실시간 감시 시스템 개발",
            status="ACTIVE",
        )
        session.add(project)
        await session.commit()

        task = TaskModel(
            id="PRJ-20260918-001-T001",
            project_id=project.id,
            title="PLC 통신 프로토콜 조사",
            assignee="PatentSearchAgent",
            priority=Priority.P1.value,
            status=TaskStatus.WORKING.value,
        )
        session.add(task)
        await session.commit()

        result = await session.execute(select(TaskModel).where(TaskModel.id == task.id))
        saved_task = result.scalar_one_or_none()
        assert saved_task is not None
        assert saved_task.status == TaskStatus.WORKING.value


@pytest.mark.asyncio
async def test_all_models_crud_operations():
    await init_db()
    async for session in get_db():
        # Cleanup
        for model, item_id in [
            (CommandModel, "CMD-20260918-001"),
            (MeetingModel, "MTG-20260918-001"),
            (PatentRecordModel, "PAT-20260918-001"),
        ]:
            existing = await session.get(model, item_id)
            if existing:
                await session.delete(existing)
        await session.commit()

        # CommandModel
        cmd = CommandModel(
            id="CMD-20260918-001",
            project_id="PRJ-20260918-001",
            instruction="긴급 특허 동향 분석 보고서 작성",
        )
        session.add(cmd)

        # MeetingModel
        meeting = MeetingModel(
            id="MTG-20260918-001",
            project_id="PRJ-20260918-001",
            title="아키텍처 킥오프 회의",
            attendees="CEO, COO, ArchitectAgent",
            agenda="PLC 데이터 수집 파이프라인 설계",
            decisions="Modbus TCP 프로토콜 우선 지원",
        )
        session.add(meeting)

        # PatentRecordModel
        patent = PatentRecordModel(
            id="PAT-20260918-001",
            project_id="PRJ-20260918-001",
            technology="Modbus TCP 실시간 모니터링",
            search_scope="KR/US/EP",
            fto_risk="LOW",
            findings="선행 특허 3건 검토 완료, 침해 위험 낮음",
        )
        session.add(patent)

        await session.commit()

        # Verify saved records
        saved_cmd = (
            await session.execute(select(CommandModel).where(CommandModel.id == cmd.id))
        ).scalar_one_or_none()
        assert saved_cmd is not None
        assert saved_cmd.sender == "CEO"
        assert saved_cmd.recipient == "COO"
        assert saved_cmd.status == "PROCESSING"

        saved_meeting = (
            await session.execute(select(MeetingModel).where(MeetingModel.id == meeting.id))
        ).scalar_one_or_none()
        assert saved_meeting is not None
        assert "Modbus TCP" in saved_meeting.decisions

        saved_patent = (
            await session.execute(select(PatentRecordModel).where(PatentRecordModel.id == patent.id))
        ).scalar_one_or_none()
        assert saved_patent is not None
        assert saved_patent.fto_risk == "LOW"


def test_pydantic_schemas():
    cmd_dto = CommandCreate(instruction="시장 분석 지시")
    assert cmd_dto.target_team == "전체"

    task_dto = TaskCreate(
        id="T001",
        project_id="P001",
        title="시장 조사",
        assignee="MarketAgent",
        priority=Priority.P0,
        status=TaskStatus.IDLE,
    )
    assert task_dto.priority == Priority.P0
    assert task_dto.status == TaskStatus.IDLE

    resp_dto = TaskResponse(
        id=task_dto.id,
        project_id=task_dto.project_id,
        title=task_dto.title,
        assignee=task_dto.assignee,
        priority=task_dto.priority.value,
        status=task_dto.status.value,
    )
    assert resp_dto.id == "T001"

    proj_dto = ProjectCreate(title="신규 프로젝트", description="프로젝트 설명")
    assert proj_dto.title == "신규 프로젝트"
