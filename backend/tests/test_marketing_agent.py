# backend/tests/test_marketing_agent.py
import pytest
from backend.app.agents.marketing import (
    ProductMarketingAgent,
    CatalogOutputSchema,
    ManualOutputSchema,
    CommercialPackageSchema,
)


def test_marketing_agent_attributes():
    agent = ProductMarketingAgent()
    assert agent.name == "ProductMarketingAgent"
    assert agent.role == "제품기획 및 기술문서 마케터"
    assert agent.department == "사업전략·마케팅실"


@pytest.mark.asyncio
async def test_create_catalog():
    agent = ProductMarketingAgent()
    res = await agent.create_catalog(
        product_name="산업용 AI PLC 관제 시스템",
        tech_features="Omron FINS 프로토콜, 모바일 반응형 HMI, 특허 회피 독자 비동기 큐, 제로트러스트 보안",
        target_audience="스마트팩토리 제조사",
    )
    assert "catalog_title" in res
    assert "target_market" in res
    assert isinstance(res.get("usp_highlights"), list)
    assert len(res.get("usp_highlights")) > 0
    assert "brochure_markdown" in res


@pytest.mark.asyncio
async def test_create_manual():
    agent = ProductMarketingAgent()
    res = await agent.create_manual(
        product_name="산업용 AI PLC 관제 시스템",
        components="FastAPI 백엔드, React 관제 UI, PLC FINS 소켓 서버",
        operation_guide="원클릭 설치 및 브라우저 접속, FINS 통신 설정",
    )
    assert "manual_title" in res
    assert "quick_start_guide" in res
    assert "ui_operation_guide" in res
    assert "plc_connection_guide" in res
    assert "troubleshooting_faq" in res
    assert "manual_markdown" in res


@pytest.mark.asyncio
async def test_produce_commercial_package():
    agent = ProductMarketingAgent()
    res = await agent.produce_commercial_package(
        product_name="산업용 AI PLC 관제 시스템",
        deliverables_summary="FastAPI 백엔드 및 React 관제 대시보드 완비, 제로트러스트 보안 통과",
    )
    assert "product_name" in res
    assert "catalog" in res
    assert "manual" in res
    assert "marketing_summary" in res
