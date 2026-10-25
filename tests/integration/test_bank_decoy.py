"""Integration tests for the Geberew Bank decoy portal (bank_router.py).

Tests cover page routing, HTML content, API endpoints, telemetry capture,
SQLi detection, password fingerprinting, rate limiting, and file upload quarantine.

Plain pytest + pytest-asyncio only. No Hypothesis or other libraries.
One known pre-existing test failure exists in the wider test suite
(test_decoy_honeytoken_classified_download): do not fix it.
"""

import io
import os
import sys
from pathlib import Path

# Set env vars BEFORE any app imports so settings resolve correctly.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./data/test.db")
os.environ.setdefault("QUARANTINE_STORAGE_DIR", "./data/test_quarantine")
os.environ.setdefault("SECRET_KEY", "test_secret_key_32_bytes_minimum_for_pytest")
os.environ.setdefault("ARGUS_PASSWORD_FINGERPRINT_SECRET", "test_hmac_fingerprint_salt_secret")
os.environ.setdefault("INTERNAL_INGESTION_TOKEN", "test_token")
os.environ.setdefault("BACKEND_INGEST_URL", "http://localhost:8000")
os.environ.setdefault("DECOY_SPOOL_DIR", "/tmp/argus_test_spool")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "backend"))

# Ensure quarantine dir exists before any test runs.
Path("./data/test_quarantine").mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def decoy_client():
    from app.decoy_main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Group 1 — Page routes (React app now served)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_landing_page(decoy_client):
    """GET /bank → 200, text/html, React root element present, title contains brand name."""
    response = await decoy_client.get("/bank")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert 'id="root"' in response.text
    assert "Geberew Bank" in response.text


@pytest.mark.asyncio
async def test_login_page(decoy_client):
    """GET /bank/login → 200, text/html, React root element present."""
    response = await decoy_client.get("/bank/login")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert 'id="root"' in response.text
    assert "Geberew Bank" in response.text


@pytest.mark.asyncio
async def test_dashboard_page(decoy_client):
    """GET /bank/dashboard → 200, text/html, React root element present."""
    response = await decoy_client.get("/bank/dashboard")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert 'id="root"' in response.text


@pytest.mark.asyncio
async def test_unknown_bank_path(decoy_client):
    """GET /bank/this-does-not-exist → 404."""
    response = await decoy_client.get("/bank/this-does-not-exist")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_css_served(decoy_client):
    """GET of the compiled React CSS asset → 200, content-type text/css."""
    from pathlib import Path
    # Find the compiled CSS filename dynamically
    bank_app_dir = Path(__file__).resolve().parent.parent.parent / "decoy" / "static" / "bank-app" / "assets"
    css_files = list(bank_app_dir.glob("index-*.css"))
    assert css_files, "React build CSS not found — run npm run build first"
    css_filename = css_files[0].name
    response = await decoy_client.get(f"/bank-app/assets/{css_filename}")
    assert response.status_code == 200
    assert "text/css" in response.headers["content-type"]


@pytest.mark.asyncio
async def test_static_asset_path_traversal(decoy_client):
    """GET /bank-app/../../etc/passwd → 404 (path traversal blocked)."""
    response = await decoy_client.get("/bank-app/../../etc/passwd")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Group 2 — Auth endpoints (unchanged)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_normal_failure(decoy_client):
    """POST /api/v1/bank/auth/login with bad creds → 401, login_attempt event captured."""
    from app.core.event_sink import ForwardingEventSink, get_event_sink, set_event_sink

    class CapturingSink(ForwardingEventSink):
        def __init__(self):
            self.objects = []

        async def persist(self, objects, broadcast_summary=None):
            self.objects.extend(objects)

    sink = CapturingSink()
    old_sink = get_event_sink()
    set_event_sink(sink)
    try:
        response = await decoy_client.post(
            "/api/v1/bank/auth/login",
            data={"username": "baduser", "password": "badpass"},
            headers={"X-Argus-Test-Token": "test"},
        )
        assert response.status_code == 401
        assert any(
            getattr(obj, "event_type", None) == "login_attempt"
            for obj in sink.objects
        ), f"Expected login_attempt event; got: {[getattr(o, 'event_type', None) for o in sink.objects]}"
    finally:
        set_event_sink(old_sink)


@pytest.mark.asyncio
async def test_login_fake_account_otp(decoy_client):
    """POST /api/v1/bank/auth/login with fake-account creds → 200, otp_required=True."""
    response = await decoy_client.post(
        "/api/v1/bank/auth/login",
        data={"username": "j.hartwell", "password": "Hartwell2024!"},
        headers={"X-Argus-Test-Token": "test"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body.get("otp_required") is True


@pytest.mark.asyncio
async def test_login_sqli_detected(decoy_client):
    """POST /api/v1/bank/auth/login with SQLi payload → 401, sql_injection/critical event."""
    from app.core.event_sink import ForwardingEventSink, get_event_sink, set_event_sink

    class CapturingSink(ForwardingEventSink):
        def __init__(self):
            self.objects = []

        async def persist(self, objects, broadcast_summary=None):
            self.objects.extend(objects)

    sink = CapturingSink()
    old_sink = get_event_sink()
    set_event_sink(sink)
    try:
        response = await decoy_client.post(
            "/api/v1/bank/auth/login",
            data={"username": "' OR 1=1--", "password": "x"},
            headers={"X-Argus-Test-Token": "test"},
        )
        assert response.status_code == 401
        sqli_events = [
            obj for obj in sink.objects
            if getattr(obj, "event_type", None) == "sql_injection"
            and getattr(obj, "severity", None) == "critical"
        ]
        assert len(sqli_events) >= 1
    finally:
        set_event_sink(old_sink)


@pytest.mark.asyncio
async def test_login_no_plaintext_stored(decoy_client):
    """POST /api/v1/bank/auth/login — password fingerprinted, never stored as plaintext."""
    from app.core.event_sink import ForwardingEventSink, get_event_sink, set_event_sink

    class CapturingSink(ForwardingEventSink):
        def __init__(self):
            self.objects = []

        async def persist(self, objects, broadcast_summary=None):
            self.objects.extend(objects)

    sink = CapturingSink()
    old_sink = get_event_sink()
    set_event_sink(sink)
    try:
        response = await decoy_client.post(
            "/api/v1/bank/auth/login",
            data={"username": "testuser", "password": "TestPassword123"},
            headers={"X-Argus-Test-Token": "test"},
        )
        assert response.status_code in (200, 401)
        login_attempt_objs = [
            obj for obj in sink.objects
            if hasattr(obj, "password_hmac_fingerprint")
        ]
        assert len(login_attempt_objs) >= 1
        for la in login_attempt_objs:
            fingerprint = la.password_hmac_fingerprint
            assert isinstance(fingerprint, str)
            assert len(fingerprint) == 64
            assert all(c in "0123456789abcdefABCDEF" for c in fingerprint)
        raw_password = "TestPassword123"
        for obj in sink.objects:
            assert not hasattr(obj, "plaintext_password")
            if hasattr(obj, "password"):
                assert getattr(obj, "password") != raw_password
    finally:
        set_event_sink(old_sink)


@pytest.mark.asyncio
async def test_otp_wrong_length(decoy_client):
    """POST /api/v1/bank/auth/otp with otp_code='123' (3 digits) → 422."""
    response = await decoy_client.post(
        "/api/v1/bank/auth/otp",
        data={"username": "j.hartwell", "otp_code": "123"},
        headers={"X-Argus-Test-Token": "test"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_otp_six_digits(decoy_client):
    """POST /api/v1/bank/auth/otp with a 6-digit code → 403, error='verification_failed'."""
    response = await decoy_client.post(
        "/api/v1/bank/auth/otp",
        data={"username": "j.hartwell", "otp_code": "123456"},
        headers={"X-Argus-Test-Token": "test"},
    )
    assert response.status_code == 403
    body = response.json()
    assert body.get("error") == "verification_failed"


@pytest.mark.asyncio
async def test_login_rate_limit(decoy_client):
    """11 login requests from same IP triggers rate limit (429) on the 11th."""
    from app.api.v1.bank_router import bank_login_limiter

    bank_login_limiter.reset("127.0.0.1")

    last_response = None
    for _ in range(11):
        last_response = await decoy_client.post(
            "/api/v1/bank/auth/login",
            data={"username": "ratelimituser", "password": "x"},
            headers={"X-Argus-Test-Token": "test"},
        )

    assert last_response.status_code == 429


# ---------------------------------------------------------------------------
# Group 3 — Recovery, statements, KYC, support (unchanged)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_recover_always_200(decoy_client):
    """POST /api/v1/bank/auth/recover → 200, neutral message regardless of identifier."""
    response = await decoy_client.post(
        "/api/v1/bank/auth/recover",
        data={"identifier": "anyuser@example.com"},
        headers={"X-Argus-Test-Token": "test"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "If an account matching" in body.get("message", "")


@pytest.mark.asyncio
async def test_statements_honeytoken(decoy_client):
    """GET /api/v1/bank/statements/statement-2024-10.pdf → 200, PDF with ARGUS-HT- token."""
    response = await decoy_client.get(
        "/api/v1/bank/statements/statement-2024-10.pdf",
        headers={"X-Argus-Test-Token": "test"},
    )
    assert response.status_code == 200
    assert "application/pdf" in response.headers["content-type"]
    assert "ARGUS-HT-" in response.text


@pytest.mark.asyncio
async def test_kyc_upload_accepted(decoy_client):
    """POST /api/v1/bank/kyc/upload with a PNG file → 200."""
    png_bytes = b'\x89PNG\r\n\x1a\n' + b'\x00' * 50

    response = await decoy_client.post(
        "/api/v1/bank/kyc/upload",
        files={"file": ("test_id.png", png_bytes, "image/png")},
        headers={"X-Argus-Test-Token": "test"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_support_always_200(decoy_client):
    """POST /api/v1/bank/support/contact → 200, neutral thank-you message."""
    response = await decoy_client.post(
        "/api/v1/bank/support/contact",
        data={
            "full_name": "Test User",
            "email": "test@example.com",
            "subject": "Other",
            "message": "Hello",
        },
        headers={"X-Argus-Test-Token": "test"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "Thank you for contacting us" in body.get("message", "")
