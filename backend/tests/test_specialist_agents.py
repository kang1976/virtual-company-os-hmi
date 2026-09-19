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
    SecOpsAuditAgent,
    SecOpsAuditOutputSchema,
    QAAgent,
    QAOutputSchema,
    SeniorQAAgent,
    SeniorQAOutputSchema,
    COOAgent,
    COOApprovalSchema,
    ChiefDesignAgent,
    DesignSpecSchema,
    SoftwareArchitectAgent,
    MobileAppBuilderAgent,
    EmbeddedFirmwareAgent,
    DatabaseOptimizerAgent,
    DevOpsAutomatorAgent,
    CodeReviewerAgent,
    MinimalChangeAgent,
    UIFinishGateAgent,
    UXArchitectAgent,
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
    assert qa_agent.role == "1차 품질 및 기능 검증관"

    senior_qa = SeniorQAAgent()
    assert senior_qa.name == "SeniorQAAgent"
    assert senior_qa.role == "수석 품질 재검증관"

    secops_agent = SecOpsAuditAgent()
    assert secops_agent.name == "SecOpsAuditAgent"
    assert secops_agent.role == "2차 수석 보안 감리관"

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
    assert sec_agent.role == "1차 정보보안 및 취약점 심사관"

    res = await sec_agent.audit("PLC 통신 암호화 및 FastAPI 엔드포인트 코드", tech_stack="Python/FastAPI")
    assert "passed" in res
    assert "security_score" in res
    assert "cve_risk" in res
    assert "recommendations" in res


@pytest.mark.asyncio
async def test_secops_and_senior_qa_agents():
    secops = SecOpsAuditAgent()
    secops_res = await secops.deep_audit(
        primary_sec_report="1차 보안 96점 통과",
        full_code="FastAPI endpoints and PLC FINS drivers"
    )
    assert "passed" in secops_res
    assert "zero_trust_score" in secops_res
    assert "security_clearance" in secops_res
    assert secops_res["zero_trust_score"] >= 90

    senior_qa = SeniorQAAgent()
    qa_res = await senior_qa.reverify(
        primary_qa_report="1차 기능 95점 통과",
        full_code="Full system deliverable",
        instruction="PLC 통신 모니터링"
    )
    assert "passed" in qa_res
    assert "reverification_score" in qa_res
    assert "final_qa_verdict" in qa_res
    assert qa_res["reverification_score"] >= 95



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


@pytest.mark.asyncio
async def test_chief_design_agent():
    designer = ChiefDesignAgent()
    assert designer.name == "ChiefDesignAgent"
    assert designer.role == "디자인 전공 수석 크리에이티브 디렉터"
    assert designer.department == "디자인센터 (Design & Creative Lab)"

    res = await designer.create_design_spec("PLC 관제 대시보드 및 버튼 컴포넌트", theme="VS Code Light Modern")
    assert "palette_name" in res
    assert "primary_cta_spec" in res
    assert "contrast_ratio_audit" in res
    assert "typography_spec" in res
    assert "visual_affordance_rules" in res
    assert "design_approval" in res

    schema = DesignSpecSchema(
        palette_name="VS Code Light High Contrast",
        primary_cta_spec="순백색 텍스트 섀도우 적용",
        contrast_ratio_audit="WCAG AAA 12:1 초과",
        typography_spec="Inter font-extrabold",
        visual_affordance_rules=["버튼 테두리 1px 고대비", "호버 링 인디케이터"],
        design_approval=True
    )
    assert schema.design_approval is True
    assert len(schema.visual_affordance_rules) == 2


@pytest.mark.asyncio
async def test_agency_internalized_engineering_and_design_agents():
    # 1. 아키텍트
    arch = SoftwareArchitectAgent()
    assert arch.name == "SoftwareArchitectAgent"
    arch_res = await arch.design_system("산업용 실시간 PLC 관제 분산 시스템")
    assert "architecture_pattern" in arch_res
    assert "approved" in arch_res

    # 2. 모바일 앱 빌더
    mob = MobileAppBuilderAgent()
    assert mob.name == "MobileAppBuilderAgent"
    mob_res = await mob.build_mobile_spec("Z폴드 듀얼 반응형 및 P2P 직결 통신")
    assert "platform" in mob_res
    assert "touch_affordance_score" in mob_res

    # 3. 임베디드 펌웨어
    emb = EmbeddedFirmwareAgent()
    assert emb.name == "EmbeddedFirmwareAgent"
    emb_res = await emb.design_plc_protocol("Omron CJ2H-EIP")
    assert "protocol" in emb_res
    assert "fail_safe_mechanism" in emb_res

    # 4. 데이터베이스 최적화
    db_opt = DatabaseOptimizerAgent()
    assert db_opt.name == "DatabaseOptimizerAgent"
    db_res = await db_opt.optimize_schema(["tasks", "commands", "projects"])
    assert "indexing_strategy" in db_res

    # 5. 데브옵스/SRE
    devops = DevOpsAutomatorAgent()
    assert devops.name == "DevOpsAutomatorAgent"
    dop_res = await devops.build_pipeline("VirtualCompanyOS")
    assert "pipeline_steps" in dop_res

    # 6. 코드 리뷰어
    reviewer = CodeReviewerAgent()
    assert reviewer.name == "CodeReviewerAgent"
    rev_res = await reviewer.review_pull_request("+ async def run(): pass")
    assert "code_quality_score" in rev_res
    assert "review_approved" in rev_res

    # 7. 최소 수정 패치 전문가
    minimal = MinimalChangeAgent()
    assert minimal.name == "MinimalChangeAgent"
    min_res = await minimal.inspect_patch_scope("버튼 글자 흑화 수정", "- text-black\n+ text-white")
    assert "zero_side_effect_audit" in min_res
    assert "patch_approved" in min_res

    # 8. UI 마감 감리관
    finish_gate = UIFinishGateAgent()
    assert finish_gate.name == "UIFinishGateAgent"
    fg_res = await finish_gate.audit_finish_gate("PLC 관제 대시보드", "border: 1px solid #E5E7EB; text-shadow applied")
    assert "anti_generic_verdict" in fg_res
    assert "gate_approved" in fg_res

    # 9. UX 아키텍트
    ux_arch = UXArchitectAgent()
    assert ux_arch.name == "UXArchitectAgent"
    ux_res = await ux_arch.design_user_flow("원클릭 장부 열람 및 긴급 제어")
    assert "touch_target_guarantee" in ux_res
    assert "responsive_flow_approved" in ux_res



