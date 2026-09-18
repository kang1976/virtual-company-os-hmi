# backend/app/agents/dev/frontend.py
from typing import List, Optional
from pydantic import BaseModel, Field
from backend.app.agents.base import BaseAgent


class FrontendOutputSchema(BaseModel):
    component_name: str = Field(description="대상 프론트엔드 컴포넌트 또는 화면 명칭")
    design_system: str = Field(description="적용된 디자인 시스템 (색상 팔레트, 타이포그래피, 테마 모드)")
    responsive_layout: str = Field(description="모바일(360~430px) 및 데스크탑 레이아웃 명세")
    deliverable: str = Field(description="UI/UX 인터페이스 설계 및 프론트엔드 구현 코드 산출물")
    accessibility_audit: str = Field(description="웹 접근성(WCAG) 및 터치 인터랙션 적합성 검증 결과")


class FrontendDevAgent(BaseAgent):
    """프론트엔드 및 UI/UX 개발 에이전트 (프론트엔드팀)"""

    def __init__(self):
        super().__init__("FrontendAgent", "프론트엔드 및 UI/UX 개발자", "프론트엔드팀")

    async def develop_ui(
        self, requirement: str, design_guide: Optional[str] = None
    ) -> dict:
        system_prompt = (
            "너는 AI 가상회사의 프론트엔드 및 UI/UX 전문 개발 에이전트다. "
            "사용자의 요구사항과 디자인 가이드라인(반응형 모바일 360~430px, 다크/OLED/라이트 테마 호환, 웹 접근성, 터치 친화성)을 "
            "완벽하게 반영하여 아름답고 직관적이며 오류 없는 프론트엔드 컴포넌트 인터페이스와 코드를 작성하라."
        )
        prompt = (
            f"요구사항: {requirement}\n"
            f"디자인 가이드: {design_guide or '반응형 모바일 우선, 3종 테마 지원, WCAG 준수'}\n"
            f"UI/UX 상세 구현 산출물을 작성하시오."
        )
        return await self.execute(prompt, system_prompt, FrontendOutputSchema)
