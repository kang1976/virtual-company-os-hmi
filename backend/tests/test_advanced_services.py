# backend/tests/test_advanced_services.py
import pytest
from pathlib import Path
from backend.app.services.rag_service import CompanyLedgerRAGService
from backend.app.services.workflow_action import WorkflowActionService
from backend.app.services.web_research import WebResearchService
from backend.app.services.finance_service import FinanceCostService


@pytest.mark.asyncio
async def test_company_ledger_rag_service():
    """LlamaIndex 스타일 로컬 4대 장부 RAG 검색 검증 (0원 무과금)"""
    rag = CompanyLedgerRAGService()
    indexed_count = await rag.reindex_ledgers()
    assert indexed_count >= 0

    # 사내 지식 검색 질의
    results = await rag.search_company_history("특허 PLC 모니터링", limit=3)
    assert isinstance(results, list)
    if results:
        top = results[0]
        assert "score" in top
        assert "title" in top
        assert "snippet" in top


@pytest.mark.asyncio
async def test_workflow_action_service():
    """n8n 스타일 워크플로우 이벤트 디스패처 검증 (0원 무과금)"""
    wf = WorkflowActionService()
    wh = wf.register_webhook("테스트 ERP 웹훅", "https://httpbin.org/post", ["PROJECT_COMPLETED"])
    assert wh["name"] == "테스트 ERP 웹훅"
    assert len(wf.list_webhooks()) == 1

    # 비동기 이벤트 트리거 테스트
    results = await wf.trigger_event("PROJECT_COMPLETED", {"test": "data"})
    assert isinstance(results, list)


@pytest.mark.asyncio
async def test_web_research_service():
    """browser-use 스타일 경량 기술·특허 웹 리서치 검증 (0원 무과금)"""
    research = WebResearchService()
    res = await research.research_technology("PLC 산업용 FINS 제어 프로토콜")
    assert res["status"] == "COMPLETED"
    assert "0원" in res["cost"]
    assert len(res["recommended_patents"]) >= 1


@pytest.mark.asyncio
async def test_finance_cost_service():
    """OpenBB 스타일 금융·원가·환율 분석 툴킷 검증 (0원 무과금)"""
    finance = FinanceCostService()
    rate_info = await finance.get_usd_krw_rate()
    assert rate_info["currency_pair"] == "USD/KRW"
    assert rate_info["rate"] > 1000  # 원달러 환율 유효성
    assert "0원" in rate_info["cost"]

    # 절감액 산출
    budget = await finance.calculate_project_budget(developer_count=9, duration_days=30)
    assert budget["actual_ai_cost"] == 0
    assert budget["actual_subscription_fee"] == 0
    assert budget["estimated_monthly_savings_krw"] > 0
