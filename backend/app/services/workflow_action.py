# backend/app/services/workflow_action.py
import asyncio
import logging
from typing import Dict, Any, List, Optional, Callable
import urllib.request
import json

logger = logging.getLogger(__name__)


class WorkflowActionService:
    """n8n 스타일 워크플로우 자동화 및 외부 비즈니스 연동 계층 (Action Engine).
    
    비용 0원 원칙:
    - 외부 유료 클라우드 SaaS 구독 없이, 백엔드 내장 비동기 이벤트 버스로 작동.
    - 슬랙, 텔레그램, 사내 ERP, 노션 등 웹훅(Webhook) 엔드포인트를 0원으로 무제한 연동.
    """

    def __init__(self):
        self._webhooks: List[Dict[str, Any]] = []
        self._execution_history: List[Dict[str, Any]] = []

    def register_webhook(self, name: str, url: str, event_filter: Optional[List[str]] = None) -> Dict[str, Any]:
        """외부 시스템(슬랙/노션/사내 ERP) 웹훅 등록"""
        webhook = {
            "id": f"wh-{len(self._webhooks) + 1:03d}",
            "name": name,
            "url": url,
            "event_filter": event_filter or ["*"],
            "enabled": True,
        }
        self._webhooks.append(webhook)
        logger.info(f"[WorkflowAction] 신규 웹훅 등록: {name} ({url})")
        return webhook

    def list_webhooks(self) -> List[Dict[str, Any]]:
        return self._webhooks

    async def trigger_event(self, event_name: str, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """라이프사이클 이벤트 발생 시 등록된 외부 웹훅으로 페이로드 비동기 발송"""
        results = []
        for wh in self._webhooks:
            if not wh.get("enabled", True):
                continue

            filters = wh.get("event_filter", ["*"])
            if "*" not in filters and event_name not in filters:
                continue

            # 비동기 웹훅 발송 (urllib.request + asyncio.to_thread로 Windows 호환성 100% 보장)
            res = await self._send_webhook_post(wh, event_name, payload)
            results.append(res)
            self._execution_history.append(res)

        return results

    async def _send_webhook_post(self, webhook: Dict[str, Any], event_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        data = {
            "event": event_name,
            "webhook_id": webhook["id"],
            "webhook_name": webhook["name"],
            "data": payload,
        }
        url = webhook["url"]

        def _blocking_post():
            try:
                post_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=post_bytes,
                    headers={"Content-Type": "application/json", "User-Agent": "AIVirtualCompanyOS/4.0"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    return {"webhook_id": webhook["id"], "status": "SUCCESS", "status_code": resp.status}
            except Exception as e:
                logger.warning(f"[WorkflowAction] 웹훅 전송 실패 ({url}): {e}")
                return {"webhook_id": webhook["id"], "status": "FAILED", "error": str(e)}

        return await asyncio.to_thread(_blocking_post)
