"""Integration tests for POST /api/v1/internal/ingest-batch (task 5).

Tests cover:
- Token: missing, wrong, right
- 422 on missing event.id
- 422 on oversized string field
- 422 on over-limit batch (>100)
- Idempotency: same batch twice → stored once
- Deduplication inside one batch → stored once
- Broadcast only for new events
- Default DecoyService created on first ingest
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.decoy_service import DecoyService
from app.models.security_event import SecurityEvent

TOKEN = settings.INTERNAL_INGESTION_TOKEN


def _make_event(event_id: str | None = None, **overrides) -> dict:
    """Generate a valid ingest event dict for testing."""
    if event_id is None:
        event_id = str(uuid.uuid4())
    event = {
        "id": event_id,
        "decoy_service_id": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source_ip": "10.0.0.1",
        "source_port": 12345,
        "http_method": "POST",
        "request_path": "/api/v1/decoy/auth/login",
        "query_params": {},
        "headers_sanitized": {},
        "user_agent": "test-agent",
        "event_type": "login_attempt",
        "severity": "medium",
        "is_test_event": True,
        "correlation_id": "test-corr-1",
        "metadata_payload": {"test": True},
    }
    event.update(overrides)
    return event


def _make_item(event_id: str | None = None, **event_overrides) -> dict:
    """Generate a valid IngestEventItem dict."""
    return {"event": _make_event(event_id, **event_overrides)}


def _make_batch(event_ids: list[str] | None = None, count: int = 1) -> dict:
    """Generate a batch dict."""
    if event_ids is None:
        event_ids = [str(uuid.uuid4()) for _ in range(count)]
    return {"events": [_make_item(eid) for eid in event_ids]}


# ---------------------------------------------------------------------------
# Token tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ingest_batch_missing_token_returns_403(client: AsyncClient):
    response = await client.post(
        "/api/v1/internal/ingest-batch",
        json=_make_batch(count=1),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_ingest_batch_wrong_token_returns_403(client: AsyncClient):
    response = await client.post(
        "/api/v1/internal/ingest-batch",
        json=_make_batch(count=1),
        headers={"X-Argus-Internal-Token": "wrong_token_value"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_ingest_batch_correct_token_returns_200(client: AsyncClient):
    response = await client.post(
        "/api/v1/internal/ingest-batch",
        json=_make_batch(count=1),
        headers={"X-Argus-Internal-Token": TOKEN},
    )
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ingest_batch_missing_event_id_returns_422(client: AsyncClient):
    """event.id is REQUIRED — missing it must return 422."""
    event = _make_event()
    del event["id"]
    response = await client.post(
        "/api/v1/internal/ingest-batch",
        json={"events": [{"event": event}]},
        headers={"X-Argus-Internal-Token": TOKEN},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_ingest_batch_oversized_string_returns_422(client: AsyncClient):
    """source_ip max_length is 45 — a 46-char string must return 422."""
    event = _make_event()
    event["source_ip"] = "x" * 46
    response = await client.post(
        "/api/v1/internal/ingest-batch",
        json={"events": [{"event": event}]},
        headers={"X-Argus-Internal-Token": TOKEN},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_ingest_batch_over_limit_returns_422(client: AsyncClient):
    """Batch over 100 events must return 422."""
    batch = _make_batch(count=101)
    response = await client.post(
        "/api/v1/internal/ingest-batch",
        json=batch,
        headers={"X-Argus-Internal-Token": TOKEN},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Idempotency tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ingest_batch_same_batch_twice_stored_once(
    client: AsyncClient, db_session: AsyncSession
):
    """Sending the same batch twice must store each event exactly once."""
    event_id = str(uuid.uuid4())
    batch = _make_batch(event_ids=[event_id])

    # First send
    response = await client.post(
        "/api/v1/internal/ingest-batch",
        json=batch,
        headers={"X-Argus-Internal-Token": TOKEN},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["accepted"] == 1
    assert data["duplicates"] == 0

    # Second send (same event id)
    response = await client.post(
        "/api/v1/internal/ingest-batch",
        json=batch,
        headers={"X-Argus-Internal-Token": TOKEN},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["accepted"] == 0
    assert data["duplicates"] == 1

    # Verify only 1 event in DB
    stmt = select(SecurityEvent).where(SecurityEvent.id == uuid.UUID(event_id))
    result = await db_session.execute(stmt)
    events = result.scalars().all()
    assert len(events) == 1


@pytest.mark.asyncio
async def test_ingest_batch_duplicate_inside_one_batch_stored_once(
    client: AsyncClient, db_session: AsyncSession
):
    """Two items with the same event id in one batch must store exactly one."""
    event_id = str(uuid.uuid4())
    batch = {
        "events": [_make_item(event_id), _make_item(event_id)],
    }

    response = await client.post(
        "/api/v1/internal/ingest-batch",
        json=batch,
        headers={"X-Argus-Internal-Token": TOKEN},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["accepted"] == 1
    assert data["duplicates"] == 1

    stmt = select(SecurityEvent).where(SecurityEvent.id == uuid.UUID(event_id))
    result = await db_session.execute(stmt)
    events = result.scalars().all()
    assert len(events) == 1


# ---------------------------------------------------------------------------
# Broadcast test
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ingest_batch_broadcast_only_for_new_events(client: AsyncClient):
    """Broadcast must fire for new events and NOT for duplicates."""
    event_id = str(uuid.uuid4())
    batch = _make_batch(event_ids=[event_id])

    with patch("app.api.v1.internal.ws_manager") as mock_ws:
        mock_ws.broadcast_event = AsyncMock()

        # First send — should broadcast once
        await client.post(
            "/api/v1/internal/ingest-batch",
            json=batch,
            headers={"X-Argus-Internal-Token": TOKEN},
        )
        assert mock_ws.broadcast_event.await_count == 1

        # Second send — all duplicates, no broadcast
        await client.post(
            "/api/v1/internal/ingest-batch",
            json=batch,
            headers={"X-Argus-Internal-Token": TOKEN},
        )
        assert mock_ws.broadcast_event.await_count == 1  # still 1, not 2


# ---------------------------------------------------------------------------
# Default decoy creation test
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ingest_batch_creates_default_decoy_on_first_ingest(
    client: AsyncClient, db_session: AsyncSession
):
    """First ingest must create a DecoyService with DEFAULT_DECOY_ID."""
    event_id = str(uuid.uuid4())
    batch = _make_batch(event_ids=[event_id])

    response = await client.post(
        "/api/v1/internal/ingest-batch",
        json=batch,
        headers={"X-Argus-Internal-Token": TOKEN},
    )
    assert response.status_code == 200

    default_id = uuid.UUID(settings.DEFAULT_DECOY_ID)
    stmt = select(DecoyService).where(DecoyService.id == default_id)
    result = await db_session.execute(stmt)
    decoy = result.scalar_one_or_none()
    assert decoy is not None
    assert decoy.name == "Nexis Defense Core Portal"
