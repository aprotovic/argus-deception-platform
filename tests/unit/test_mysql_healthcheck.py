"""Unit/integration tests for MySQL healthcheck noise suppression (item 3).

These tests are in tests/unit/ so they are isolated from the conftest
session-scoped DB setup and do not touch app.main.

Tests:
- Loopback IP + bytes_in == 0 → no event emitted (Docker healthcheck probe)
- Non-loopback IP + bytes_in == 0 → db_connection event emitted (real scan)
"""

import asyncio
import json
import os
import time
import uuid

import pytest
import pytest_asyncio

from app.decoys.mysql.server import (
    ConnectionContext,
    JsonlStubSink,
    _persist_connection_event,
    handle_connection,
)
from app.decoys.mysql.protocol import read_packet


def _make_ctx(peer_ip: str, bytes_in: int) -> ConnectionContext:
    """Build a ConnectionContext-like object without a real socket."""
    ctx = object.__new__(ConnectionContext)
    ctx.peer_ip = peer_ip
    ctx.peer_port = 54321
    ctx.salt = b"\x00" * 20
    ctx.connection_id = 1
    ctx.start_time = time.monotonic() - 0.5
    ctx.bytes_in = bytes_in
    ctx.bytes_out = 100
    ctx.commands = 0
    ctx.username = None
    ctx.database = None
    ctx.authenticated = False
    ctx.has_login_attempt = False
    ctx.correlation_id = "test-noise"
    ctx.login_event_id = uuid.uuid4()
    ctx.conn_event_id = uuid.uuid4()
    return ctx


@pytest.mark.asyncio
async def test_loopback_zero_bytes_no_event(tmp_path):
    """127.0.0.1 + bytes_in == 0 must not emit an event (Docker healthcheck)."""
    sink_path = str(tmp_path / "hc.jsonl")
    sink = JsonlStubSink(path=sink_path)

    ctx = _make_ctx("127.0.0.1", bytes_in=0)
    await _persist_connection_event(ctx, sink)

    assert not os.path.exists(sink_path) or os.path.getsize(sink_path) == 0, \
        "Loopback probe with zero bytes must not generate an event"


@pytest.mark.asyncio
async def test_loopback_ipv6_zero_bytes_no_event(tmp_path):
    """::1 + bytes_in == 0 must not emit an event."""
    sink_path = str(tmp_path / "hc6.jsonl")
    sink = JsonlStubSink(path=sink_path)

    ctx = _make_ctx("::1", bytes_in=0)
    await _persist_connection_event(ctx, sink)

    assert not os.path.exists(sink_path) or os.path.getsize(sink_path) == 0, \
        "IPv6 loopback probe must not generate an event"


@pytest.mark.asyncio
async def test_gateway_zero_bytes_logs_event(tmp_path):
    """Docker gateway IP (172.x) + bytes_in == 0 MUST emit a db_connection event."""
    sink_path = str(tmp_path / "gw.jsonl")
    sink = JsonlStubSink(path=sink_path)

    ctx = _make_ctx("172.19.0.1", bytes_in=0)
    await _persist_connection_event(ctx, sink)

    assert os.path.exists(sink_path), "Gateway IP scan must emit an event"
    with open(sink_path) as f:
        events = [json.loads(l) for l in f if l.strip()]
    assert len(events) == 1
    assert events[0]["event_type"] == "db_connection"
    assert events[0]["severity"] == "low"
    assert events[0]["source_ip"] == "172.19.0.1"


@pytest.mark.asyncio
async def test_loopback_with_bytes_logs_event(tmp_path):
    """127.0.0.1 with bytes received (e.g. login attempt from host) IS logged."""
    sink_path = str(tmp_path / "lb_bytes.jsonl")
    sink = JsonlStubSink(path=sink_path)

    ctx = _make_ctx("127.0.0.1", bytes_in=150)  # has bytes — real login attempt
    ctx.username = "root"
    ctx.has_login_attempt = True
    await _persist_connection_event(ctx, sink)

    assert os.path.exists(sink_path), "127.0.0.1 with bytes received must be logged"
    with open(sink_path) as f:
        events = [json.loads(l) for l in f if l.strip()]
    assert len(events) == 1
    assert events[0]["event_type"] == "db_connection"


@pytest.mark.asyncio
async def test_healthcheck_integration_no_event(tmp_path):
    """Full integration: real TCP healthcheck probe produces no event in JSONL sink."""
    sink_path = str(tmp_path / "hc_full.jsonl")
    sink = JsonlStubSink(path=sink_path)

    server = await asyncio.start_server(
        lambda r, w: handle_connection(
            r, w, sink, "8.0.36-test", [],
            handshake_timeout=1.0, idle_timeout=1.0,
        ),
        "127.0.0.1", port=0,
    )
    port = server.sockets[0].getsockname()[1]
    try:
        # Simulate Docker healthcheck: TCP connect, read handshake, close
        r, w = await asyncio.open_connection("127.0.0.1", port)
        try:
            await asyncio.wait_for(read_packet(r), timeout=2.0)
        except (asyncio.TimeoutError, asyncio.IncompleteReadError):
            pass
        w.close()
        try:
            await asyncio.wait_for(w.wait_closed(), timeout=2.0)
        except Exception:
            pass
        # Wait for handshake timeout to fire and connection to close
        await asyncio.sleep(2.0)
    finally:
        server.close()
        await server.wait_closed()

    assert not os.path.exists(sink_path) or os.path.getsize(sink_path) == 0, \
        "Loopback TCP healthcheck probe must not generate an event"
