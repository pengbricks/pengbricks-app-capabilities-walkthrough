from fastapi.testclient import TestClient

from server.app import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/capability-guides/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "capability-atlas"}


def test_root_redirects_to_child_home() -> None:
    response = client.get("/", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"] == "/capability-guides/"
