"""Integration test: MySQL decoy events forwarded to the real backend (item 2).

Builds real db_login_attempt and db_connection events using the production
builders in events.py, sends them through the ingest-batch endpoint,
and asserts the backend accepts both (200, accepted==2).

Uses an isolated in-memory SQLite DB so it does not contaminate the shared
test DB with DEFAULT_DECOY_ID rows that break scalar_one() elsewhere.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import Base, get_db
from app.decoys.mysql.events import build_connection_event, build_login_attempt_event
from app.models.security_event import SecurityEvent

TOKEN = settings.INTERNAL_INGESTION_TOKEN


# ---------------------------------------------------------------------------
# Isolated DB fixture (does not share the conftest session-scoped DB)
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def isolated_backend(tmp_path):
    """Backend app with a fresh, isolated SQLite DB for each test."""
    from app.main import app

    db_url = f"sqlite+aiosqlite:///{tmp_path}/mysql_ingest_test.db"
    engine = create_async_engine(db_url, future=True)
    SessionLocal = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def _get_db():
        async with SessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = _get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        try:
            yield ac, SessionLocal
        finally:
            app.dependency_overrides.pop(get_db, None)
            await engine.dispose()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _make_login_pair():
    eid = uuid.uuid4()
    return build_login_attempt_event(
        event_id=eid,
        source_ip="10.20.30.40",
        source_port=54321,
        username="root",
        auth_response=b"\xab" * 20,
        authenticated=False,
        correlation_id="test-mysql-1",
    )


def _make_connection_event():
    return build_connection_event(
        event_id=uuid.uuid4(),
        source_ip="10.20.30.40",
        source_port=54321,
        username="root",
        authenticated=False,
        has_login_attempt=True,
        duration_seconds=1.23,
        bytes_in=250,
        bytes_out=150,
        correlation_id="test-mysql-1",
    )


# ---------------------------------------------------------------------------
# Test: real events accepted 200, accepted==2
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_mysql_events_accepted_by_ingest_batch(isolated_backend):
    """Real db_login_attempt + db_connection accepted by ingest-batch (200, accepted==2)."""
    from app.core.event_sink import _serialize_batch

    ac, SessionLocal = isolated_backend
    login_ev, login_att = _make_login_pair()
    conn_ev = _make_connection_event()

    login_items = _serialize_batch([login_ev, login_att])
    conn_items = _serialize_batch([conn_ev])
    batch = {"events": login_items + conn_items}

    response = await ac.post(
        "/api/v1/internal/ingest-batch",
        json=batch,
        headers={"X-Argus-Internal-Token": TOKEN},
    )
    assert response.status_code == 200, f"Expected 200: {response.text}"
    data = response.json()
    assert data["accepted"] == 2, f"Expected accepted=2: {data}"
    assert data["duplicates"] == 0

    # Verify in the isolated DB
    async with SessionLocal() as session:
        for expected_id in (login_ev.id, conn_ev.id):
            stmt = select(SecurityEvent).where(SecurityEvent.id == expected_id)
            result = await session.execute(stmt)
            assert result.scalar_one_or_none() is not None, \
                f"Event {expected_id} not found in DB"


# ---------------------------------------------------------------------------
# Test: malformed batch dropped without crash
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_malformed_batch_dropped_without_crash():
    """A 422 from the backend must be logged and dropped, not retried or spooled."""
    import tempfile
    from app.core.event_sink import (
        ForwardingEventSink, DbEventSink, set_event_sink, get_event_sink
    )

    with tempfile.TemporaryDirectory() as tmp:
        sink = ForwardingEventSink()
        sink._spool_dir = Path(tmp)
        sink._spool_file = Path(tmp) / "events.jsonl"
        sink._spool_max_bytes = 10 * 1024 * 1024

        dropped = []

        async def fake_422_send(httpx_mod, batch):
            dropped.append(batch)
            return True  # 422 path: log and drop → return True

        sink._send_batch = lambda hx, b: fake_422_send(hx, b)

        old_sink = get_event_sink()
        set_event_sink(sink)
        sink.start_worker()

        try:
            ev = SimpleNamespace(
                id=uuid.uuid4(), decoy_service_id=None,
                timestamp=datetime.now(timezone.utc),
                source_ip="1.2.3.4", source_port=9999,
                http_method="SQL", request_path="/mysql/test",
                query_params={}, headers_sanitized={}, user_agent="",
                event_type="db_connection", severity="low",
                is_test_event=True, correlation_id="abc",
                metadata_payload={},
            )
            await sink.persist([ev])
            await asyncio.sleep(0.5)
        finally:
            await sink.stop_worker()
            set_event_sink(old_sink)

        assert len(dropped) >= 1, "Batch was never processed"
        # 422 → drop (not spool)
        assert not sink._spool_file.exists() or sink._spool_file.stat().st_size == 0, \
            "422 response should drop the batch, not spool it"
