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


class SecurityAgent(BaseAgent):
    """보안팀 전문 에이전트 (CISO / 보안 심사관)
    
    개발 산출물의 OWASP Top 10, 입력값 검증, 암호화, API 접근통제, CVE 취약점을 엄격히 심사합니다.
    """

    def __init__(self):
        super().__init__(
            name="SecurityAgent",
            role="정보보안 및 취약점 심사관",
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
