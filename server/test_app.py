from fastapi.testclient import TestClient

from server.app import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/capability-guides/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "capability-atlas"}
