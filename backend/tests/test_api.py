# backend/tests/test_api.py
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_api_health_and_command():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ONLINE"

    cmd_res = client.post("/api/commands", json={"instruction": "테스트 명령 실행", "target_team": "개발팀"})
    assert cmd_res.status_code == 200
    data = cmd_res.json()
    assert "project_id" in data
    assert data["status"] == "SUCCESS"


def test_api_tasks():
    res = client.get("/api/tasks")
    assert res.status_code == 200
    tasks = res.json()
    assert isinstance(tasks, list)
    if len(tasks) > 0:
        task = tasks[0]
        assert "id" in task
        assert "project_id" in task
        assert "title" in task
        assert "assignee" in task
        assert "priority" in task
        assert "status" in task


def test_api_ledgers():
    tree_res = client.get("/api/ledgers")
    assert tree_res.status_code == 200
    tree = tree_res.json()
    assert "PROJECTS" in tree
    assert "COMMAND_LOG" in tree
    assert "TASK_LEDGER" in tree
    assert "MEETING_LOG" in tree
    assert "KNOWLEDGE_PATENT" in tree

    # Not found file
    not_found = client.get("/api/ledgers/COMMAND_LOG/non_existent.md")
    assert not_found.status_code == 200
    assert not_found.json()["content"] == "파일을 찾을 수 없습니다."

    # Found file
    if len(tree["COMMAND_LOG"]) > 0:
        first_file = tree["COMMAND_LOG"][0]
        found = client.get(f"/api/ledgers/COMMAND_LOG/{first_file}")
        assert found.status_code == 200
        assert "content" in found.json()
        assert found.json()["content"] != "파일을 찾을 수 없습니다."


def test_api_websocket():
    with client.websocket_connect("/ws") as websocket:
        websocket.send_text("ping")


@pytest.mark.asyncio
async def test_connection_manager_broadcast():
    from backend.app.api.ws import ConnectionManager

    cm = ConnectionManager()

    class FakeWS:
        def __init__(self):
            self.sent = []

        async def accept(self):
            pass

        async def send_json(self, data):
            self.sent.append(data)

    fake_ws = FakeWS()
    await cm.connect(fake_ws)
    assert fake_ws in cm.active_connections

    await cm.broadcast("TEST_EVENT", {"status": "ok"})
    assert len(fake_ws.sent) == 1
    assert fake_ws.sent[0] == {"event": "TEST_EVENT", "data": {"status": "ok"}}

    cm.disconnect(fake_ws)
    assert fake_ws not in cm.active_connections


def test_api_system_reset():
    res = client.post("/api/system/reset")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert "deleted_files" in data


