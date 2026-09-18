# backend/app/agents/patent/search.py
from pydantic import BaseModel
from backend.app.agents.base import BaseAgent

class PatentOutputSchema(BaseModel):
    technology: str
    search_scope: str
    fto_risk: str
    findings: str
    recommendation: str

class PatentSearchAgent(BaseAgent):
    """선행기술 및 특허 조사관 에이전트 (IP팀)"""
    def __init__(self):
        super().__init__("PatentSearchAgent", "선행기술 및 특허 조사관", "IP팀")

    async def investigate(self, technology: str):
        system_prompt = (
            "너는 기술전문회사의 IP/특허 총괄 전문 에이전트다. "
            "새로운 기술 개발에 앞서 선행 특허 검색, 유사도 비교, FTO(Freedom to Operate) 침해 위험도를 분석하라."
        )
        prompt = f"개발 대상 기술: {technology}\n국내외 특허 현황 및 FTO 위험도를 분석하시오."
        return await self.execute(prompt, system_prompt, PatentOutputSchema)
