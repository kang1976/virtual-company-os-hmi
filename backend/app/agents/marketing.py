# backend/app/agents/marketing.py
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from backend.app.agents.base import BaseAgent


class CatalogOutputSchema(BaseModel):
    catalog_title: str = Field(description="제품 카탈로그 공식 명칭")
    target_market: str = Field(description="주요 타깃 고객 및 적용 산업군 (예: 스마트팩토리, PLC 자동화 제어)")
    usp_highlights: List[str] = Field(description="제품의 5대 핵심 차별화 요소 (USP)")
    technical_specifications: Dict[str, str] = Field(description="시스템 권장 사양 및 통신 규격표")
    roi_and_benefits: str = Field(description="정량적 도입 기대효과 및 ROI 분석")
    brochure_markdown: str = Field(description="고객 배포용 B2B 제품 카탈로그 전문 (Markdown 형식)")


class ManualOutputSchema(BaseModel):
    manual_title: str = Field(description="사용자 및 엔지니어 운용 매뉴얼 공식 명칭")
    system_requirements: str = Field(description="최소 및 권장 시스템 요구사양")
    quick_start_guide: str = Field(description="원클릭 설치 및 초기 구동 절차")
    ui_operation_guide: str = Field(description="화면별 UI 조작법 및 주요 기능 안내 (관제 대시보드, 칸반, 장부)")
    plc_connection_guide: str = Field(description="산업용 PLC 통신(FINS/Ethernet) 연동 및 파라미터 설정법")
    troubleshooting_faq: str = Field(description="장애 발생 시 긴급 조치 가이드 및 FAQ")
    manual_markdown: str = Field(description="완성된 사용자 운용 매뉴얼 전문 (Markdown 형식)")


class CommercialPackageSchema(BaseModel):
    product_name: str = Field(description="상품화 대상 제품 명칭")
    catalog: CatalogOutputSchema = Field(description="B2B 제품 카탈로그")
    manual: ManualOutputSchema = Field(description="사용자 및 엔지니어 운용 매뉴얼")
    marketing_summary: str = Field(description="상품화 및 시장 진입 전략 총평")


class ProductMarketingAgent(BaseAgent):
    """B2B 제품 상품화, 카탈로그 및 사용자 매뉴얼 제작 전담 에이전트 (사업전략·마케팅실)"""

    def __init__(self):
        super().__init__("ProductMarketingAgent", "제품기획 및 기술문서 마케터", "사업전략·마케팅실")

    async def create_catalog(
        self, product_name: str, tech_features: str, target_audience: Optional[str] = None
    ) -> dict:
        system_prompt = (
            "너는 산업용 AI 솔루션 및 스마트팩토리 전문 B2B 제품 마케팅 디렉터다. "
            "엔지니어링 개발 산출물을 바탕으로 구매 결정권자(CTO, 공장장, 생산기술팀장)를 설득할 수 있는 "
            "압도적 완성도의 B2B 제품 카탈로그와 브로슈어 문안을 작성하라."
        )
        prompt = (
            f"제품명: {product_name}\n"
            f"핵심 기술 구성 및 특장점: {tech_features}\n"
            f"타깃 고객: {target_audience or '스마트팩토리 설비 운영사 및 산업 자동화 제조사'}\n"
            f"위 정보를 기반으로 전문적인 B2B 제품 카탈로그 사양서를 작성하시오."
        )
        return await self.execute(prompt, system_prompt, CatalogOutputSchema)

    async def create_manual(
        self, product_name: str, components: str, operation_guide: Optional[str] = None
    ) -> dict:
        system_prompt = (
            "너는 산업용 소프트웨어 및 임베디드 제어 시스템 전문 수석 테크니컬 라이터(Technical Writer)다. "
            "현장 엔지니어와 운영자가 한눈에 이해하고 쉽게 설치·운용할 수 있도록 친절하고 엄밀한 사용자 매뉴얼을 작성하라."
        )
        prompt = (
            f"제품명: {product_name}\n"
            f"시스템 구성요소: {components}\n"
            f"운용 지침: {operation_guide or '원클릭 설치, 실시간 관제 모니터링, PLC FINS 통신 설정'}\n"
            f"설치부터 트러블슈팅까지 완벽히 기술된 실무 운용 매뉴얼을 작성하시오."
        )
        return await self.execute(prompt, system_prompt, ManualOutputSchema)

    async def produce_commercial_package(
        self, product_name: str, deliverables_summary: str
    ) -> dict:
        system_prompt = (
            "너는 가상회사의 사업전략·마케팅실 수석 에이전트다. "
            "개발 및 품질 검증이 완료된 기술 산출물을 시장에 런칭하기 위한 "
            "B2B 제품 카탈로그와 사용자 매뉴얼을 패키지로 완벽히 기획·작성하라."
        )
        prompt = (
            f"상품화 대상 제품: {product_name}\n"
            f"최종 기술 및 품질 산출물 요약: {deliverables_summary}\n"
            f"위 산출물을 종합하여 B2B 제품 카탈로그와 상세 사용자 매뉴얼을 모두 포함한 상품화 패키지를 작성하시오."
        )
        return await self.execute(prompt, system_prompt, CommercialPackageSchema)
