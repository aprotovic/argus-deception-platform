"""Realism hardening tests for decoy_main (points 1-4).

Tests:
1. No response body on the decoy contains the word "canary".
2. Every 404/405 returns the same Apache-style HTML body — including admin
   paths, /docs, /openapi.json, and genuinely unknown paths.
3. /health/live returns {"status": "ok"} with no "service" key.
4. Real headers and bodies checked via ASGITransport: unknown path,
   /api/v1/auth/login, /docs, and the Server header.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "backend"))


@pytest_asyncio.fixture
async def decoy_client():
    """Async HTTP client against app.decoy_main:app."""
    from app.decoy_main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


# ---------------------------------------------------------------------------
# 1. No "canary" in any response body
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_actuator_response_has_no_canary(decoy_client):
    """The /actuator response must not contain the word 'canary'."""
    response = await decoy_client.get("/actuator/health")
    assert response.status_code == 200
    assert "canary" not in response.text.lower()
    # Must have a normal build identifier instead
    data = response.json()
    assert "build_id" in data
    assert "canary_build" not in data


@pytest.mark.asyncio
async def test_env_response_has_no_canary(decoy_client):
    """The /.env honeytoken must not contain the word 'canary'."""
    response = await decoy_client.get("/.env")
    assert response.status_code == 200
    assert "canary" not in response.text.lower()


@pytest.mark.asyncio
async def test_aws_credentials_response_has_no_canary(decoy_client):
    """The /.aws/credentials honeytoken must not contain 'canary'."""
    response = await decoy_client.get("/.aws/credentials")
    assert response.status_code == 200
    assert "canary" not in response.text.lower()


# ---------------------------------------------------------------------------
# 2. Every 404/405 returns the same Apache-style HTML body
# ---------------------------------------------------------------------------
DECOY_404_SNIPPET = "Apache/2.4.52 (Ubuntu)"
DECOY_404_TITLE = "<title>404 Not Found</title>"


@pytest.mark.asyncio
async def test_unknown_path_returns_apache_404(decoy_client):
    """An genuinely unknown path returns the Apache-style HTML 404."""
    response = await decoy_client.get("/this-path-does-not-exist")
    assert response.status_code == 404
    assert DECOY_404_SNIPPET in response.text
    assert DECOY_404_TITLE in response.text


@pytest.mark.asyncio
async def test_admin_login_path_returns_apache_404(decoy_client):
    """/api/v1/auth/login must return the Apache 404, not FastAPI JSON."""
    response = await decoy_client.get("/api/v1/auth/login")
    assert response.status_code == 404
    assert DECOY_404_SNIPPET in response.text
    assert DECOY_404_TITLE in response.text
    # Must NOT be FastAPI's default JSON 404
    assert "application/json" not in response.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_docs_returns_apache_404(decoy_client):
    """/docs must return the Apache 404."""
    response = await decoy_client.get("/docs")
    assert response.status_code == 404
    assert DECOY_404_SNIPPET in response.text


@pytest.mark.asyncio
async def test_openapi_json_returns_apache_404(decoy_client):
    """/openapi.json must return the Apache 404."""
    response = await decoy_client.get("/openapi.json")
    assert response.status_code == 404
    assert DECOY_404_SNIPPET in response.text


@pytest.mark.asyncio
async def test_redoc_returns_apache_404(decoy_client):
    """/redoc must return the Apache 404."""
    response = await decoy_client.get("/redoc")
    assert response.status_code == 404
    assert DECOY_404_SNIPPET in response.text


@pytest.mark.asyncio
async def test_events_path_returns_apache_404(decoy_client):
    """/api/v1/events must return the Apache 404."""
    response = await decoy_client.get("/api/v1/events")
    assert response.status_code == 404
    assert DECOY_404_SNIPPET in response.text


@pytest.mark.asyncio
async def test_method_not_allowed_returns_apache_404(decoy_client):
    """A 405 Method Not Allowed must also return the Apache 404 body."""
    response = await decoy_client.delete("/")
    assert response.status_code == 404
    assert DECOY_404_SNIPPET in response.text


@pytest.mark.asyncio
async def test_all_404s_have_same_body(decoy_client):
    """All 404 responses must have byte-identical bodies (no path leakage)."""
    paths = [
        "/nonexistent",
        "/api/v1/auth/login",
        "/api/v1/events",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/v1/internal/ingest",
    ]
    bodies = []
    for path in paths:
        response = await decoy_client.get(path)
        assert response.status_code == 404
        bodies.append(response.text)
    # All bodies must be identical
    assert len(set(bodies)) == 1, f"404 bodies differ across paths: {set(bodies)}"


# ---------------------------------------------------------------------------
# 3. /health/live returns {"status": "ok"} with no service name
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_health_live_returns_ok_only(decoy_client):
    """/health/live must return {"status": "ok"} with no service name."""
    response = await decoy_client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data == {"status": "ok"}
    assert "service" not in data
    assert "argus" not in response.text.lower()


# ---------------------------------------------------------------------------
# 4. Real headers and bodies
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_real_headers_unknown_path(decoy_client):
    """Check real response headers for an unknown path."""
    response = await decoy_client.get("/unknown-path-xyz")
    assert response.status_code == 404
    # The body must be HTML, not JSON
    assert "text/html" in response.headers.get("content-type", "")
    # Security headers must be present
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"


@pytest.mark.asyncio
async def test_real_headers_admin_path(decoy_client):
    """Check real response headers for /api/v1/auth/login."""
    response = await decoy_client.get("/api/v1/auth/login")
    assert response.status_code == 404
    assert "text/html" in response.headers.get("content-type", "")
    # Must not be JSON
    assert "application/json" not in response.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_real_headers_docs(decoy_client):
    """Check real response headers for /docs."""
    response = await decoy_client.get("/docs")
    assert response.status_code == 404
    assert "text/html" in response.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_server_header(decoy_client):
    """Check the Server header — if uvicorn adds it, report it."""
    response = await decoy_client.get("/health/live")
    server_header = response.headers.get("server", "")
    # The SecurityHeadersMiddleware deletes "server" if present.
    # If uvicorn re-adds it, this test will show what value it has.
    # We assert it's either absent or does not reveal the framework.
    if server_header:
        # If present, it must not say "uvicorn" or "Python" or "starlette"
        server_lower = server_header.lower()
        assert "uvicorn" not in server_lower, \
            f"Server header reveals uvicorn: '{server_header}'"
        assert "starlette" not in server_lower
        assert "python" not in server_lower
