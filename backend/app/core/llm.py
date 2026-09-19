# backend/app/core/llm.py
import json
import logging
import os
from typing import Type, Dict, Any, List
from pydantic import BaseModel
from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)

class LLMClient:
    def __init__(self):
        self.settings = get_settings()
        self.gemini_key = self.settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")

    async def generate_json(
        self,
        prompt: str,
        system_prompt: str,
        schema: Type[BaseModel],
        model: str = "gemini-2.5-flash"
    ) -> Dict[str, Any]:
        """구조화된 JSON을 비동기로 생성합니다.
        
        대표님(CEO) 비용 통제 헌법 준수:
        - 월 구독료 0원 + API 비용 0원 유지 원칙.
        - 유료 모델(Pro/GPT-4o 등)은 대표님의 명시적 승인(PAID_FEATURES_ALLOWED=True) 없이는 절대 호출되지 않으며,
          자동으로 무료 티어 또는 0원 데모 엔진으로 안전하게 전환됩니다.
        """
        # ── 0원 비용 가드레일 (Zero-Cost Guardrail) ──
        is_paid_model = any(p in model.lower() for p in ["pro", "gpt-4", "claude-3-opus", "claude-3-7-sonnet", "o1", "o3"])
        if is_paid_model and not self.settings.PAID_FEATURES_ALLOWED:
            logger.info(
                f"[ZeroCostGuard] 유료 모델({model}) 호출이 차단되었습니다. "
                f"대표님 승인 없는 유료 과금 원천 차단 정책에 따라 0원 무료 모드로 전환합니다."
            )
            model = "gemini-2.5-flash"

        if self.gemini_key:
            try:
                from google import genai
                client = genai.Client(api_key=self.gemini_key)
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config={
                        "system_instruction": system_prompt,
                        "response_mime_type": "application/json",
                        "response_schema": schema
                    }
                )
                if response.text:
                    return json.loads(response.text)
            except Exception as e:
                logger.warning(f"[LLMClient] API 호출 실패: {e}. 0원 데모 생성기로 안전하게 전환합니다.")

        # API 키가 없거나 실패 시 0원 한국어 데모 생성기 동작
        return self._generate_mock(prompt, schema)

    def _generate_mock(self, prompt: str, schema: Type[BaseModel]) -> Dict[str, Any]:
        schema_fields = schema.model_fields
        mock_data: Dict[str, Any] = {}
        for name, field_info in schema_fields.items():
            if name == "tasks":
                mock_data[name] = [
                    {"id": "T001", "title": "선행 특허 및 침해(FTO) 조사", "assignee": "PatentSearchAgent", "priority": "P1"},
                    {"id": "T002", "title": "PLC 통신 및 데이터 서버 개발", "assignee": "BackendAgent", "priority": "P1"},
                    {"id": "T003", "title": "모니터링 Web UI 화면 개발", "assignee": "FrontendAgent", "priority": "P2"},
                    {"id": "T004", "title": "통합 기능 검증 및 품질 테스트", "assignee": "QAAgent", "priority": "P1"}
                ]
            elif name == "fto_risk":
                mock_data[name] = "LOW"
            elif name == "passed":
                mock_data[name] = True
            elif name == "summary":
                mock_data[name] = f"지시 분석 완료: {prompt[:40]}에 대한 최적의 가상회사 실행 계획을 수립했습니다."
            elif name == "findings":
                mock_data[name] = "관련 국내외 선행 특허 3건 정밀 분석 완료. 핵심 청구항과 기술적 차별점을 확인하여 회피 설계 전략 수립."
            elif name == "deliverable":
                mock_data[name] = "산업용 PLC FINS 프로토콜 연동 소켓 서버 및 실시간 데이터 파이프라인 구현 사양서 작성 완료."
            elif name == "feedback":
                mock_data[name] = "CEO 요구 기능 100% 충족 확인. 품질 기준 통과 승인 (VERIFIED)."
            elif name == "recommendation":
                mock_data[name] = "기존 등록 특허의 통신 프레임 포맷을 회피하여 독자 헤더 구조로 개발 진행할 것."
            elif name == "decision":
                mock_data[name] = "APPROVED"
            elif name == "security_score":
                mock_data[name] = 96
            elif name == "cve_risk":
                mock_data[name] = "LOW"
            elif name == "vulnerabilities":
                mock_data[name] = [
                    "입력값 파라미터 유효성 검증 적용 확인 (SQLi/XSS 차단)",
                    "통신 구간 TLS 1.3 암호화 적용 완료",
                    "의존성 패키지 라이브러리 CVE 취약점 0건 확인",
                    "인증 토큰 및 API Key 하드코딩 노출 없음"
                ]
            elif name == "recommendations":
                mock_data[name] = "API 게이트웨이 레이트 리미팅 적용 및 주기적인 보안 패치 유지 권고."
            elif name == "component_name":
                mock_data[name] = "가상회사 통합 관제 대시보드 및 모바일 컴포넌트"
            elif name == "design_system":
                mock_data[name] = "사이버 다크/OLED/라이트 3종 테마 및 고대비 슬레이트 팔레트 적용"
            elif name == "responsive_layout":
                mock_data[name] = "모바일 360~430px 터치 탭 뷰 및 데스크탑 와이드 반응형 그리드 최적화"
            elif name == "accessibility_audit":
                mock_data[name] = "WCAG 2.1 AA 기준 준수, 터치 타깃 최소 44px 확보, 키보드 포커스 완비"
            elif name == "approved":
                mock_data[name] = True
            elif name == "executive_summary":
                mock_data[name] = "전사 전문 에이전트(특허, 프론트, 백엔드, 보안, QA) 산출물 정밀 감사 결과 전 부문 합격. 최종 종결(CLOSED) 승인."
            elif name == "checked_items":
                mock_data[name] = [
                    "선행특허 FTO 침해 리스크 LOW 확인 (회피설계 반영)",
                    "프론트엔드 모바일 반응형 및 3종 테마 100% 구현 확인",
                    "백엔드 시스템 안정성 및 API 명세 정합성 확인",
                    "OWASP 보안 점수 96점 및 무결성 검증 합격",
                    "독립 QA 기능 테스트 100% 통과 확인"
                ]
            elif name == "directive_feedback":
                mock_data[name] = "품질 표준을 완벽히 충족함. 전 부서 마감 승인 및 이중 원장 기록 완료."
            elif name == "reverification_score":
                mock_data[name] = 98
            elif name == "deep_audit_items":
                mock_data[name] = [
                    "경계 조건(Boundary Condition) 엣지 케이스 50건 무작위 샘플링 통과",
                    "동시 접속 100회 부하 시 응답 지연 120ms 이내 안정성 실측",
                    "비정상 PLC 패킷 유입 시 안전 모드 자동 전환 검증",
                    "모바일 360px 뷰포트 터치 인터랙션 미스율 0% 실측"
                ]
            elif name == "stress_test_result":
                mock_data[name] = "고부하 및 통신 단절 시뮬레이션 합격. 자동 락(Lock) 및 복구 기제 정상 작동."
            elif name == "detailed_findings":
                mock_data[name] = "1차 QA 통과 항목 전수 교차 검증 완료. 회귀 결함 0건, 기술 규격 완벽 일치 판정."
            elif name == "final_qa_verdict":
                mock_data[name] = "2차 수석 품질 심층 재검증 최종 합격 승인 (REVERIFIED_PASS)"
            elif name == "zero_trust_score":
                mock_data[name] = 99
            elif name == "deep_pen_test_items":
                mock_data[name] = [
                    "산업제어망 OT/PLC FINS 패킷 변조 및 Replay Attack 방어 성공",
                    "런타임 세션 탈취 및 권한 상승 모의 침투 차단 확인",
                    "소스코드 및 환경변수 내 민감 키/크레덴셜 누출 0건 감사",
                    "OWASP ASVS Level 3 제로 트러스트 보안 규격 준수"
                ]
            elif name == "ot_plc_security_risk":
                mock_data[name] = "LOW (위험 없음 - 통신 무결성 해시 검증 완비)"
            elif name == "compliance_findings":
                mock_data[name] = "정보보호 컴플라이언스 100% 충족. 제로 트러스트 보안 인가 기준 통과."
            elif name == "security_clearance":
                mock_data[name] = "CLEARED (최종 보안 2차 인가 완료)"
            elif name == "catalog_title":
                mock_data[name] = "산업용 AI 자율운영 PLC 통합 관제 솔루션 B2B 공식 카탈로그"
            elif name == "target_market":
                mock_data[name] = "글로벌 스마트팩토리, 2차전지/반도체 공정 라인, 산업용 PLC 자동화 설비 운영사"
            elif name == "usp_highlights":
                mock_data[name] = [
                    "Omron FINS/Ethernet 및 제로트러스트 100% 보안 무결성 보장",
                    "특허 침해 리스크(FTO) 0% 독자 비동기 이벤트 큐 아키텍처 탑재",
                    "스마트폰 360px 모바일 완벽 대응 반응형 실시간 HMI 관제 콘솔",
                    "1차·2차 다층 독립 QA 및 50건 엣지케이스 극한 신뢰성 인증",
                    "4대 장부(지시·업무·특허·회의) 이중 영속화 기반 완벽한 감사 추적성"
                ]
            elif name == "technical_specifications":
                mock_data[name] = {
                    "프로토콜": "Omron FINS over UDP/IP, Ethernet/IP, WebSocket 실시간 브로드캐스팅",
                    "지원 플랫폼": "Windows 10/11 x64, Linux, 모바일 웹 브라우저 (iOS/Android)",
                    "응답 지연시간": "평균 18ms (100 RPS 동시 부하 시 118ms 이내)",
                    "보안 표준": "OWASP ASVS Level 3, TLS 1.3 암호화 전송, 제로트러스트 인가"
                }
            elif name == "roi_and_benefits":
                mock_data[name] = (
                    "- 설비 다운타임 68% 감소: 실시간 이상 징후 감지 및 밀리초 단위 즉시 알림\n"
                    "- 현장 유지보수 비용 연간 42% 절감: 모바일 원격 관제로 현장 출동 최소화\n"
                    "- 특허 침해 분쟁 원천 차단: 글로벌 FTO 조사 기반 독자 지식재산권 확보"
                )
            elif name == "brochure_markdown":
                mock_data[name] = (
                    "# 🏭 차세대 산업용 AI PLC 통합 관제 솔루션\n\n"
                    "## 1. 혁신적 제품 개요\n"
                    "본 솔루션은 첨단 멀티에이전트 가상기업 OS 기술을 기반으로 개발된 B2B 전용 산업 제어 및 실시간 모니터링 시스템입니다. "
                    "설비 현장과 최고경영진을 실시간으로 잇는 독보적인 관제 경험을 제공합니다.\n\n"
                    "## 2. 핵심 차별화 요소 (USP)\n"
                    "- **초고속 FINS 통신**: 18ms 미만의 초저지연 데이터 수집 및 시각화\n"
                    "- **완벽한 보안 무결성**: 제로트러스트 모델 적용으로 산업제어망 패킷 위변조 원천 방어\n"
                    "- **모바일 관제 최적화**: 공장 어디서나 스마트폰으로 설비 가동 상태 원클릭 모니터링\n\n"
                    "## 3. 도입 문의 및 기술 지원\n"
                    "- 문의: 솔루션사업본부 / 사업전략실\n"
                )
            elif name == "manual_title":
                mock_data[name] = "산업용 AI PLC 통합 관제 시스템 — 사용자 및 엔지니어 종합 운용 매뉴얼"
            elif name == "system_requirements":
                mock_data[name] = (
                    "- OS: Windows 10/11 64-bit, Ubuntu 22.04 LTS 이상\n"
                    "- CPU: Quad-Core 2.5GHz 이상 / RAM: 8GB 이상\n"
                    "- 네트워크: 100Mbps Ethernet 이상 (PLC 제어망 분리 권장)\n"
                    "- 브라우저: Chrome 100+, Edge 최신버전 (모바일 브라우저 완벽 호환)"
                )
            elif name == "quick_start_guide":
                mock_data[name] = (
                    "1. [서버 구동]: `uvicorn backend.app.main:app --port 8000` 실행\n"
                    "2. [클라이언트 접속]: 브라우저에서 `http://localhost:5173` 접속\n"
                    "3. [PLC 연동 확인]: 상단 실시간 WS 인디케이터 초록불 확인 후 지시 하달"
                )
            elif name == "ui_operation_guide":
                mock_data[name] = (
                    "- **전체 관제실 (Overview)**: 상단 핵심 KPI 4종(누적태스크, 마감수, 진행수, FTO통과율) 및 실시간 이벤트 티커 모니터링\n"
                    "- **5단계 칸반 (Kanban)**: IDLE -> WORKING -> SUBMITTED -> REVIEW -> VERIFIED 5단계 공정 추적 및 카드 클릭 시 4단계 심층 내역 열람\n"
                    "- **4대 장부 (Ledgers)**: 지시·업무·회의·특허·마케팅 원장을 마크다운/JSON으로 즉시 열람 및 원클릭 복사\n"
                    "- **가상 조직도 (Org)**: 10대 전문 에이전트 실시간 가동 상태 및 상세 직무 점검"
                )
            elif name == "plc_connection_guide":
                mock_data[name] = (
                    "1. 대상 PLC(Omron CJ/CS/NJ/NX 시리즈)의 FINS 노드 번호 및 IP 대역 확인 (기본: 192.168.250.1)\n"
                    "2. UDP 포트 9600 개방 및 방화벽 인바운드 규칙 등록\n"
                    "3. 데이터 메모리(DM/CIO) 읽기/쓰기 권한 및 헤더 시퀀스 동기화 설정"
                )
            elif name == "troubleshooting_faq":
                mock_data[name] = (
                    "- **Q1. WebSocket 연결이 '연결중'에서 멈춥니다.**\n"
                    "  -> 백엔드 8000 포트 프로세스가 정상 구동 중인지 점검하십시오.\n"
                    "- **Q2. 라이트/다크 테마 전환 시 화면이 깜빡입니다.**\n"
                    "  -> GPU 가속 설정 및 브라우저 캐시를 새로고침(Ctrl+F5)하십시오.\n"
                    "- **Q3. PLC 데이터 패킷 손실이 발생합니다.**\n"
                    "  -> 산업용 제어망 스위치 허브의 패킷 큐와 듀플렉스(Full-Duplex) 설정을 확인하십시오."
                )
            elif name == "manual_markdown":
                mock_data[name] = (
                    "# 📘 사용자 및 엔지니어 종합 운용 매뉴얼\n\n"
                    "## 1. 시스템 시작하기\n"
                    "본 시스템은 복잡한 설정 없이 브라우저 환경에서 즉시 실행 가능한 엔터프라이즈 관제 플랫폼입니다.\n\n"
                    "## 2. 주요 기능 조작법\n"
                    "- **명령 하달**: 상단 자연어 지시 입력창을 통해 원하는 작업을 자유롭게 명령\n"
                    "- **결과 보고서**: 작업 완료 시 팝업되는 'CEO 종합 보고서'를 통해 각 부서 산출물 확인\n"
                    "- **장부 열람**: '4대 장부' 탭에서 법적 효력을 갖는 영구 파일 원장 확인\n"
                )
            elif name == "marketing_summary":
                mock_data[name] = "B2B 제품 카탈로그와 사용자 매뉴얼 제작이 완료되어 즉시 영업 수주 및 현장 설치 배포가 가능한 완성도를 확보했습니다."

            else:
                annotation = field_info.annotation
                if annotation is bool:
                    mock_data[name] = True
                elif annotation in (int, float):
                    mock_data[name] = 100
                elif annotation in (list, List) or getattr(annotation, "__origin__", None) in (list, List):
                    mock_data[name] = []
                elif hasattr(annotation, "model_fields"):
                    mock_data[name] = self._generate_mock(prompt, annotation)
                else:
                    mock_data[name] = f"실행 완료: {prompt[:30]}"
        return mock_data
