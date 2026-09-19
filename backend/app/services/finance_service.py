# backend/app/services/finance_service.py
import asyncio
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class FinanceCostService:
    """OpenBB 스타일의 금융·환율·원가 분석 서비스.
    
    비용 0원 원칙:
    - 블룸버그나 유료 금융 데이터 벤더 구독 없이, 오픈 금융 라이브러리(yfinance)와 공개 환율 지표를 활용.
    - 사업전략 및 마케팅 에이전트, 경영진에게 실시간 USD/KRW 환율 및 원가 추산 지표 제공.
    """

    def __init__(self):
        self._cached_rates: Dict[str, Any] = {}

    async def get_usd_krw_rate(self) -> Dict[str, Any]:
        """원/달러(USD/KRW) 실시간 환율을 0원 무료로 조회합니다."""
        def _fetch_rate():
            try:
                import yfinance as yf
                ticker = yf.Ticker("KRW=X")
                data = ticker.history(period="1d")
                if not data.empty and "Close" in data:
                    current_rate = float(data["Close"].iloc[-1])
                    return {
                        "currency_pair": "USD/KRW",
                        "rate": round(current_rate, 2),
                        "status": "LIVE",
                        "source": "Yahoo Finance (Free OpenBB Engine)",
                        "cost": "0원 (무료 오픈소스)",
                    }
            except Exception as e:
                logger.warning(f"[FinanceService] yfinance 실시간 조회 지연: {e}. 표준 기준환율로 안전 폴백.")

            # 안전 폴백 기준치 (네트워크 장애 대비)
            return {
                "currency_pair": "USD/KRW",
                "rate": 1395.50,
                "status": "FALLBACK",
                "source": "Standard Reference Matrix (0-Cost Fallback)",
                "cost": "0원",
            }

        return await asyncio.to_thread(_fetch_rate)

    async def calculate_project_budget(self, developer_count: int, duration_days: int) -> Dict[str, Any]:
        """프로젝트 가상 투입 원가 및 0원 인프라 절감액 산출"""
        rate_info = await self.get_usd_krw_rate()
        usd_rate = rate_info.get("rate", 1395.50)

        # 상용 AI SaaS(Dify Cloud, n8n Cloud, OpenAI 등) 도입 시 예상 지출 비용 vs 가상회사 0원 구축 절감액
        saas_monthly_usd = 250.0  # 평균적인 팀 단위 에이전트 클라우드 구독료
        saved_krw = int(saas_monthly_usd * usd_rate)

        return {
            "developer_agents": developer_count,
            "duration_days": duration_days,
            "actual_ai_cost": 0,
            "actual_subscription_fee": 0,
            "currency": "KRW",
            "usd_krw_rate": usd_rate,
            "estimated_monthly_savings_krw": saved_krw,
            "summary": f"월 0원 인프라 구축으로 매월 약 {saved_krw:,}원의 SaaS 구독료 및 API 비용을 100% 절감 중입니다.",
        }
