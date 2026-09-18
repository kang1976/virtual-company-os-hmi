# backend/app/api/ws.py
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, event_type: str, data: dict):
        payload = {"event": event_type, "data": data}
        for connection in list(self.active_connections):
            try:
                await connection.send_json(payload)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        manager.disconnect(websocket)
