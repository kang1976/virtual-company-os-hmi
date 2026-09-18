# backend/tests/test_llm.py
import pytest
from typing import List
from pydantic import BaseModel
from backend.app.core.llm import LLMClient
from backend.app.agents.base import BaseAgent

class MockSchema(BaseModel):
    summary: str
    decision: str

class ComplexSchema(BaseModel):
    summary: str
    tasks: List[dict]
    fto_risk: str
    passed: bool
    findings: str
    deliverable: str
    feedback: str
    recommendation: str

@pytest.mark.asyncio
async def test_llm_client_mock_generation():
    client = LLMClient()
    result = await client.generate_json(
        prompt="현재 상태 분석",
        system_prompt="너는 분석관이다",
        schema=MockSchema
    )
    assert isinstance(result, dict)
    assert "summary" in result
    assert "decision" in result
    assert "현재 상태 분석" in result["summary"]

@pytest.mark.asyncio
async def test_llm_client_mock_complex_fields():
    client = LLMClient()
    result = await client.generate_json(
        prompt="특허 및 시스템 검토 지시",
        system_prompt="가상회사 시스템",
        schema=ComplexSchema
    )
    assert isinstance(result, dict)
    assert len(result["tasks"]) == 4
    assert result["fto_risk"] == "LOW"
    assert result["passed"] is True
    assert "선행 특허" in result["findings"]
    assert "PLC" in result["deliverable"]
    assert "100%" in result["feedback"]
    assert "회피" in result["recommendation"]

@pytest.mark.asyncio
async def test_base_agent_execute():
    agent = BaseAgent(name="TestAgent", role="Analyst", department="Strategy")
    assert agent.name == "TestAgent"
    assert agent.role == "Analyst"
    assert agent.department == "Strategy"

    result = await agent.execute(
        prompt="전략 보고서 작성",
        system_prompt="너는 전략가이다",
        schema=MockSchema
    )
    assert isinstance(result, dict)
    assert "summary" in result
    assert "decision" in result

@pytest.mark.asyncio
async def test_llm_client_fallback_on_api_error(monkeypatch):
    from unittest.mock import MagicMock
    client = LLMClient()
    client.gemini_key = "fake_api_key"

    # Mock genai.Client to raise an exception
    mock_genai = MagicMock()
    mock_genai.Client.side_effect = RuntimeError("API Quota exceeded or network failure")
    monkeypatch.setattr("google.genai.Client", mock_genai.Client)

    result = await client.generate_json(
        prompt="위기 상황 대응 계획",
        system_prompt="너는 위기관리자이다",
        schema=MockSchema
    )
    assert isinstance(result, dict)
    assert "summary" in result
    assert "decision" in result
    assert "위기 상황 대응 계획" in result["summary"]

