# backend/app/agents/qa.py
from pydantic import BaseModel
from backend.app.agents.base import BaseAgent

class QAOutputSchema(BaseModel):
    passed: bool
    score: int
    feedback: str
    action_item: str

class QAAgent(BaseAgent):
    """품질 및 신뢰성 검증관 에이전트 (품질팀)"""
    def __init__(self):
        super().__init__("QAAgent", "품질 및 신뢰성 검증관", "품질팀")

    async def verify(self, deliverable: str, criteria: str):
        system_prompt = (
            "너는 제품의 품질을 독립적으로 검증하는 QA 책임 에이전트다. "
            "개발팀의 산출물이 CEO 요구조건과 기술 기준을 충족하는지 엄격히 심사하라."
        )
        prompt = f"산출물:\n{deliverable}\n\n검증 기준: {criteria}\n합격 여부와 결함 리포트를 제출하시오."
        return await self.execute(prompt, system_prompt, QAOutputSchema)
