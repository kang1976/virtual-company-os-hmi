# backend/app/agents/dev/backend.py
from pydantic import BaseModel
from backend.app.agents.base import BaseAgent

class DevOutputSchema(BaseModel):
    module_name: str
    deliverable: str
    architecture_summary: str

class BackendDevAgent(BaseAgent):
    """백엔드 및 시스템 개발자 에이전트 (개발팀)"""
    def __init__(self):
        super().__init__("BackendAgent", "백엔드 및 시스템 개발자", "개발팀")

    async def develop(self, requirement: str, patent_findings: str):
        system_prompt = (
            "너는 백엔드 시스템 전문 개발 에이전트다. "
            "특허 조사팀의 회피 설계 권고사항을 준수하여 안정적이고 성능이 우수한 시스템 사양 및 코드를 작성하라."
        )
        prompt = f"요구사항: {requirement}\n특허 유의사항: {patent_findings}\n구현 상세 산출물을 작성하시오."
        return await self.execute(prompt, system_prompt, DevOutputSchema)
