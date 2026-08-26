import pytest
import json
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.core.config import settings

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_env(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "test")
    monkeypatch.setattr(settings, "AI_PROVIDER", "mock")

def get_auth_header(email: str = "owner.a@demo.local", role: str = "OWNER", company_id: str = "comp_textile_a"):
    data = {
        "sub": "user_owner_a" if role == "OWNER" else "user_admin",
        "email": email,
        "name": "Rajesh V. Singhania" if role == "OWNER" else "Alexander Sterling",
        "role": role,
        "company_id": company_id if role == "OWNER" else None
    }
    token = create_access_token(data)
    return {"Authorization": f"Bearer {token}"}

def test_sse_streaming_endpoint_for_owner():
    headers = get_auth_header(role="OWNER", company_id="comp_textile_a")
    response = client.post(
        "/api/chat/stream",
        json={"prompt": "What were my total sales this month?"},
        headers=headers
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    
    raw_lines = response.text.split("\n\n")
    events = []
    for block in raw_lines:
        block = block.strip()
        if block.startswith("data: "):
            data_str = block[6:]
            if data_str != "[DONE]":
                events.append(json.loads(data_str))

    assert len(events) > 0
    event_types = [e["type"] for e in events]
    assert "status" in event_types
    assert "tool_start" in event_types
    assert "tool_complete" in event_types
    assert "token" in event_types or "answer" in event_types
    assert "complete" in event_types

def test_sse_streaming_endpoint_unauthorized_without_token():
    response = client.post(
        "/api/chat/stream",
        json={"prompt": "What were my sales?"}
    )
    assert response.status_code == 401

def test_sse_streaming_admin_comparison():
    headers = get_auth_header(email="admin@demo.local", role="ADMIN")
    response = client.post(
        "/api/chat/stream",
        json={"prompt": "Compare Textile A and Textile B"},
        headers=headers
    )
    assert response.status_code == 200
    raw_lines = response.text.split("\n\n")
    events = []
    for block in raw_lines:
        block = block.strip()
        if block.startswith("data: ") and block[6:] != "[DONE]":
            events.append(json.loads(block[6:]))

    tool_starts = [e for e in events if e.get("type") == "tool_start"]
    assert any(t.get("tool") == "compare_companies" for t in tool_starts)
