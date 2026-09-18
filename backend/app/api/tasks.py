# backend/app/api/tasks.py
from fastapi import APIRouter
from sqlalchemy import select
from backend.app.models.db import get_db, TaskModel

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("")
async def list_tasks():
    async for session in get_db():
        result = await session.execute(select(TaskModel))
        tasks = result.scalars().all()
        return [
            {
                "id": t.id,
                "project_id": t.project_id,
                "title": t.title,
                "assignee": t.assignee,
                "priority": t.priority,
                "status": t.status,
                "coo_prompt": t.coo_prompt,
                "deliverable": t.deliverable,
                "detailed_directive": t.detailed_directive,
                "execution_plan": t.execution_plan,
                "action_log": t.action_log,
                "verification_checklist": t.verification_checklist,
            }
            for t in tasks
        ]
    return []
