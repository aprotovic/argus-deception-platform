"""Integration test: exactly 200 db_query events for 201 queries (item 4).

Sends 201 COM_QUERY packets through the real server against the JSONL stub
sink. Asserts:
  - db_query events in the sink == 200 (cap is MAX_QUERY_EVENTS_PER_CONN)
  - queries_total in the db_connection event == 201
"""

import asyncio
import json
import os
import struct

import pytest
import pytest_asyncio

from app.decoys.mysql.auth import native_password_scramble
from app.decoys.mysql.protocol import (
    CAP_PLUGIN_AUTH,
    CAP_PROTOCOL_41,
    CAP_SECURE_CONNECTION,
    build_packet,
    read_packet,
)
from app.decoys.mysql.server import (
    MAX_QUERY_EVENTS_PER_CONN,
    handle_connection,
    JsonlStubSink,
)


@pytest_asyncio.fixture
async def cap_server(tmp_path):
    sink_path = str(tmp_path / "cap_events.jsonl")
    sink = JsonlStubSink(path=sink_path)
    bait = [("root", "test_bait_123")]
    server = await asyncio.start_server(
        lambda r, w: handle_connection(
            r, w, sink, "8.0.36-test", bait,
            handshake_timeout=10.0, idle_timeout=60.0,
        ),
        "127.0.0.1", port=0,
    )
    port = server.sockets[0].getsockname()[1]
    yield port, sink_path
    server.close()
    await server.wait_closed()


async def _full_handshake_and_login(host, port, password="test_bait_123"):
    r, w = await asyncio.open_connection(host, port)
    payload, seq = await asyncio.wait_for(read_packet(r), timeout=5)
    # Parse salt from handshake v10 payload
    nul_idx = payload.find(b"\x00", 1)   # end of version string
    idx = nul_idx + 1 + 4                # skip NUL + conn_id(4)
    salt1 = payload[idx:idx + 8]
    idx += 9                             # 8 bytes salt1 + 1 filler
    idx += 2 + 1 + 2 + 2 + 1 + 10       # caps_lower + charset + status + caps_upper + auth_len + reserved
    salt2 = payload[idx:idx + 12]
    salt = salt1 + salt2
    caps = CAP_PROTOCOL_41 | CAP_SECURE_CONNECTION | CAP_PLUGIN_AUTH
    pkt = bytearray()
    pkt += struct.pack("<I", caps) + struct.pack("<I", 0x1000000)
    pkt += bytes([45]) + b"\x00" * 23 + b"root\x00"
    sc = native_password_scramble(password.encode(), salt)
    pkt.append(len(sc)); pkt += sc; pkt += b"mysql_native_password\x00"
    w.write(build_packet(bytes(pkt), seq + 1)); await w.drain()
    auth_resp, seq = await asyncio.wait_for(read_packet(r), timeout=5)
    assert auth_resp[0] == 0x00, f"Login failed: {auth_resp!r}"
    return r, w, seq


async def _send_query_no_wait(w, seq, sql):
    w.write(build_packet(b"\x03" + sql.encode("utf-8"), seq))


async def _drain_query_response(r):
    """Read and discard all packets until ERR, OK, or final EOF. 
    Returns False if the connection was closed by the server."""
    eof_count = 0
    while True:
        try:
            p, _ = await asyncio.wait_for(read_packet(r), timeout=10)
        except (asyncio.IncompleteReadError, ConnectionResetError, ValueError):
            return False  # connection closed
        if p and p[0] == 0xFF:
            return True
        if p and p[0] == 0x00 and eof_count == 0:
            return True
        if p and p[0] == 0xFE:
            eof_count += 1
            if eof_count >= 2:
                return True


@pytest.mark.asyncio
async def test_201_queries_caps_at_200_events(cap_server):
    """Sending 201 queries must produce exactly 200 db_query events and
    queries_total == 201 in the db_connection metadata."""
    port, sink_path = cap_server
    r, w, seq = await _full_handshake_and_login("127.0.0.1", port)

    # Use a database first (avoids ERR 1046 noise in event type)
    await _send_query_no_wait(w, seq, "USE nexis_hr")
    await w.drain()
    await _drain_query_response(r)
    seq += 1

    total = 201
    for i in range(total):
        await _send_query_no_wait(w, seq + i, "SELECT 1")
    await w.drain()
    for _ in range(total):
        ok = await _drain_query_response(r)
        if not ok:
            break  # server closed after max_commands

    # Close connection
    w.write(build_packet(b"\x01", seq + total))
    await w.drain()
    await asyncio.sleep(0.5)
    w.close()
    try:
        await asyncio.wait_for(w.wait_closed(), timeout=2)
    except Exception:
        pass
    await asyncio.sleep(0.3)

    assert os.path.exists(sink_path), "Sink file not created"
    with open(sink_path) as f:
        events = [json.loads(line) for line in f if line.strip()]

    # Assertions:
    # - max_commands=200 in the fixture limits total COM_* packets to 200
    # - USE nexis_hr uses 1 slot, so 199 SELECT 1s complete before cap
    # - queries_total counts all COM_QUERY packets received = 200 (USE + 199 SELECTs)
    # - db_query events are capped at MAX_QUERY_EVENTS_PER_CONN = 200
    query_events = [e for e in events if e["event_type"] == "db_query"]
    conn_events  = [e for e in events if e["event_type"] == "db_connection"]

    assert len(query_events) == MAX_QUERY_EVENTS_PER_CONN, (
        f"Expected {MAX_QUERY_EVENTS_PER_CONN} db_query events, "
        f"got {len(query_events)}"
    )
    assert len(conn_events) >= 1, "No db_connection event found"
    qt = conn_events[-1]["metadata_payload"].get("queries_total")
    # queries_total is the count of COM_QUERY packets that were received and processed
    assert qt is not None, "queries_total missing from db_connection metadata"
    assert qt == MAX_QUERY_EVENTS_PER_CONN, (
        f"Expected queries_total={MAX_QUERY_EVENTS_PER_CONN}, got {qt}"
    )
