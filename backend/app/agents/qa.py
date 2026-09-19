# backend/app/agents/qa.py
from pydantic import BaseModel
from backend.app.agents.base import BaseAgent

class QAOutputSchema(BaseModel):
    passed: bool
    score: int
    feedback: str
    action_item: str


class SeniorQAOutputSchema(BaseModel):
    passed: bool
    reverification_score: int
    deep_audit_items: list[str]
    stress_test_result: str
    detailed_findings: str
    final_qa_verdict: str


class QAAgent(BaseAgent):
    """1차 품질 및 기능 규격 검증관 에이전트 (품질팀)"""
    def __init__(self):
        super().__init__("QAAgent", "1차 품질 및 기능 검증관", "품질팀")

    async def verify(self, deliverable: str, criteria: str):
        system_prompt = (
            "너는 제품의 품질을 독립적으로 1차 검증하는 QA 책임 에이전트다. "
            "개발팀의 산출물이 CEO 요구조건과 기본 기술 규격을 충족하는지 엄격히 심사하라."
        )
        prompt = f"산출물:\n{deliverable}\n\n검증 기준: {criteria}\n합격 여부와 결함 리포트를 제출하시오."
        return await self.execute(prompt, system_prompt, QAOutputSchema)


class SeniorQAAgent(BaseAgent):
    """2차 수석 품질 재검증관 에이전트 (품질보증위원회 수석 검증관)
    
    1차 QA 통과 항목에 대한 무작위 엣지 케이스 샘플링, 극한 부하 및 지연 스트레스 테스트,
    회귀 결함 정밀 실측을 수행하여 디테일한 2차 최종 품질 인증을 부여합니다.
    """
    def __init__(self):
        super().__init__("SeniorQAAgent", "수석 품질 재검증관", "품질팀")

    async def reverify(self, primary_qa_report: str, full_code: str, instruction: str):
        system_prompt = (
            "당신은 가상기업의 수석 품질 재검증관(Lead Senior QA) SeniorQAAgent입니다. "
            "1차 QA 검증 결과에 안주하지 않고, 엣지 케이스(Boundary Value), 실시간 반응성(Latency), "
            "다중 클라이언트 동시성, 비정상 입력값 처리 및 장애 복구력을 디테일하게 현미경 재검증하십시오."
        )
        prompt = (
            f"CEO 본 지시사항: {instruction}\n\n"
            f"[1차 QA 검증 리포트]:\n{primary_qa_report}\n\n"
            f"[전체 시스템 코드 및 산출물]:\n{full_code}\n\n"
            "위 내역에 대해 2차 디테일 정밀 재검증 및 스트레스 테스트를 수행하고 최종 재검증 인증 결과를 제출하십시오."
        )
        return await self.execute(prompt, system_prompt, SeniorQAOutputSchema)

