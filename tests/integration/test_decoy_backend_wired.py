"""Integration test: decoy app wired to real backend app (task 9).

Wires app.decoy_main's ForwardingEventSink to POST to app.main's
ingest-batch endpoint using in-process ASGI transport + SQLite.

Asserts:
- Login + upload produce SecurityEvent rows WITH LoginAttempt / CapturedFile
  children in the backend DB.
- Replaying the same batch creates no duplicates.
- Wrong/missing token rejected with 403.
- Backend down -> events spool to disk; backend back -> replayed.
"""

import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.core.event_sink import (
    DbEventSink,
    EventForwarderSession,
    ForwardingEventSink,
    get_event_sink,
    set_event_sink,
)
from app.database import Base, get_db
from app.models.captured_file import CapturedFile
from app.models.decoy_service import DecoyService
from app.models.login_attempt import LoginAttempt
from app.models.security_event import SecurityEvent

TOKEN = settings.INTERNAL_INGESTION_TOKEN


# ---------------------------------------------------------------------------
# Fixtures: separate SQLite DB for the backend, wired decoy sink
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def wired_setup(tmp_path):
    """Set up backend app with a fresh SQLite DB and decoy app with forwarding sink.

    Returns (backend_client, decoy_client, backend_session_factory, cleanup).
    """
    from app.main import app as backend_app
    from app.decoy_main import app as decoy_app

    db_path = tmp_path / "wired_test.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"

    engine = create_async_engine(db_url, future=True)
    SessionLocal = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False,
    )

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Override backend's get_db to use our test engine
    async def backend_get_db():
        async with SessionLocal() as session:
            yield session

    backend_app.dependency_overrides[get_db] = backend_get_db

    # Set up decoy sink pointing at the backend's ASGI app
    spool_dir = tmp_path / "spool"
    spool_dir.mkdir()

    sink = ForwardingEventSink()
    sink._spool_dir = spool_dir
    sink._spool_file = spool_dir / "events.jsonl"
    sink._spool_max_bytes = 10 * 1024 * 1024
    sink._ingest_url = "http://testserver/api/v1/internal/ingest-batch"
    sink._token = TOKEN

    # Monkey-patch _send_batch to use ASGITransport to the backend app
    async def _send_batch_via_asgi(httpx_mod, batch):
        transport = ASGITransport(app=backend_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.post(
                "/api/v1/internal/ingest-batch",
                json={"events": batch},
                headers={"X-Argus-Internal-Token": sink._token},
            )
        if resp.status_code == 200:
            return True
        elif resp.status_code == 422:
            import app.logging_config as lc
            lc.logger.error(f"Backend rejected batch (422) — dropping {len(batch)} events")
            return True
        elif resp.status_code == 403:
            import app.logging_config as lc
            lc.logger.error("Backend rejected token (403) — retrying with backoff")
            return False
        else:
            return False

    sink._send_batch = lambda httpx_mod, batch: _send_batch_via_asgi(httpx_mod, batch)

    # Install sink and start worker
    old_sink = get_event_sink()
    set_event_sink(sink)
    sink.replay_spool_on_start()
    sink.start_worker()

    # Override decoy's get_db with EventForwarderSession
    async def decoy_get_db():
        session = EventForwarderSession()
        try:
            yield session
        finally:
            pass

    decoy_app.dependency_overrides[get_db] = decoy_get_db

    # Clients
    backend_transport = ASGITransport(app=backend_app)
    decoy_transport = ASGITransport(app=decoy_app)

    async with AsyncClient(transport=backend_transport, base_url="http://testserver") as bc, \
               AsyncClient(transport=decoy_transport, base_url="http://testserver") as dc:
        yield bc, dc, SessionLocal, sink, spool_dir

        # Cleanup
        await sink.stop_worker()
        set_event_sink(old_sink)
        backend_app.dependency_overrides.clear()
        # Restore decoy app's original get_db override (not clear — decoy_main
        # sets it at import time)
        from app.decoy_main import _get_forwarder_db
        decoy_app.dependency_overrides[get_db] = _get_forwarder_db
        await engine.dispose()


# ---------------------------------------------------------------------------
# Login + upload produce child rows in backend DB
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_login_produces_event_with_login_attempt(wired_setup):
    """Decoy login must produce a SecurityEvent + LoginAttempt in backend DB."""
    backend_client, decoy_client, SessionLocal, sink, spool_dir = wired_setup

    response = await decoy_client.post(
        "/api/v1/decoy/auth/login",
        data={"username": "attacker", "password": "stolen_pass_123"},
        headers={"X-Argus-Test-Token": "test", "User-Agent": "curl/8.0"},
    )
    assert response.status_code in (401, 403)

    # Wait for forwarding + ingest
    await asyncio.sleep(1.0)

    async with SessionLocal() as session:
        stmt = (
            select(SecurityEvent)
            .where(SecurityEvent.event_type == "login_attempt")
            .order_by(SecurityEvent.timestamp.desc())
        )
        result = await session.execute(stmt)
        events = result.scalars().all()
        assert len(events) >= 1

        ev = events[0]
        assert ev.source_ip is not None
        assert ev.request_path == "/api/v1/decoy/auth/login"

        # Check LoginAttempt child
        la_stmt = select(LoginAttempt).where(LoginAttempt.event_id == ev.id)
        la_result = await session.execute(la_stmt)
        la = la_result.scalar_one_or_none()
        assert la is not None
        assert la.submitted_username == "attacker"
        assert la.password_length == len("stolen_pass_123")


@pytest.mark.asyncio
async def test_upload_produces_event_with_captured_file(wired_setup):
    """Decoy file upload must produce a SecurityEvent + CapturedFile in backend DB."""
    backend_client, decoy_client, SessionLocal, sink, spool_dir = wired_setup

    file_content = b"fake crash dump data for testing"
    response = await decoy_client.post(
        "/api/v1/decoy/upload/diagnostics",
        files={"file": ("crash.dmp", file_content, "application/octet-stream")},
        headers={"X-Argus-Test-Token": "test"},
    )
    assert response.status_code in (200, 201, 202)

    # Wait for forwarding
    await asyncio.sleep(1.0)

    async with SessionLocal() as session:
        stmt = (
            select(SecurityEvent)
            .where(SecurityEvent.event_type == "file_upload")
            .order_by(SecurityEvent.timestamp.desc())
        )
        result = await session.execute(stmt)
        events = result.scalars().all()
        assert len(events) >= 1

        ev = events[0]
        assert ev.request_path == "/api/v1/decoy/upload/diagnostics"

        # Check CapturedFile child
        cf_stmt = select(CapturedFile).where(CapturedFile.event_id == ev.id)
        cf_result = await session.execute(cf_stmt)
        cf = cf_result.scalar_one_or_none()
        assert cf is not None
        assert cf.sha256_hash is not None
        assert cf.file_size_bytes == len(file_content)


# ---------------------------------------------------------------------------
# Idempotency: same batch twice = no duplicates
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_replay_same_batch_no_duplicates(wired_setup):
    """Replaying the same event id must not create duplicates."""
    backend_client, decoy_client, SessionLocal, sink, spool_dir = wired_setup

    event_id = str(uuid.uuid4())
    batch = {
        "events": [{
            "event": {
                "id": event_id,
                "decoy_service_id": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source_ip": "1.2.3.4",
                "source_port": 80,
                "http_method": "GET",
                "request_path": "/test",
                "query_params": {},
                "headers_sanitized": {},
                "user_agent": "",
                "event_type": "recon_probe",
                "severity": "low",
                "is_test_event": True,
                "correlation_id": None,
                "metadata_payload": {},
            },
            "login_attempt": None,
            "captured_file": None,
        }],
    }

    # First send
    resp1 = await backend_client.post(
        "/api/v1/internal/ingest-batch",
        json=batch,
        headers={"X-Argus-Internal-Token": TOKEN},
    )
    assert resp1.status_code == 200
    assert resp1.json()["accepted"] == 1

    # Second send (same id)
    resp2 = await backend_client.post(
        "/api/v1/internal/ingest-batch",
        json=batch,
        headers={"X-Argus-Internal-Token": TOKEN},
    )
    assert resp2.status_code == 200
    assert resp2.json()["accepted"] == 0
    assert resp2.json()["duplicates"] == 1

    # Verify only 1 row
    async with SessionLocal() as session:
        stmt = select(SecurityEvent).where(SecurityEvent.id == uuid.UUID(event_id))
        result = await session.execute(stmt)
        events = result.scalars().all()
        assert len(events) == 1


# ---------------------------------------------------------------------------
# Token rejection
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_wrong_token_rejected(wired_setup):
    """Wrong token must be rejected with 403."""
    backend_client, decoy_client, SessionLocal, sink, spool_dir = wired_setup

    response = await backend_client.post(
        "/api/v1/internal/ingest-batch",
        json={"events": []},
        headers={"X-Argus-Internal-Token": "wrong_token"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_missing_token_rejected(wired_setup):
    """Missing token must be rejected with 403."""
    backend_client, decoy_client, SessionLocal, sink, spool_dir = wired_setup

    response = await backend_client.post(
        "/api/v1/internal/ingest-batch",
        json={"events": []},
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Backend down -> spool; backend back -> replay
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_backend_down_spools_and_replays_on_recovery(wired_setup):
    """When backend is unreachable, events spool; on recovery they are delivered."""
    backend_client, decoy_client, SessionLocal, sink, spool_dir = wired_setup

    # Simulate backend down: make _send_batch fail
    async def fail_batch(httpx_mod, batch):
        return False

    sink._send_batch = lambda httpx_mod, batch: fail_batch(httpx_mod, batch)

    # Send a decoy login (will spool since backend is "down")
    await decoy_client.post(
        "/api/v1/decoy/auth/login",
        data={"username": "spool_test", "password": "spool_pass"},
        headers={"X-Argus-Test-Token": "test"},
    )
    await asyncio.sleep(1.0)

    # Spool file should exist
    assert sink._spool_file.exists(), "Spool file should exist after backend failure"
    spool_content = sink._spool_file.read_text()
    assert len(spool_content) > 0, "Spool should contain the failed event"

    # Now restore backend connectivity
    async def succeed_batch(httpx_mod, batch):
        transport = ASGITransport(app=__import__("app.main", fromlist=["app"]).app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.post(
                "/api/v1/internal/ingest-batch",
                json={"events": batch},
                headers={"X-Argus-Internal-Token": sink._token},
            )
        return resp.status_code == 200

    sink._send_batch = lambda httpx_mod, batch: succeed_batch(httpx_mod, batch)

    # Push a new event to trigger the worker — on success it will replay spool
    from app.core.event_sink import _serialize_event
    from types import SimpleNamespace
    import uuid as _uuid
    trigger_ev = SimpleNamespace(
        id=_uuid.uuid4(), decoy_service_id=None,
        timestamp=datetime.now(timezone.utc), source_ip="1.2.3.4",
        source_port=99, http_method="GET", request_path="/trigger",
        query_params={}, headers_sanitized={}, user_agent="",
        event_type="recon_probe", severity="low", is_test_event=True,
        correlation_id=None, metadata_payload={},
    )
    sink._queue.put_nowait(_serialize_event(trigger_ev))

    # Wait for worker to send + replay spool
    await asyncio.sleep(3.0)

    # Verify event arrived in backend DB
    async with SessionLocal() as session:
        stmt = (
            select(SecurityEvent)
            .where(SecurityEvent.event_type == "login_attempt")
            .order_by(SecurityEvent.timestamp.desc())
        )
        result = await session.execute(stmt)
        events = result.scalars().all()
        # At least one event should have arrived from the spool
        login_events = [e for e in events if e.request_path == "/api/v1/decoy/auth/login"]
        assert len(login_events) >= 1, "Spooled event should be delivered after backend recovery"
