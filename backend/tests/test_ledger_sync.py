# backend/tests/test_ledger_sync.py
import json
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
        "priority": "P1",
    }
    await service.sync_command(cmd_data)

    cmd_md_file = settings.LEDGER_DIR / "COMMAND_LOG" / "CMD-20260918-001.md"
    assert cmd_md_file.exists()
    content = cmd_md_file.read_text(encoding="utf-8")
    assert "CMD-20260918-001" in content
    assert "PLC 모니터링 시스템 착수" in content

    cmd_json_file = settings.LEDGER_DIR / "COMMAND_LOG" / "CMD-20260918-001.json"
    assert cmd_json_file.exists()
    json_content = json.loads(cmd_json_file.read_text(encoding="utf-8"))
    assert json_content["id"] == "CMD-20260918-001"
    assert json_content["instruction"] == "PLC 모니터링 시스템 착수"


@pytest.mark.asyncio
async def test_ledger_sync_task_ledger():
    service = LedgerSyncService()
    settings = get_settings()

    project_id = "PRJ-001"
    tasks = [
        {
            "id": "TSK-001",
            "title": "아키텍처 설계",
            "assignee": "CTO",
            "priority": "P1",
            "status": "WORKING",
        },
        {
            "id": "TSK-002",
            "title": "특허 조사",
            "assignee": "CPO",
            "priority": "P2",
            "status": "SUBMITTED",
        },
    ]

    await service.sync_task_ledger(project_id, tasks)

    task_json_file = settings.LEDGER_DIR / "TASK_LEDGER" / f"{project_id}-tasks.json"
    assert task_json_file.exists()
    json_data = json.loads(task_json_file.read_text(encoding="utf-8"))
    assert len(json_data) == 2
    assert json_data[0]["id"] == "TSK-001"

    task_md_file = settings.LEDGER_DIR / "TASK_LEDGER" / f"{project_id}-tasks.md"
    assert task_md_file.exists()
    md_content = task_md_file.read_text(encoding="utf-8")
    assert f"# TASK LEDGER — {project_id}" in md_content
    assert "TSK-001" in md_content
    assert "🔵 WORKING" in md_content
    assert "🟡 SUBMITTED" in md_content


@pytest.mark.asyncio
async def test_ledger_sync_patent_log():
    service = LedgerSyncService()
    settings = get_settings()

    patent_data = {
        "id": "PAT-20260918-001",
        "project_id": "PRJ-001",
        "technology": "PLC 모니터링 엣지 AI",
        "search_scope": "KR/US/EP",
        "fto_risk": "LOW",
        "findings": "유사 특허 3건 분석 결과 청구항 회피 가능 확인",
        "recommendation": "엣지 전처리 알고리즘을 독자 설계하여 회피할 것",
    }

    await service.sync_patent_log(patent_data)

    patent_md_file = settings.LEDGER_DIR / "KNOWLEDGE_PATENT" / "PAT-20260918-001.md"
    assert patent_md_file.exists()
    content = patent_md_file.read_text(encoding="utf-8")
    assert "PAT-20260918-001" in content
    assert "PLC 모니터링 엣지 AI" in content
    assert "LOW" in content
    assert "유사 특허 3건 분석 결과" in content


@pytest.mark.asyncio
async def test_ledger_sync_concurrent_writes():
    import asyncio

    service = LedgerSyncService()
    settings = get_settings()

    async def write_cmd(idx: int):
        cmd = {
            "id": f"CMD-CONCURRENT-{idx:03d}",
            "project_id": "PRJ-CONCURRENT",
            "sender": "CEO",
            "recipient": "CTO",
            "instruction": f"동시성 지시 {idx}",
            "priority": "P1",
        }
        await service.sync_command(cmd)

    # 10 concurrent writes
    await asyncio.gather(*(write_cmd(i) for i in range(10)))

    for i in range(10):
        md_file = settings.LEDGER_DIR / "COMMAND_LOG" / f"CMD-CONCURRENT-{i:03d}.md"
        json_file = settings.LEDGER_DIR / "COMMAND_LOG" / f"CMD-CONCURRENT-{i:03d}.json"
        assert md_file.exists()
        assert json_file.exists()
        assert f"동시성 지시 {i}" in md_file.read_text(encoding="utf-8")
        md_file.unlink(missing_ok=True)
        json_file.unlink(missing_ok=True)

