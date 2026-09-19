# backend/app/agents/design.py
from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from backend.app.agents.base import BaseAgent


class DesignSpecSchema(BaseModel):
    palette_name: str = Field(description="고대비 디자인 팔레트 명칭")
    primary_cta_spec: str = Field(description="주요 액션 버튼 시인성 및 텍스트 섀도우 규격")
    contrast_ratio_audit: str = Field(description="WCAG AAA 7:1 이상 명암비 전수 실측 결과")
    typography_spec: str = Field(description="폰트 굵기(font-extrabold), 자간 및 가독성 최적화 명세")
    visual_affordance_rules: List[str] = Field(description="버튼 및 패널 시각적 인지성(Affordance) 5대 필수 규칙")
    design_approval: bool = Field(description="디자인 전공 수석 디렉터 최종 승인 여부 (True: 통과)")


class ChiefDesignAgent(BaseAgent):
    """디자인 전공 수석 크리에이티브 디렉터 (디자인센터 Chief UI/UX Designer)"""

    def __init__(self):
        super().__init__(
            "ChiefDesignAgent",
            "디자인 전공 수석 크리에이티브 디렉터",
            "디자인센터 (Design & Creative Lab)",
        )

    async def create_design_spec(
        self, screen_name: str, theme: str = "고대비 라이트/다크 듀얼"
    ) -> dict:
        system_prompt = (
            "너는 일류 디자인 전공 출신의 수석 크리에이티브 디렉터(Chief UI/UX Designer)다. "
            "사용자가 어떤 환경(밝은 야외, 어두운 관제실)에서도 글자와 버튼을 한눈에 명확히 인지할 수 있도록 "
            "색채 심리학, 타이포그래피 위계, WCAG AAA 7:1 명암비, 텍스트 섀도우를 완벽히 설계하라."
        )
        prompt = (
            f"대상 화면: {screen_name}\n"
            f"테마 환경: {theme}\n"
            f"버튼과 텍스트가 눈에 확 띄도록 만드는 초고대비 디자인 가이드라인을 수립하시오."
        )
        return await self.execute(prompt, system_prompt, DesignSpecSchema)
