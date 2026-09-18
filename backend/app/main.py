# backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.models.db import init_db
from backend.app.api import ws, commands, tasks, ledgers, system


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="AI Virtual Company OS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws.router)
app.include_router(commands.router)
app.include_router(tasks.router)
app.include_router(ledgers.router)
app.include_router(system.router)


@app.get("/api/health")
async def health():
    return {"status": "ONLINE", "system": "AI Virtual Company OS V4.0"}
