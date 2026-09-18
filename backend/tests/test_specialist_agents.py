# backend/tests/test_specialist_agents.py
import pytest
from backend.app.agents import (
    PatentSearchAgent,
    PatentOutputSchema,
    BackendDevAgent,
    DevOutputSchema,
    FrontendDevAgent,
    FrontendOutputSchema,
    SecurityAgent,
    SecurityOutputSchema,
    QAAgent,
    QAOutputSchema,
    COOAgent,
    COOApprovalSchema,
)

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

def test_specialist_agent_attributes_and_exports():
    patent_agent = PatentSearchAgent()
    assert patent_agent.name == "PatentSearchAgent"
    assert patent_agent.department == "IP팀"
    assert patent_agent.role == "선행기술 및 특허 조사관"

    dev_agent = BackendDevAgent()
    assert dev_agent.name == "BackendAgent"
    assert dev_agent.department == "개발팀"
    assert dev_agent.role == "백엔드 및 시스템 개발자"

    qa_agent = QAAgent()
    assert qa_agent.name == "QAAgent"
    assert qa_agent.department == "품질팀"
    assert qa_agent.role == "품질 및 신뢰성 검증관"

def test_specialist_agent_schemas():
    pat_data = PatentOutputSchema(
        technology="PLC Ethernet",
        search_scope="KR, US",
        fto_risk="LOW",
        findings="회피 가능",
        recommendation="독자 프로토콜 적용"
    )
    assert pat_data.fto_risk == "LOW"

    dev_data = DevOutputSchema(
        module_name="PLC Server",
        deliverable="Socket Server Code",
        architecture_summary="Asyncio Event Loop"
    )
    assert dev_data.module_name == "PLC Server"

    qa_data = QAOutputSchema(
        passed=True,
        score=95,
        feedback="우수",
        action_item="배포 승인"
    )
    assert qa_data.passed is True
    assert qa_data.score == 95

    sec_data = SecurityOutputSchema(
        passed=True,
        security_score=98,
        vulnerabilities=["하드코딩된 시크릿 없음", "TLS 1.3 암호화 적용"],
        cve_risk="LOW",
        recommendations="주기적 토큰 로테이션 권고"
    )
    assert sec_data.passed is True
    assert sec_data.security_score == 98
    assert sec_data.cve_risk == "LOW"


@pytest.mark.asyncio
async def test_security_agent_audit():
    sec_agent = SecurityAgent()
    assert sec_agent.name == "SecurityAgent"
    assert sec_agent.department == "보안팀"
    assert sec_agent.role == "정보보안 및 취약점 심사관"

    res = await sec_agent.audit("PLC 통신 암호화 및 FastAPI 엔드포인트 코드", tech_stack="Python/FastAPI")
    assert "passed" in res
    assert "security_score" in res
    assert "cve_risk" in res
    assert "recommendations" in res


@pytest.mark.asyncio
async def test_frontend_dev_agent():
    front_agent = FrontendDevAgent()
    assert front_agent.name == "FrontendAgent"
    assert front_agent.department == "프론트엔드팀"
    assert front_agent.role == "프론트엔드 및 UI/UX 개발자"

    res = await front_agent.develop_ui(
        "모바일 반응형 전체화면 관제 콘솔 및 테마 스위처",
        design_guide="모바일 터치 44px, 3종 테마 지원"
    )
    assert "component_name" in res
    assert "design_system" in res
    assert "responsive_layout" in res
    assert "deliverable" in res
    assert "accessibility_audit" in res

    schema_obj = FrontendOutputSchema(
        component_name="Navbar & Dashboard",
        design_system="사이버 다크 테마",
        responsive_layout="모바일 360px 대응",
        deliverable="export function Dashboard() { return <div>UI</div>; }",
        accessibility_audit="WCAG 2.1 통과"
    )
    assert schema_obj.component_name == "Navbar & Dashboard"


@pytest.mark.asyncio
async def test_coo_verify_final_quality():
    coo = COOAgent()
    sample_deliverables = {
        "PatentSearchAgent": "FTO 회피설계 권고안",
        "FrontendAgent": "모바일 반응형 UI 컴포넌트",
        "BackendAgent": "FastAPI 백엔드 API",
        "SecurityAgent": "OWASP 보안 점수 96점 통과",
        "QAAgent": "독립 품질 검증 100% 통과",
    }
    res = await coo.verify_final_quality("모바일 UI 및 보안 검수 지시", sample_deliverables)
    assert "approved" in res
    assert res["approved"] is True
    assert "executive_summary" in res
    assert "checked_items" in res
    assert len(res["checked_items"]) > 0
    assert "directive_feedback" in res

    approval_obj = COOApprovalSchema(
        approved=True,
        executive_summary="전 부문 합격",
        checked_items=["특허 확인", "UI 확인", "보안 확인"],
        directive_feedback="승인 완료"
    )
    assert approval_obj.approved is True

