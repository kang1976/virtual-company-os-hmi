# backend/tests/test_telegram_service.py
import pytest
from backend.app.services.telegram_service import TelegramNotifier, get_telegram_notifier

@pytest.mark.asyncio
async def test_telegram_notifier_unconfigured_fallback():
    notifier = TelegramNotifier(bot_token="", chat_id="")
    assert notifier.is_configured is False
    
    # 미설정 상태에서도 파이프라인이 에러 없이 True로 Mock 완료 처리되어야 함
    success = await notifier.send_message("테스트 메시지")
    assert success is True

@pytest.mark.asyncio
async def test_telegram_notify_command_completed():
    notifier = TelegramNotifier(bot_token="", chat_id="")
    dummy_tasks = [
        {"id": "T001", "title": "특허 조사", "assignee": "PatentSearchAgent", "status": "CLOSED"},
        {"id": "T002", "title": "UI 개발", "assignee": "FrontendAgent", "status": "CLOSED"},
    ]
    coo_audit = {"approved": True, "executive_summary": "품질 100% 만족 승인"}
    
    success = await notifier.notify_command_completed(
        project_id="PRJ-20260919-TEST",
        instruction="스마트 팩토리 PLC 제어 시스템 구축",
        completed_tasks=dummy_tasks,
        coo_audit=coo_audit,
        total_seconds=11.8,
    )
    assert success is True

@pytest.mark.asyncio
async def test_telegram_notify_bottleneck_alert():
    notifier = TelegramNotifier(bot_token="", chat_id="")
    success = await notifier.notify_bottleneck_alert(
        stage_name="4단계 기술개발",
        agent_name="FrontendAgent",
        elapsed_seconds=5.2,
        reason="모바일 뷰포트 고대비 렌더링 지연",
    )
    assert success is True

def test_get_telegram_notifier_singleton():
    n1 = get_telegram_notifier()
    n2 = get_telegram_notifier()
    assert n1 is n2
