# backend/app/api/commands.py
import asyncio
from fastapi import APIRouter
from backend.app.models.schemas import CommandCreate
from backend.app.services.orchestrator import CompanyOrchestrator
from backend.app.api.ws import manager

router = APIRouter(prefix="/api/commands", tags=["commands"])


@router.post("")
async def create_command(cmd: CommandCreate):
    def broadcast_sync(event_type: str, data: dict):
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.broadcast(event_type, data))
        except RuntimeError:
            pass

    orchestrator = CompanyOrchestrator(broadcast_fn=broadcast_sync)
    result = await orchestrator.dispatch_ceo_command(cmd.instruction)
    return result
