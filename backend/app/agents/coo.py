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


class COOApprovalSchema(BaseModel):
    approved: bool
    executive_summary: str
    checked_items: List[str]
    directive_feedback: str


class COOAgent(BaseAgent):
    def __init__(self):
        super().__init__("COO", "최고운영책임자", "경영진")

    async def decompose_command(self, instruction: str):
        system_prompt = (
            "너는 AI 가상회사의 최고운영책임자(COO)다. "
            "CEO의 지시를 분석하여 프로젝트를 발의하고, "
            "특허조사(PatentSearchAgent), 프론트엔드/UI개발(FrontendAgent), 백엔드시스템(BackendAgent), "
            "정보보안심사(SecurityAgent), 독립품질검증(QAAgent)으로 세분화하라."
        )
        return await self.execute(instruction, system_prompt, COODecompositionSchema)

    async def verify_final_quality(
        self, instruction: str, deliverables_summary: dict
    ) -> dict:
        """각 전문 에이전트들의 산출물이 누락 없이 제대로 완료되었는지 총괄 품질 종합 감사(Quality Gate) 수행"""
        system_prompt = (
            "너는 AI 가상회사의 최고운영책임자(COO)다. "
            "CEO의 원래 지시사항과 각 전문 에이전트(선행특허 FTO, 프론트엔드 UI/UX, 백엔드 시스템, 보안 심사, QA 검증)의 산출물을 종합 감사하라. "
            "모든 공정이 결함 없이 충족되었는지 엄격하게 품질검수하여 최종 승인 여부(approved: True/False)와 경영진 보고서(executive_summary, checked_items, directive_feedback)를 작성하라."
        )
        deliverables_str = "\n".join(
            f"- [{k}]: {v}" for k, v in deliverables_summary.items()
        )
        prompt = (
            f"CEO 지시사항: {instruction}\n"
            f"각 부서별 산출물 현황:\n{deliverables_str}\n"
            f"전사 최종 품질 종합 감사를 수행하고 승인 결과를 도출하시오."
        )
        return await self.execute(prompt, system_prompt, COOApprovalSchema)
