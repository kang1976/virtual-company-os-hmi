# backend/tests/test_specialist_agents.py
import pytest
from backend.app.agents import (
    PatentSearchAgent,
    PatentOutputSchema,
    BackendDevAgent,
    DevOutputSchema,
    SecurityAgent,
    SecurityOutputSchema,
    QAAgent,
    QAOutputSchema,
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
