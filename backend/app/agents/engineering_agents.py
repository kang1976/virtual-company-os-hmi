# backend/app/agents/engineering_agents.py
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from backend.app.agents.base import BaseAgent


# 1. 수석 소프트웨어 아키텍트 (SoftwareArchitectAgent)
class ArchitectureSpecSchema(BaseModel):
    architecture_pattern: str = Field(description="클린 아키텍처, DDD 등 채택된 아키텍처 패턴")
    layer_separation: List[str] = Field(description="도메인, 서비스, 인프라, 프레젠테이션 계층 분리 구조")
    scalability_plan: str = Field(description="고동시성 및 대용량 트랜잭션 확장 전략")
    trade_off_analysis: str = Field(description="기술 스택 선정에 대한 트레이드오프 분석")
    approved: bool = Field(description="수석 아키텍트 승인 여부")


class SoftwareArchitectAgent(BaseAgent):
    """시스템 설계, 도메인 주도 설계(DDD), 아키텍처 패턴 및 트레이드오프 분석 전문 수석 아키텍트"""

    def __init__(self):
        super().__init__(
            "SoftwareArchitectAgent",
            "소프트웨어 수석 아키텍트 (Software Architect)",
            "기술개발본부 (Engineering Division)",
        )

    async def design_system(self, requirement: str) -> dict:
        system_prompt = (
            "너는 소프트웨어 수석 아키텍트다. 도메인 주도 설계(DDD), 클린 아키텍처, 분산 서비스 격리, "
            "확장성 및 유지보수성을 극대화하는 아키텍처 규격을 수립하라."
        )
        prompt = f"요구사항: {requirement}\n시스템의 도메인 모델과 계층 분리 아키텍처를 설계하시오."
        return await self.execute(prompt, system_prompt, ArchitectureSpecSchema)


# 2. 모바일 앱 빌더 (MobileAppBuilderAgent)
class MobileSpecSchema(BaseModel):
    platform: str = Field(description="Flutter/Dart 크로스플랫폼 타깃")
    responsive_breakpoints: List[str] = Field(description="스마트폰(360~430px), 폴더블(Z폴드), 태블릿 대응 규격")
    offline_p2p_support: bool = Field(description="PLC/센서 오프라인 P2P 직결 통신 지원 여부")
    touch_affordance_score: int = Field(description="터치 타깃(44px 이상) 사용성 점수 (1~100)")


class MobileAppBuilderAgent(BaseAgent):
    """Flutter, iOS/Android 네이티브 및 모바일 반응형 앱 구현 전문 엔지니어"""

    def __init__(self):
        super().__init__(
            "MobileAppBuilderAgent",
            "모바일 앱 전문 빌더 (Mobile App Builder)",
            "기술개발본부 (Engineering Division)",
        )

    async def build_mobile_spec(self, feature_name: str) -> dict:
        system_prompt = (
            "너는 일류 모바일 앱 개발 전문가다. Flutter 및 안드로이드/iOS 반응형 레이아웃, "
            "터치 인터랙션, 저지연 P2P 통신 및 배터리 최적화를 완벽히 구현하라."
        )
        prompt = f"기능: {feature_name}\n모바일 최적화 규격 및 Flutter 아키텍처를 수립하시오."
        return await self.execute(prompt, system_prompt, MobileSpecSchema)


# 3. 임베디드 & 산업제어 펌웨어 엔지니어 (EmbeddedFirmwareAgent)
class EmbeddedSpecSchema(BaseModel):
    protocol: str = Field(description="Omron CJ2H FINS/UDP, Modbus, MQTT 등 산업용 프로토콜")
    packet_integrity: str = Field(description="패킷 위변조 및 손실 방지 체크섬/재시도 메커니즘")
    latency_guarantee: str = Field(description="실시간 제어 보장 지연시간 (ms 단위)")
    fail_safe_mechanism: str = Field(description="통신 단절 시 긴급 안전 셧다운 및 림프홈(Limp-home) 모드")


class EmbeddedFirmwareAgent(BaseAgent):
    """산업용 PLC(CJ2H/NX), RTOS, FINS 통신 프로토콜 및 실시간 임베디드 펌웨어 전문가"""

    def __init__(self):
        super().__init__(
            "EmbeddedFirmwareAgent",
            "임베디드·산업제어 엔지니어 (Embedded Firmware Engineer)",
            "기술개발본부 (Engineering Division)",
        )

    async def design_plc_protocol(self, controller_model: str = "Omron CJ2H-EIP") -> dict:
        system_prompt = (
            "너는 산업용 자동화 및 임베디드 펌웨어 최고 전문가다. Omron CJ2H FINS 통신 패킷 구조, "
            "I/O 메모리 맵(DM, CIO, WR), 실시간성 보장 및 페일세이프(Fail-Safe) 안전 로직을 설계하라."
        )
        prompt = f"대상 제어기: {controller_model}\n초정밀 산업 통신 및 실시간 제어 규격을 수립하시오."
        return await self.execute(prompt, system_prompt, EmbeddedSpecSchema)


# 4. 데이터베이스 최적화 전문가 (DatabaseOptimizerAgent)
class DBOptimizerSchema(BaseModel):
    indexing_strategy: List[str] = Field(description="조회 성능 향상을 위한 최적 인덱스 목록")
    query_optimization: str = Field(description="N+1 방지, 복합 쿼리 튜닝 및 실행 계획 분석")
    transaction_isolation: str = Field(description="동시성 제어 및 원자적 트랜잭션 격리 레벨")
    storage_efficiency: str = Field(description="SQLite/PostgreSQL 디스크 I/O 절감 및 WAL 모드 최적화")


class DatabaseOptimizerAgent(BaseAgent):
    """스키마 설계, 쿼리 최적화, 인덱싱 전략 및 고성능 데이터 파이프라인 튜닝 전문가"""

    def __init__(self):
        super().__init__(
            "DatabaseOptimizerAgent",
            "데이터베이스 최적화 전문가 (Database Optimizer)",
            "기술개발본부 (Engineering Division)",
        )

    async def optimize_schema(self, table_names: List[str]) -> dict:
        system_prompt = (
            "너는 고성능 데이터베이스 튜닝 전문가다. 스키마 정규화/반정규화, 인덱스 설계, "
            "락 경합(Lock Contention) 최소화 및 SQLite aiosqlite/PostgreSQL 최적화를 수행하라."
        )
        prompt = f"대상 테이블: {', '.join(table_names)}\n데이터베이스 최적화 전략을 수립하시오."
        return await self.execute(prompt, system_prompt, DBOptimizerSchema)


# 5. 데브옵스 & SRE 엔지니어 (DevOpsAutomatorAgent)
class DevOpsSpecSchema(BaseModel):
    pipeline_steps: List[str] = Field(description="Lint, Test, Build, Security Scan, Deploy 파이프라인")
    uptime_target: str = Field(description="목표 가동률 (예: 99.99% 가용성)")
    health_check_strategy: str = Field(description="실시간 헬스체크 및 프로세스 크래시 시 자가복구(Auto-Restart)")
    backup_retention: str = Field(description="4대 장부 및 데이터베이스 자동 스냅샷 정책")


class DevOpsAutomatorAgent(BaseAgent):
    """CI/CD 파이프라인 구축, 인프라 자동화, 무중단 장애 복구 및 시스템 신뢰성(SRE) 전문가"""

    def __init__(self):
        super().__init__(
            "DevOpsAutomatorAgent",
            "데브옵스·SRE 자동화 엔지니어 (DevOps Automator)",
            "기술개발본부 (Engineering Division)",
        )

    async def build_pipeline(self, project_name: str) -> dict:
        system_prompt = (
            "너는 클라우드 및 온프레미스 인프라를 전담하는 데브옵스/SRE 전문가다. "
            "무중단 배포, GitHub Actions/스크립트 자동화, 헬스 모니터링 및 복구 자동화를 설계하라."
        )
        prompt = f"프로젝트: {project_name}\n안정적인 CI/CD 및 SRE 운영 규격을 수립하시오."
        return await self.execute(prompt, system_prompt, DevOpsSpecSchema)


# 6. 수석 코드 리뷰어 (CodeReviewerAgent)
class CodeReviewSchema(BaseModel):
    code_quality_score: int = Field(description="코드 가독성 및 아키텍처 준수 점수 (1~100)")
    maintainability_verdict: str = Field(description="유지보수성 평가 (EXCELLENT / ACCEPTABLE / NEEDS_REFACTOR)")
    detected_anti_patterns: List[str] = Field(description="발견된 안티패턴 및 기술 부채 목록")
    constructive_feedbacks: List[str] = Field(description="개발자를 위한 구체적 개선 가이드라인")
    review_approved: bool = Field(description="최종 PR 머지 승인 여부")


class CodeReviewerAgent(BaseAgent):
    """건설적인 코드 리뷰, 안티패턴 식별, 보안 코딩 및 클린 코드 품질 게이트키퍼"""

    def __init__(self):
        super().__init__(
            "CodeReviewerAgent",
            "수석 코드 리뷰어 (Code Reviewer)",
            "기술개발본부 (Engineering Division)",
        )

    async def review_pull_request(self, diff_content: str) -> dict:
        system_prompt = (
            "너는 20년 경력의 엄격하면서도 친절한 수석 코드 리뷰어다. "
            "타입 안정성, 가독성, 예외 처리, 안티패턴, 비동기 블로킹 코드를 정밀 검토하여 승인하라."
        )
        prompt = f"검토할 코드 Diff:\n{diff_content}\n코드 리뷰를 수행하고 최종 판정을 내리시오."
        return await self.execute(prompt, system_prompt, CodeReviewSchema)


# 7. 최소 수정 패치 전문가 (MinimalChangeAgent)
class MinimalPatchSchema(BaseModel):
    target_function: str = Field(description="패치 대상 단일 함수 또는 컴포넌트")
    lines_affected: int = Field(description="수정된 라인 수 (최소 단위 원칙)")
    zero_side_effect_audit: str = Field(description="기타 기능에 대한 부작용(Side Effect) 0건 검증")
    patch_approved: bool = Field(description="최소 변경 패치 승인 여부")


class MinimalChangeAgent(BaseAgent):
    """스코프 크립(Scope Creep) 없이 지시된 버그만 정확하게 핀포인트로 고치는 최소 수정 패치 전문가"""

    def __init__(self):
        super().__init__(
            "MinimalChangeAgent",
            "최소 수정 패치 전문가 (Minimal Change Engineer)",
            "기술개발본부 (Engineering Division)",
        )

    async def inspect_patch_scope(self, issue_description: str, proposed_diff: str) -> dict:
        system_prompt = (
            "너는 최소 침습 소프트웨어 패치 전문가다. 요구된 버그/기능 외의 불필요한 코드 변경(스코프 크립)을 "
            "철저히 배제하고, 가장 작고 안전한 최소 단위 Diff(Minimal Viable Diff)만을 승인하라."
        )
        prompt = (
            f"문제 설명: {issue_description}\n"
            f"제안된 Diff:\n{proposed_diff}\n"
            f"최소 변경 원칙에 부합하는지 감리하시오."
        )
        return await self.execute(prompt, system_prompt, MinimalPatchSchema)
