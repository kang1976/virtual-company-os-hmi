# backend/app/agents/base.py
from typing import Type, Dict, Any
from pydantic import BaseModel
from backend.app.core.llm import LLMClient

class BaseAgent:
    """모든 가상회사 전문 에이전트의 기반 클래스 (BaseAgent)"""
    def __init__(self, name: str, role: str, department: str, model: str = "gemini-2.5-flash"):
        self.name = name
        self.role = role
        self.department = department
        self.model = model
        self.client = LLMClient()

    async def execute(self, prompt: str, system_prompt: str, schema: Type[BaseModel]) -> Dict[str, Any]:
        """주어진 지시(prompt)와 시스템 프롬프트(system_prompt)를 바탕으로 
        지정된 Pydantic schema 형태의 JSON 결과를 LLM 또는 데모 생성기로부터 도출합니다.
        """
        return await self.client.generate_json(prompt, system_prompt, schema, model=self.model)
