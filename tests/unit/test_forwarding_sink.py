"""Unit tests for ForwardingEventSink and EventForwarderSession (task 6).

Tests cover:
- Serialization fills missing ids and timestamps
- EventForwarderSession buffers and forwards on commit
- Spool written on backend failure (mocked httpx)
- Spool replayed when backend recovers
- Spool cap drops and counts
- Same event id reused on retry (spool stores it)
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.event_sink import (
    DbEventSink,
    EventForwarderSession,
    EventSink,
    ForwardingEventSink,
    _serialize_batch,
    _serialize_event,
    get_event_sink,
    make_default_decoy,
    set_event_sink,
)


def _make_sec_event(event_id=None, **kw):
    """Build a mock SecurityEvent-like object."""
    if event_id is None:
        event_id = uuid.uuid4()
    defaults = dict(
        id=event_id,
        decoy_service_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        timestamp=datetime.now(timezone.utc),
        source_ip="10.0.0.1",
        source_port=12345,
        http_method="POST",
        request_path="/api/v1/decoy/auth/login",
        query_params={},
        headers_sanitized={},
        user_agent="test",
        event_type="login_attempt",
        severity="medium",
        is_test_event=True,
        correlation_id="corr-1",
        metadata_payload={"test": True},
    )
    defaults.update(kw)
    return SimpleNamespace(**defaults)


def _make_login_attempt(event_id, la_id=None):
    if la_id is None:
        la_id = uuid.uuid4()
    return SimpleNamespace(
        id=la_id,
        event_id=event_id,
        submitted_username="admin",
        password_length=12,
        password_hmac_fingerprint="a" * 64,
        is_flagged_credential=True,
        success=False,
        failure_reason="invalid",
        client_ip="10.0.0.1",
        user_agent="test",
    )


# ---------------------------------------------------------------------------
# Serialization tests
# ---------------------------------------------------------------------------
def test_serialize_event_fills_missing_id():
    """If obj.id is None, serializer generates a UUID."""
    ev = _make_sec_event(event_id=None)
    serialized = _serialize_event(ev)
    assert serialized["id"] is not None
    # Must be a valid UUID string
    uuid.UUID(serialized["id"])


def test_serialize_event_truncates_long_fields():
    """Oversized fields are truncated to match ingest model limits."""
    ev = _make_sec_event(source_ip="x" * 100)
    serialized = _serialize_event(ev)
    assert len(serialized["source_ip"]) <= 45


def test_serialize_batch_groups_event_with_login_attempt():
    """Event + LoginAttempt are grouped into one IngestEventItem."""
    event_id = uuid.uuid4()
    sec_ev = _make_sec_event(event_id=event_id)
    la = _make_login_attempt(event_id)
    items = _serialize_batch([sec_ev, la])
    assert len(items) == 1
    assert items[0]["event"]["id"] == str(event_id)
    assert items[0]["login_attempt"] is not None
    assert items[0]["login_attempt"]["event_id"] == str(event_id)
    assert items[0]["captured_file"] is None


# ---------------------------------------------------------------------------
# EventForwarderSession tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_forwarder_session_buffers_and_forwards_on_commit():
    """add() buffers, commit() hands to sink, buffer cleared."""
    session = EventForwarderSession()
    ev = _make_sec_event()

    mock_sink = AsyncMock(spec=EventSink)
    original = get_event_sink()
    set_event_sink(mock_sink)
    try:
        session.add(ev)
        assert len(session._objects) == 1
        await session.commit()
        mock_sink.persist.assert_awaited_once()
        assert len(session._objects) == 0
    finally:
        set_event_sink(original)


@pytest.mark.asyncio
async def test_forwarder_session_refresh_and_rollback_are_noops():
    """refresh and rollback do not raise."""
    session = EventForwarderSession()
    ev = _make_sec_event()
    session.add(ev)
    await session.refresh(ev)  # no-op
    await session.rollback()    # clears buffer
    assert len(session._objects) == 0


def test_forwarder_session_default_decoy_has_id():
    """default_decoy has the fixed DEFAULT_DECOY_ID."""
    session = EventForwarderSession()
    assert session.default_decoy.id == uuid.UUID("00000000-0000-0000-0000-000000000001")


def test_make_default_decoy_has_all_attributes():
    """default_decoy must have at least .id (the only one decoy.py reads)."""
    decoy = make_default_decoy()
    assert hasattr(decoy, "id")
    assert hasattr(decoy, "name")
    assert hasattr(decoy, "banner_title")


# ---------------------------------------------------------------------------
# ForwardingEventSink spool/replay tests (with mocked httpx)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sink_spools_on_backend_failure(tmp_path):
    """When backend returns 5xx, the event is written to the spool file."""
    sink = ForwardingEventSink()
    sink._spool_dir = tmp_path
    sink._spool_file = tmp_path / "events.jsonl"
    sink._spool_max_bytes = 10 * 1024 * 1024

    ev = _make_sec_event()
    la = _make_login_attempt(ev.id)
    session = EventForwarderSession()
    session.add(ev)
    session.add(la)

    set_event_sink(sink)
    with patch.object(sink, "_send_batch", new_callable=AsyncMock, return_value=False):
        sink.start_worker()
        try:
            await session.commit()
            await asyncio.sleep(0.3)
        finally:
            await sink.stop_worker()
            set_event_sink(DbEventSink())

    # Spool file should exist and contain the event
    assert sink._spool_file.exists()
    content = sink._spool_file.read_text()
    assert str(ev.id) in content


@pytest.mark.asyncio
async def test_sink_replays_spool_on_success(tmp_path):
    """When backend recovers, spooled events are replayed."""
    sink = ForwardingEventSink()
    sink._spool_dir = tmp_path
    sink._spool_file = tmp_path / "events.jsonl"
    sink._spool_max_bytes = 10 * 1024 * 1024

    # Pre-write a spool entry
    event_id = str(uuid.uuid4())
    spool_entry = {"events": [{"event": {"id": event_id, "decoy_service_id": None,
        "timestamp": datetime.now(timezone.utc).isoformat(), "source_ip": "1.2.3.4",
        "source_port": 80, "http_method": "GET", "request_path": "/test",
        "query_params": {}, "headers_sanitized": {}, "user_agent": "",
        "event_type": "recon_probe", "severity": "low", "is_test_event": False,
        "correlation_id": None, "metadata_payload": {}},
        "login_attempt": None, "captured_file": None}]}
    sink._spool_file.write_text(json.dumps(spool_entry) + "\n")

    # Mock httpx to succeed
    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch.object(sink, "_send_batch", new_callable=AsyncMock, return_value=True):
        set_event_sink(sink)
        sink.replay_spool_on_start()
        sink.start_worker()
        try:
            await asyncio.sleep(0.5)
        finally:
            await sink.stop_worker()
            set_event_sink(DbEventSink())

    # Spool should be cleared after successful replay
    assert not sink._spool_file.exists() or sink._spool_file.stat().st_size == 0


@pytest.mark.asyncio
async def test_sink_spool_cap_drops_events(tmp_path):
    """When spool exceeds max bytes, events are dropped and counted."""
    sink = ForwardingEventSink()
    sink._spool_dir = tmp_path
    sink._spool_file = tmp_path / "events.jsonl"
    sink._spool_max_bytes = 10 * 1024  # 10KB cap — enough for one event

    ev = _make_sec_event()
    batch = [_serialize_event(ev)]

    # First append should succeed
    assert sink._append_spool(batch) is True
    # Fill the spool to near cap, then second append should fail
    # Write enough data to exceed 10KB
    while sink._spool_file.stat().st_size < sink._spool_max_bytes:
        if not sink._append_spool(batch):
            break
    # Now the cap is reached
    result = sink._append_spool(batch)
    assert result is False
    assert sink._dropped_count >= 1


@pytest.mark.asyncio
async def test_sink_reuses_event_id_on_retry(tmp_path):
    """The same event id appears in the spool as was generated by the decoy."""
    sink = ForwardingEventSink()
    sink._spool_dir = tmp_path
    sink._spool_file = tmp_path / "events.jsonl"
    sink._spool_max_bytes = 10 * 1024 * 1024

    event_id = uuid.uuid4()
    ev = _make_sec_event(event_id=event_id)

    session = EventForwarderSession()
    session.add(ev)

    with patch.object(sink, "_send_batch", new_callable=AsyncMock, return_value=False):
        set_event_sink(sink)
        sink.start_worker()
        try:
            await session.commit()
            await asyncio.sleep(0.3)
        finally:
            await sink.stop_worker()
            set_event_sink(DbEventSink())

    # The spooled event must have the same id
    assert sink._spool_file.exists()
    content = sink._spool_file.read_text()
    assert str(event_id) in content

@pytest.mark.asyncio
async def test_sink_replays_spool_on_timer_without_new_traffic(tmp_path):
    """After a backend outage, spooled events are replayed on a timer
    even when NO new traffic arrives.

    1. Start sink with _send_batch failing (backend down).
    2. Send an event — it spools.
    3. Restore _send_batch to succeed (backend up).
    4. Send NOTHING else.
    5. Assert the spooled event is delivered within ~15 seconds.
    """
    import asyncio
    from datetime import datetime, timezone
    from types import SimpleNamespace

    sink = ForwardingEventSink()
    sink._spool_dir = tmp_path
    sink._spool_file = tmp_path / "events.jsonl"
    sink._spool_max_bytes = 10 * 1024 * 1024

    event_id = uuid.uuid4()
    delivered_batches = []

    async def fail_send(httpx_mod, batch):
        return False

    async def succeed_send(httpx_mod, batch):
        delivered_batches.append(list(batch))
        return True

    sink._send_batch = lambda httpx_mod, batch: fail_send(httpx_mod, batch)

    set_event_sink(sink)
    sink.start_worker()
    try:
        # Phase 1: backend down — send event, it spools
        ev = SimpleNamespace(
            id=event_id, decoy_service_id=None,
            timestamp=datetime.now(timezone.utc), source_ip="1.2.3.4",
            source_port=99, http_method="GET", request_path="/timer-replay-test",
            query_params={}, headers_sanitized={}, user_agent="",
            event_type="recon_probe", severity="low", is_test_event=True,
            correlation_id=None, metadata_payload={},
        )
        session = EventForwarderSession()
        session.add(ev)
        await session.commit()

        # Wait for the worker to process and spool
        await asyncio.sleep(2.0)
        assert sink._spool_file.exists(), "Spool should exist after backend failure"

        # Phase 2: backend up — send NOTHING, wait for timer-based replay
        sink._send_batch = lambda httpx_mod, batch: succeed_send(httpx_mod, batch)

        # Wait up to 15 seconds for the timer-based replay to deliver
        deadline = asyncio.get_event_loop().time() + 15.0
        while asyncio.get_event_loop().time() < deadline:
            await asyncio.sleep(0.5)
            if delivered_batches:
                break

        assert len(delivered_batches) >= 1, \
            "Spooled event should be delivered within 15s without new traffic"

        # Verify it's our event
        all_events = []
        for batch_items in delivered_batches:
            all_events.extend(batch_items)
        assert any(item.get("event", {}).get("id") == str(event_id) for item in all_events), \
            "The spooled event id should be in the delivered batch"

        # Spool should be cleared after successful replay
        assert not sink._spool_file.exists() or sink._spool_file.stat().st_size == 0, \
            "Spool should be empty after successful replay"
    finally:
        await sink.stop_worker()
        set_event_sink(DbEventSink())
