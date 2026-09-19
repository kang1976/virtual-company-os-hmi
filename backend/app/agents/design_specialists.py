# backend/app/agents/design_specialists.py
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from backend.app.agents.base import BaseAgent


# 1. UI 마감 감리관 (UIFinishGateAgent) - Anti-Generic Finish Gate
class FinishGateAuditSchema(BaseModel):
    anti_generic_verdict: str = Field(description="템플릿 복붙 방지 및 고유 브랜드 정체성 평가 (PASS / FAIL)")
    design_contract_compliance: bool = Field(description="1px 보더, 텍스트 섀도우, 명암비 계약 준수 여부")
    visual_polish_score: int = Field(description="시각적 완성도 점수 (1~100)")
    clipping_and_overflow_defects: int = Field(description="텍스트 하단 잘림, 오버플로우 결함 건수 (0건 필수)")
    gate_approved: bool = Field(description="최종 출시 마감 승인 여부 (True: 배포 승인)")


class UIFinishGateAgent(BaseAgent):
    """배포 전 뭉개지거나 뻔한 UI를 엄격히 걸러내는 출시 마감 게이트키퍼 (Anti-Generic UI Finish Gate)"""

    def __init__(self):
        super().__init__(
            "UIFinishGateAgent",
            "UI 출시 마감 감리관 (UI Finish-Gate Reviewer)",
            "디자인센터 (Design & Creative Lab)",
        )

    async def audit_finish_gate(self, screen_name: str, css_summary: str) -> dict:
        system_prompt = (
            "너는 전 세계 최고 수준의 엄격한 UI 마감 감리관이다. "
            "템플릿을 대충 베낀 뻔한 UI(Anti-Generic)를 엄벌하고, 텍스트 하단 잘림(Descender Clipping), "
            "1px 테두리 구획감, 고대비 버튼 시인성 및 디자인 계약(Design Contract)을 철저히 검증하라."
        )
        prompt = (
            f"검수 대상 화면: {screen_name}\n"
            f"적용된 CSS 스타일 요약:\n{css_summary}\n"
            f"출시 마감 게이트 심사를 수행하고 판정서를 발급하시오."
        )
        return await self.execute(prompt, system_prompt, FinishGateAuditSchema)


# 2. UX 정보구조 아키텍트 (UXArchitectAgent)
class UXArchitectureSchema(BaseModel):
    touch_target_guarantee: str = Field(description="모바일/PDA 최소 44px 터치 영역 보장 규격")
    information_hierarchy: List[str] = Field(description="시선 흐름에 따른 1차, 2차, 3차 정보 계층 구조")
    cognitive_load_score: int = Field(description="인지 부하 지수 (낮을수록 우수, 1~100)")
    responsive_flow_approved: bool = Field(description="모바일 ↔ 태블릿 ↔ 데스크탑 반응형 흐름 승인 여부")


class UXArchitectAgent(BaseAgent):
    """사용자 경험 아키텍처, 44px 터치 어포던스 및 개발자 친화적 CSS 시스템 설계 전문가"""

    def __init__(self):
        super().__init__(
            "UXArchitectAgent",
            "UX 아키텍트 (UX Architect)",
            "디자인센터 (Design & Creative Lab)",
        )

    async def design_user_flow(self, workflow_name: str) -> dict:
        system_prompt = (
            "너는 소프트웨어 UX 정보구조 아키텍트다. 사용자가 생각할 필요 없이 직관적으로 반응하는 "
            "44px 터치 타깃, 엄격한 시선 동선(Eye-tracking), 모바일 360px 완벽 반응형 흐름을 설계하라."
        )
        prompt = f"워크플로우: {workflow_name}\n사용자 동선 및 UX 정보구조를 수립하시오."
        return await self.execute(prompt, system_prompt, UXArchitectureSchema)
