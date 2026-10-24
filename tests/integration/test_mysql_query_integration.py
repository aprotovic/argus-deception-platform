"""Integration tests for MySQL query handling (items 3–7).

Uses a raw-socket client against a real in-process server.
Tests: SELECT 1, SHOW DATABASES, 64 KB query ERR 1153+close,
db_query event logged with tag, no password in stored events.
"""

import asyncio
import json
import os
import struct
import uuid

import pytest
import pytest_asyncio

from app.decoys.mysql.auth import native_password_scramble
from app.decoys.mysql.protocol import (
    CAP_CONNECT_WITH_DB,
    CAP_PLUGIN_AUTH,
    CAP_PROTOCOL_41,
    CAP_SECURE_CONNECTION,
    MAX_PACKET_BYTES,
    build_packet,
    read_packet,
)
from app.decoys.mysql.server import MAX_QUERY_BYTES, handle_connection, JsonlStubSink


# ---------------------------------------------------------------------------
# Raw client helpers
# ---------------------------------------------------------------------------
async def _handshake(r, w):
    payload, seq = await asyncio.wait_for(read_packet(r), timeout=5)
    salt1 = payload[payload.find(b"\x00", 1) + 5:payload.find(b"\x00", 1) + 13]
    idx = payload.find(b"\x00", 1) + 14 + 2 + 1 + 2 + 2 + 1 + 10
    salt = salt1 + payload[idx:idx + 12]
    return salt, seq + 1


async def _login(r, w, salt, seq, username="root", password="test_bait_123"):
    caps = CAP_PROTOCOL_41 | CAP_SECURE_CONNECTION | CAP_PLUGIN_AUTH
    pkt = bytearray()
    pkt += struct.pack("<I", caps) + struct.pack("<I", 0x1000000)
    pkt += bytes([45]) + b"\x00" * 23
    pkt += username.encode() + b"\x00"
    sc = native_password_scramble(password.encode(), salt)
    pkt.append(len(sc)); pkt += sc
    pkt += b"mysql_native_password\x00"
    w.write(build_packet(bytes(pkt), seq)); await w.drain()
    payload, seq = await asyncio.wait_for(read_packet(r), timeout=5)
    return payload[0] == 0x00, seq + 1   # True if OK


async def _query(r, w, seq, sql):
    payload = b"\x03" + sql.encode("utf-8")
    w.write(build_packet(payload, seq)); await w.drain()
    pkts = []
    eof_count = 0
    while True:
        p, s = await asyncio.wait_for(read_packet(r), timeout=5)
        pkts.append(p)
        if p and p[0] == 0xFF:   # ERR — done
            break
        if p and p[0] == 0x00 and len(pkts) == 1:   # OK (e.g. SET) — done
            break
        if p and p[0] == 0xFE:   # EOF
            eof_count += 1
            if eof_count >= 2:   # second EOF = end of result set
                break
    return pkts, s + 1


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def query_server(tmp_path):
    sink_path = str(tmp_path / "query_events.jsonl")
    sink = JsonlStubSink(path=sink_path)
    bait = [("root", "test_bait_123")]
    server = await asyncio.start_server(
        lambda r, w: handle_connection(
            r, w, sink, "8.0.36-test", bait,
            handshake_timeout=5, idle_timeout=5,
        ),
        "127.0.0.1", port=0,
    )
    port = server.sockets[0].getsockname()[1]
    yield port, sink_path
    server.close()
    await server.wait_closed()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_select_1_returns_result(query_server):
    port, sink = query_server
    r, w = await asyncio.open_connection("127.0.0.1", port)
    salt, seq = await _handshake(r, w)
    ok, seq = await _login(r, w, salt, seq)
    assert ok
    payloads, _ = await _query(r, w, seq, "SELECT 1")
    # col count packet
    assert payloads[0][0] == 1    # lenenc 1 col
    # final EOF
    assert payloads[-1][0] == 0xFE
    w.close()


@pytest.mark.asyncio
async def test_show_databases_contains_nexis_hr(query_server):
    port, sink = query_server
    r, w = await asyncio.open_connection("127.0.0.1", port)
    salt, seq = await _handshake(r, w)
    ok, seq = await _login(r, w, salt, seq)
    payloads, _ = await _query(r, w, seq, "SHOW DATABASES")
    all_bytes = b"".join(payloads)
    assert b"nexis_hr" in all_bytes
    w.close()


@pytest.mark.asyncio
async def test_set_names_returns_ok(query_server):
    port, sink = query_server
    r, w = await asyncio.open_connection("127.0.0.1", port)
    salt, seq = await _handshake(r, w)
    ok, seq = await _login(r, w, salt, seq)
    payloads, _ = await _query(r, w, seq, "SET NAMES utf8mb4")
    assert payloads[0][0] == 0x00
    w.close()


@pytest.mark.asyncio
async def test_select_personnel_public_columns_only(query_server):
    port, sink = query_server
    r, w = await asyncio.open_connection("127.0.0.1", port)
    salt, seq = await _handshake(r, w)
    ok, seq = await _login(r, w, salt, seq)
    payloads, _ = await _query(r, w, seq, "SELECT * FROM personnel")
    all_bytes = b"".join(payloads)
    # badge_id must not appear in column definitions
    assert b"badge_id" not in all_bytes
    # personnel rows present
    assert b"Harrison Blake" in all_bytes
    w.close()


@pytest.mark.asyncio
async def test_oversized_query_returns_err_1153_and_closes(query_server):
    """A COM_QUERY payload over 64 KB must return ERR 1153 then close."""
    port, sink = query_server
    r, w = await asyncio.open_connection("127.0.0.1", port)
    salt, seq = await _handshake(r, w)
    ok, seq = await _login(r, w, salt, seq)

    # Send a COM_QUERY with MAX_QUERY_BYTES+1 bytes of data
    big_sql = b"\x03" + b"x" * (MAX_QUERY_BYTES + 1)
    w.write(build_packet(big_sql, seq)); await w.drain()

    payload, _ = await asyncio.wait_for(read_packet(r), timeout=5)
    assert payload[0] == 0xFF   # ERR
    code = struct.unpack_from("<H", payload, 1)[0]
    assert code == 1153

    # Connection should be closed after this
    try:
        eof = await asyncio.wait_for(r.read(1), timeout=3)
        assert eof == b""   # EOF
    except asyncio.TimeoutError:
        pytest.fail("Server did not close connection after oversized query")
    w.close()


@pytest.mark.asyncio
async def test_db_query_event_logged(query_server):
    port, sink_path = query_server
    r, w = await asyncio.open_connection("127.0.0.1", port)
    salt, seq = await _handshake(r, w)
    ok, seq = await _login(r, w, salt, seq)
    await _query(r, w, seq, "SHOW DATABASES")
    await w.drain()
    w.close()
    try:
        await asyncio.wait_for(w.wait_closed(), timeout=2)
    except Exception:
        pass
    await asyncio.sleep(0.3)

    assert os.path.exists(sink_path)
    with open(sink_path) as f:
        events = [json.loads(l) for l in f if l.strip()]

    query_events = [e for e in events if e["event_type"] == "db_query"]
    assert len(query_events) >= 1
    ev = query_events[0]
    assert "query_text" in ev["metadata_payload"]
    assert "query_tag" in ev["metadata_payload"]
    assert ev["metadata_payload"]["query_tag"] in ("recon", "normal")
    # No password data
    assert "password" not in ev["metadata_payload"]["query_text"].lower()


@pytest.mark.asyncio
async def test_sqli_query_tagged_high(query_server):
    port, sink_path = query_server
    r, w = await asyncio.open_connection("127.0.0.1", port)
    salt, seq = await _handshake(r, w)
    ok, seq = await _login(r, w, salt, seq)
    await _query(r, w, seq, "SELECT 1 UNION SELECT user,pass FROM users")
    await w.drain()
    w.close()
    try:
        await asyncio.wait_for(w.wait_closed(), timeout=2)
    except Exception:
        pass
    await asyncio.sleep(0.3)

    with open(sink_path) as f:
        events = [json.loads(l) for l in f if l.strip()]

    sqli_events = [
        e for e in events
        if e["event_type"] == "db_query"
        and e["metadata_payload"].get("query_tag") == "sqli"
    ]
    assert len(sqli_events) >= 1
    assert sqli_events[0]["severity"] == "high"


@pytest.mark.asyncio
async def test_identified_by_redacted_in_event(query_server):
    """IDENTIFIED BY '<secret>' must be redacted in stored events."""
    port, sink_path = query_server
    r, w = await asyncio.open_connection("127.0.0.1", port)
    salt, seq = await _handshake(r, w)
    ok, seq = await _login(r, w, salt, seq)
    await _query(r, w, seq, "CREATE USER 'x'@'%' IDENTIFIED BY 'VerySecretPw!'")
    await w.drain()
    w.close()
    try:
        await asyncio.wait_for(w.wait_closed(), timeout=2)
    except Exception:
        pass
    await asyncio.sleep(0.3)

    with open(sink_path) as f:
        raw = f.read()

    assert "VerySecretPw!" not in raw
    assert "IDENTIFIED BY '[REDACTED]'" in raw
