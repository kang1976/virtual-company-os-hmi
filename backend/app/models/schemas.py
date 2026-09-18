# backend/app/models/schemas.py
from enum import Enum
from typing import Optional, List, Any
from pydantic import BaseModel, Field

class TaskStatus(str, Enum):
    IDLE = "IDLE"           # 대기
    WORKING = "WORKING"     # 진행 중
    SUBMITTED = "SUBMITTED" # 작업물 제출
    REVIEW = "REVIEW"       # QA 검토 중
    VERIFIED = "VERIFIED"   # 검증 완료
    CLOSED = "CLOSED"       # 최종 마감
    BLOCKED = "BLOCKED"     # 문제 발생/CEO 결정 대기

class Priority(str, Enum):
    P0 = "P0"  # CEO 긴급 지시
    P1 = "P1"  # 핵심 선행 업무
    P2 = "P2"  # 일반 업무
    P3 = "P3"  # 부가 업무
    P4 = "P4"  # 보류

class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None

class CommandCreate(BaseModel):
    instruction: str
    target_team: Optional[str] = "전체"

class TaskCreate(BaseModel):
    id: str
    project_id: str
    title: str
    assignee: str
    priority: Priority = Priority.P2
    status: TaskStatus = TaskStatus.IDLE
    deliverable: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    project_id: str
    title: str
    assignee: str
    priority: str
    status: str
    deliverable: Optional[str] = None
