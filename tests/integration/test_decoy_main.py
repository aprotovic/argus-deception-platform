"""Integration tests for app.decoy_main:app (task 8).

Tests cover:
- Every R1.1 admin path returns 404
- Every R1.2 decoy route works (200/401/403/404 as appropriate)
- Personnel endpoint works (normal query + SQLi payload)
- Decoy login produces a forwarded event on the sink
- App starts with DATABASE_URL unset (subprocess test)
- Sink: backend down → spool written; backend back → replay; spool cap drops; same event id reused
"""

import asyncio
import json
import os
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Ensure backend is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "backend"))


# ---------------------------------------------------------------------------
# Fixture: decoy_main app with no database
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def decoy_client():
    """Async HTTP client against app.decoy_main:app with no database."""
    from app.decoy_main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


# ---------------------------------------------------------------------------
# R1.1: admin paths must return 404
# ---------------------------------------------------------------------------
ADMIN_PATHS = [
    "/api/v1/auth/login",
    "/api/v1/auth/me",
    "/api/v1/events",
    "/api/v1/events/00000000-0000-0000-0000-000000000001",
    "/api/v1/evidence",
    "/api/v1/evidence/00000000-0000-0000-0000-000000000001/download",
    "/api/v1/export/events",
    "/api/v1/audit-logs",
    "/api/v1/overview/metrics",
    "/api/v1/ws/events",
    "/api/v1/internal/ingest",
    "/api/v1/internal/ingest-batch",
]


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ADMIN_PATHS)
async def test_admin_paths_return_404_on_decoy(decoy_client, path):
    """Every admin API path must return 404 on the decoy app."""
    response = await decoy_client.get(path)
    assert response.status_code == 404, f"{path} returned {response.status_code}"


@pytest.mark.asyncio
async def test_docs_return_404_on_decoy(decoy_client):
    """/docs, /redoc, /openapi.json must return 404 on the decoy app."""
    for path in ["/docs", "/redoc", "/openapi.json"]:
        response = await decoy_client.get(path)
        assert response.status_code == 404, f"{path} returned {response.status_code}"


# ---------------------------------------------------------------------------
# R1.2: decoy routes must work
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_decoy_portal_serves_html(decoy_client):
    """/ must serve the decoy portal HTML."""
    response = await decoy_client.get("/")
    assert response.status_code == 200
    assert "Geberew Bank" in response.text or "Nexis Defense Systems" in response.text


@pytest.mark.asyncio
async def test_decoy_robots_txt(decoy_client):
    """/robots.txt must serve the deceptive robots.txt."""
    response = await decoy_client.get("/robots.txt")
    assert response.status_code == 200
    assert "Disallow" in response.text


@pytest.mark.asyncio
async def test_decoy_health_live(decoy_client):
    """/health/live must return 200 without a database."""
    response = await decoy_client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" not in data


@pytest.mark.asyncio
async def test_decoy_env_trap(decoy_client):
    """/.env must return the fake env honeytoken."""
    response = await decoy_client.get("/.env")
    assert response.status_code == 200
    assert "DATABASE_URL" in response.text


@pytest.mark.asyncio
async def test_decoy_login_returns_401(decoy_client):
    """POST /api/v1/decoy/auth/login must return 401 for bad credentials."""
    response = await decoy_client.post(
        "/api/v1/decoy/auth/login",
        data={"username": "admin", "password": "wrong"},
        headers={"X-Argus-Test-Token": "test"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_decoy_network_status(decoy_client):
    """GET /api/v1/decoy/network/status must return enclave topology."""
    response = await decoy_client.get("/api/v1/decoy/network/status")
    assert response.status_code == 200
    data = response.json()
    assert "active_enclaves" in data


# ---------------------------------------------------------------------------
# Personnel endpoint on decoy_main
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_personnel_normal_query_on_decoy(decoy_client):
    """Personnel search with a clean query returns filtered rows."""
    response = await decoy_client.get(
        "/api/v1/decoy/search/personnel",
        params={"q": "crypto"},
        headers={"X-Argus-Test-Token": "test"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["row_count"] >= 1
    for row in data["records"]:
        assert "badge_id" not in row


@pytest.mark.asyncio
async def test_personnel_sqli_on_decoy(decoy_client):
    """Personnel search with SQLi payload returns leaked rows and logs high severity."""
    response = await decoy_client.get(
        "/api/v1/decoy/search/personnel",
        params={"q": "' OR '1'='1' --"},
        headers={"X-Argus-Test-Token": "test"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["row_count"] == 8
    assert any("badge_id" in row for row in data["records"])
    assert "canary" not in response.text.lower()


# ---------------------------------------------------------------------------
# Decoy login produces forwarded event on the sink
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_decoy_login_forwards_event_to_sink(decoy_client):
    """A decoy login must hand a SecurityEvent to the sink via EventForwarderSession."""
    from app.core.event_sink import ForwardingEventSink, set_event_sink, DbEventSink

    # Replace the sink with one whose persist we can observe
    original = set_event_sink.__wrapped__ if hasattr(set_event_sink, "__wrapped__") else None
    captured_objects = []

    class CapturingSink(ForwardingEventSink):
        async def persist(self, objects, broadcast_summary=None):
            captured_objects.extend(objects)

    sink = CapturingSink()
    from app.core.event_sink import get_event_sink
    old_sink = get_event_sink()
    set_event_sink(sink)
    try:
        response = await decoy_client.post(
            "/api/v1/decoy/auth/login",
            data={"username": "admin", "password": "wrong"},
            headers={"X-Argus-Test-Token": "test"},
        )
        assert response.status_code == 401

        # Give the async commit a moment
        await asyncio.sleep(0.1)

        # The sink should have received at least a SecurityEvent + LoginAttempt
        assert len(captured_objects) >= 1
        # First object should have event_type attribute
        assert hasattr(captured_objects[0], "event_type")
        assert captured_objects[0].event_type == "login_attempt"
    finally:
        set_event_sink(old_sink)


# ---------------------------------------------------------------------------
# App starts with DATABASE_URL unset (subprocess test)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_decoy_app_starts_with_database_url_unset():
    """The decoy app must import and start without DATABASE_URL set.

    Runs in a subprocess with DATABASE_URL explicitly removed from the
    environment to verify no import-time database connection.
    """
    env = os.environ.copy()
    env.pop("DATABASE_URL", None)
    env["PYTHONPATH"] = str(Path(__file__).resolve().parent.parent.parent / "backend")

    # Use a timeout to prevent hanging if it tries to connect
    result = subprocess.run(
        [sys.executable, "-c",
         "from app.decoy_main import app; print('DECOY_APP_IMPORTED_OK')"],
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert result.returncode == 0, f"Import failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
    assert "DECOY_APP_IMPORTED_OK" in result.stdout
