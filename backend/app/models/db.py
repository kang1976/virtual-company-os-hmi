# backend/app/models/db.py
from datetime import datetime, timezone
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from backend.app.core.config import get_settings

Base = declarative_base()

def get_utc_now():
    return datetime.now(timezone.utc)

class ProjectModel(Base):
    __tablename__ = "projects"
    id = Column(String(50), primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime, default=get_utc_now)
    tasks = relationship("TaskModel", back_populates="project", cascade="all, delete-orphan")

class CommandModel(Base):
    __tablename__ = "commands"
    id = Column(String(50), primary_key=True)
    project_id = Column(String(50), nullable=True)
    sender = Column(String(50), default="CEO")
    recipient = Column(String(100), default="COO")
    instruction = Column(Text, nullable=False)
    status = Column(String(50), default="PROCESSING")
    created_at = Column(DateTime, default=get_utc_now)

class TaskModel(Base):
    __tablename__ = "tasks"
    id = Column(String(50), primary_key=True)
    project_id = Column(String(50), ForeignKey("projects.id"), nullable=False)
    title = Column(String(200), nullable=False)
    assignee = Column(String(100), nullable=False)
    priority = Column(String(10), default="P2")
    status = Column(String(50), default="IDLE")
    coo_prompt = Column(Text, nullable=True)
    deliverable = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)
    project = relationship("ProjectModel", back_populates="tasks")

class MeetingModel(Base):
    __tablename__ = "meetings"
    id = Column(String(50), primary_key=True)
    project_id = Column(String(50), nullable=True)
    title = Column(String(200), nullable=False)
    attendees = Column(Text, nullable=False)
    agenda = Column(Text, nullable=False)
    decisions = Column(Text, nullable=False)
    created_at = Column(DateTime, default=get_utc_now)

class PatentRecordModel(Base):
    __tablename__ = "patents"
    id = Column(String(50), primary_key=True)
    project_id = Column(String(50), nullable=False)
    technology = Column(String(200), nullable=False)
    search_scope = Column(String(100), default="KR/US/EP")
    fto_risk = Column(String(20), default="LOW")
    findings = Column(Text, nullable=False)
    created_at = Column(DateTime, default=get_utc_now)

engine = None
AsyncSessionLocal = None

async def init_db():
    global engine, AsyncSessionLocal
    settings = get_settings()
    engine = create_async_engine(settings.SQLITE_URL, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    if AsyncSessionLocal is None:
        await init_db()
    async with AsyncSessionLocal() as session:
        yield session
