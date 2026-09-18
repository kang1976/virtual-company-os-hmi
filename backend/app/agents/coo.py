# backend/app/agents/coo.py
from typing import List
from pydantic import BaseModel
from backend.app.agents.base import BaseAgent


class TaskDecomposition(BaseModel):
    id: str
    title: str
    assignee: str
    priority: str


class COODecompositionSchema(BaseModel):
    project_title: str
    project_goal: str
    summary: str
    tasks: List[TaskDecomposition]


class COOAgent(BaseAgent):
    def __init__(self):
        super().__init__("COO", "최고운영책임자", "경영진")

    async def decompose_command(self, instruction: str):
        system_prompt = (
            "너는 AI 가상회사의 최고운영책임자(COO)다. "
            "CEO의 지시를 분석하여 프로젝트를 발의하고, 특허조사(PatentSearchAgent), 개발(BackendAgent), 품질검증(QAAgent)으로 세분화하라."
        )
        return await self.execute(instruction, system_prompt, COODecompositionSchema)
