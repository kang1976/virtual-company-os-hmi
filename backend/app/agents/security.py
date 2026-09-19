# backend/app/agents/security.py
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from backend.app.agents.base import BaseAgent


class SecurityOutputSchema(BaseModel):
    passed: bool = Field(description="보안 심사 적합 여부 (True/False)")
    security_score: int = Field(description="종합 보안 평가 점수 (0~100점)")
    vulnerabilities: List[str] = Field(description="식별된 보안 취약점 또는 점검 항목 목록")
    cve_risk: str = Field(description="CVE 및 오픈소스 의존성 위험도 (LOW, MEDIUM, HIGH, CRITICAL)")
    recommendations: str = Field(description="보안 조치 및 취약점 개선 권고사항")


class SecOpsAuditOutputSchema(BaseModel):
    passed: bool = Field(description="2차 심층 보안 감리 적합 여부 (True/False)")
    zero_trust_score: int = Field(description="제로트러스트 및 산업제어망 무결성 점수 (0~100점)")
    deep_pen_test_items: List[str] = Field(description="심층 모의침투 및 통신 무결성 감사 항목")
    ot_plc_security_risk: str = Field(description="산업제어망(OT/PLC FINS) 보안 위험도 (LOW, MEDIUM, HIGH)")
    compliance_findings: str = Field(description="정보보호 컴플라이언스 및 제로데이 감사 소견")
    security_clearance: str = Field(description="최종 보안 인가 상태 (CLEARED / REJECTED)")


class SecurityAgent(BaseAgent):
    """1차 보안팀 전문 에이전트 (CISO / 보안 심사관)
    
    개발 산출물의 OWASP Top 10, 입력값 검증, 암호화, API 접근통제, CVE 취약점을 엄격히 심사합니다.
    """

    def __init__(self):
        super().__init__(
            name="SecurityAgent",
            role="1차 정보보안 및 취약점 심사관",
            department="보안팀"
        )

    async def audit(self, deliverable: str, tech_stack: str = "FastAPI/React") -> Dict[str, Any]:
        system_prompt = f"""당신은 기술회사의 최고정보보안책임자(CISO) 산하 전문 보안 심사관 {self.name}입니다.
역할: {self.role} ({self.department})

[보안 심사 지침]
1. 제출된 산출물(코드, 아키텍처 사양서)에 대해 다음 항목을 정밀 진단하십시오:
   - SQL Injection, XSS, SSRF 등 입력값 검증 및 인젝션 방어
   - 전송 구간 및 저장 데이터 암호화 (TLS 1.3, AES-256)
   - 민감정보(API 키, 토큰, 비밀번호) 하드코딩 노출 여부
   - 의존성 패키지 및 기술 스택({tech_stack})의 알려진 CVE 취약점
   - API 엔드포인트 인증 및 인가(RBAC) 체계
2. 심사 결과는 보안 점수(0~100), CVE 위험도, 점검된 항목 목록, 개선 권고사항을 명확히 제시하십시오.
3. 85점 이상이고 치명적 취약점이 없을 경우에만 passed=True로 승인하십시오.
"""
        user_prompt = f"""[보안 심사 대상 산출물]
{deliverable}

[적용 기술 스택]
{tech_stack}

위 산출물에 대한 전방위 보안 및 취약점 심사를 수행하십시오."""
        return await self.execute(user_prompt, system_prompt, SecurityOutputSchema)


class SecOpsAuditAgent(BaseAgent):
    """2차 수석 보안 감리관 에이전트 (DevSecOps 수석 감사관)
    
    1차 보안 심사를 거친 산출물에 대해 산업제어망(OT/PLC) FINS 통신 패킷 위변조,
    제로 트러스트 권한 탈취 방어, 메모리 오버플로우, 침해사고 모의 침투를 심층 감리합니다.
    """

    def __init__(self):
        super().__init__(
            name="SecOpsAuditAgent",
            role="2차 수석 보안 감리관",
            department="보안팀"
        )

    async def deep_audit(self, primary_sec_report: str, full_code: str, tech_stack: str = "FastAPI/React/PLC") -> Dict[str, Any]:
        system_prompt = f"""당신은 가상기업의 최고 보안 감리관(Lead Security Auditor) {self.name}입니다.
역할: {self.role} ({self.department})

[2차 심층 보안 감리 지침]
1. 1차 보안 심사 결과에 안주하지 않고, 제로 트러스트(Zero-Trust) 모델 및 산업제어망(OT) 특화 위협을 현미경 재심사하십시오:
   - 산업용 PLC(FINS) 통신 패킷 스니핑/Replay Attack 방어 무결성
   - 런타임 권한 상승(Privilege Escalation) 및 세션 하이재킹 모의 침투
   - 메모리 오염, 버퍼 오버플로우, 시크릿 키 유출 여부
   - OWASP ASVS Level 3 기준 최고 등급의 엄격한 재검증
2. 최종 판정에서 90점 이상이고 제로트러스트 요건을 만족할 때만 security_clearance='CLEARED'를 부여하십시오.
"""
        user_prompt = f"""[1차 보안 심사 리포트]:
{primary_sec_report}

[전체 시스템 산출물 및 제어망 아키텍처]:
{full_code}

위 내역에 대해 2차 수석 보안 감리 및 심층 모의 침투 감리를 수행하십시오."""
        return await self.execute(user_prompt, system_prompt, SecOpsAuditOutputSchema)

