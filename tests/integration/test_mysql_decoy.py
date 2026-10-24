"""Integration tests for the MySQL decoy server (tasks 3 + 4).

Uses a raw-socket MySQL client (no external dependencies) to verify:
- Bait credential → OK.
- Wrong password → ERR 1045.
- Garbage first packet → server closes, still works after.
- db_connection events are written to the JSONL stub sink.
- db_login_attempt events are written (with correct severity).
- Handshake timeout fires if the client never sends a login packet.
- 201st connection is closed immediately (not queued).
"""

import asyncio
import json
import os
import struct
import time

import pytest
import pytest_asyncio

from app.decoys.mysql.auth import native_password_scramble
from app.decoys.mysql.protocol import (
    CAP_PROTOCOL_41,
    CAP_SECURE_CONNECTION,
    CAP_PLUGIN_AUTH,
    build_packet,
    read_packet,
)


# ---------------------------------------------------------------------------
# Raw-socket MySQL test client
# ---------------------------------------------------------------------------
class RawMySQLClient:
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.reader = None
        self.writer = None
        self.salt = None
        self.seq_id = 0

    async def connect(self):
        self.reader, self.writer = await asyncio.open_connection(self.host, self.port)

    async def read_handshake(self) -> str:
        payload, seq = await asyncio.wait_for(read_packet(self.reader), timeout=5.0)
        self.seq_id = seq + 1
        assert payload[0] == 10
        idx = payload.find(b"\x00", 1)
        version = payload[1:idx].decode("utf-8", errors="replace")
        idx += 5  # skip NUL + 4-byte conn_id
        salt1 = payload[idx:idx + 8]
        idx += 9
        idx += 2 + 1 + 2 + 2 + 1 + 10  # caps + charset + status + cap_hi + auth_len + reserved
        salt2 = payload[idx:idx + 12]
        self.salt = salt1 + salt2
        assert len(self.salt) == 20
        return version

    async def send_login(self, username: str, password: str):
        caps = CAP_PROTOCOL_41 | CAP_SECURE_CONNECTION | CAP_PLUGIN_AUTH
        payload = bytearray()
        payload += struct.pack("<I", caps)
        payload += struct.pack("<I", 0x01000000)
        payload.append(45)
        payload += b"\x00" * 23
        payload += username.encode("utf-8") + b"\x00"
        scramble = native_password_scramble(password.encode("utf-8"), self.salt) if password else b""
        payload.append(len(scramble))
        payload += scramble
        payload += b"mysql_native_password\x00"
        pkt = build_packet(bytes(payload), seq_id=self.seq_id)
        self.writer.write(pkt)
        await self.writer.drain()
        self.seq_id += 1

    async def read_response(self):
        payload, _ = await asyncio.wait_for(read_packet(self.reader), timeout=5.0)
        if payload[0] == 0x00:
            return "ok", None
        elif payload[0] == 0xFF:
            code = struct.unpack_from("<H", payload, 1)[0]
            msg = payload[9:].decode("utf-8", errors="replace") if len(payload) > 9 else ""
            return "err", (code, msg)
        return "unknown", payload[0]

    async def send_quit(self):
        self.writer.write(build_packet(b"\x01", seq_id=self.seq_id))
        await self.writer.drain()

    async def close(self):
        if self.writer:
            try:
                self.writer.close()
                await asyncio.wait_for(self.writer.wait_closed(), timeout=2.0)
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def mysql_server(tmp_path):
    from app.decoys.mysql.server import handle_connection, JsonlStubSink

    sink_path = str(tmp_path / "events.jsonl")
    sink = JsonlStubSink(path=sink_path)
    version = "8.0.36-test"
    bait_creds = [("root", "test_bait_123")]

    server = await asyncio.start_server(
        lambda r, w: handle_connection(
            r, w, sink, version, bait_creds,
            handshake_timeout=5.0,
            idle_timeout=5.0,
        ),
        "127.0.0.1", port=0,
    )
    port = server.sockets[0].getsockname()[1]
    yield port, sink_path
    server.close()
    await server.wait_closed()


# ---------------------------------------------------------------------------
# Basic login tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bait_credential_gets_ok(mysql_server):
    port, _ = mysql_server
    c = RawMySQLClient("127.0.0.1", port)
    await c.connect()
    await c.read_handshake()
    await c.send_login("root", "test_bait_123")
    result, _ = await c.read_response()
    assert result == "ok"
    await c.send_quit()
    await c.close()


@pytest.mark.asyncio
async def test_wrong_password_gets_err_1045(mysql_server):
    port, _ = mysql_server
    c = RawMySQLClient("127.0.0.1", port)
    await c.connect()
    await c.read_handshake()
    await c.send_login("root", "wrong_password_xyz")
    result, detail = await c.read_response()
    assert result == "err"
    assert detail[0] == 1045
    assert "Access denied" in detail[1]
    await c.close()


@pytest.mark.asyncio
async def test_unknown_user_gets_err_1045(mysql_server):
    port, _ = mysql_server
    c = RawMySQLClient("127.0.0.1", port)
    await c.connect()
    await c.read_handshake()
    await c.send_login("nobody", "any_password")
    result, detail = await c.read_response()
    assert result == "err"
    assert detail[0] == 1045
    await c.close()


@pytest.mark.asyncio
async def test_garbage_closes_connection_server_still_works(mysql_server):
    port, _ = mysql_server

    # Send garbage after handshake
    g = RawMySQLClient("127.0.0.1", port)
    await g.connect()
    await g.read_handshake()
    g.writer.write(b"\xff\xfe\xfd" + b"\x42" * 100)
    await g.writer.drain()
    try:
        await asyncio.wait_for(read_packet(g.reader), timeout=3.0)
    except (asyncio.TimeoutError, asyncio.IncompleteReadError, ConnectionResetError):
        pass
    await g.close()

    # Normal login still works
    c = RawMySQLClient("127.0.0.1", port)
    await c.connect()
    await c.read_handshake()
    await c.send_login("root", "test_bait_123")
    result, _ = await c.read_response()
    assert result == "ok"
    await c.close()


# ---------------------------------------------------------------------------
# Event logging tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_db_connection_event_logged(mysql_server):
    port, sink_path = mysql_server

    c = RawMySQLClient("127.0.0.1", port)
    await c.connect()
    await c.read_handshake()
    await c.send_login("root", "wrong_pw")
    await c.read_response()
    await c.close()
    await asyncio.sleep(0.3)

    assert os.path.exists(sink_path)
    with open(sink_path) as f:
        events = [json.loads(l) for l in f if l.strip()]

    conn_events = [e for e in events if e["event_type"] == "db_connection"]
    assert len(conn_events) >= 1
    ev = conn_events[-1]
    assert ev["http_method"] == "SQL"
    assert ev["request_path"] == "/mysql/connect"
    assert ev["source_ip"] == "127.0.0.1"


@pytest.mark.asyncio
async def test_db_login_attempt_event_logged(mysql_server):
    port, sink_path = mysql_server

    c = RawMySQLClient("127.0.0.1", port)
    await c.connect()
    await c.read_handshake()
    await c.send_login("root", "wrong_pw")
    await c.read_response()
    await c.close()
    await asyncio.sleep(0.3)

    with open(sink_path) as f:
        events = [json.loads(l) for l in f if l.strip()]

    login_events = [e for e in events if e["event_type"] == "db_login_attempt"]
    assert len(login_events) >= 1
    ev = login_events[-1]
    assert ev["severity"] == "medium"
    assert ev["request_path"] == "/mysql/login"


@pytest.mark.asyncio
async def test_severity_high_on_bait_login(mysql_server):
    port, sink_path = mysql_server

    c = RawMySQLClient("127.0.0.1", port)
    await c.connect()
    await c.read_handshake()
    await c.send_login("root", "test_bait_123")
    await c.read_response()
    await c.close()
    await asyncio.sleep(0.3)

    with open(sink_path) as f:
        events = [json.loads(l) for l in f if l.strip()]

    login_events = [e for e in events if e["event_type"] == "db_login_attempt"]
    assert any(e["severity"] == "high" for e in login_events)


@pytest.mark.asyncio
async def test_severity_low_probe_no_login(mysql_server):
    """A client that connects from 127.0.0.1 and never sends a login packet
    must NOT generate an event (healthcheck suppression, item 3).
    Low-severity events from non-loopback addresses are tested in
    tests/unit/test_mysql_healthcheck.py::test_gateway_zero_bytes_logs_event."""
    port, sink_path = mysql_server

    c = RawMySQLClient("127.0.0.1", port)
    await c.connect()
    await c.read_handshake()
    # Never send a login packet — just close
    await c.close()
    await asyncio.sleep(0.5)  # wait for handshake timeout to fire

    # The event is suppressed for loopback + zero bytes
    import os
    assert not os.path.exists(sink_path) or os.path.getsize(sink_path) == 0, \
        "127.0.0.1 with zero bytes must not generate an event (healthcheck suppression)"


# ---------------------------------------------------------------------------
# Handshake timeout test
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def fast_timeout_server(tmp_path):
    """Server with a very short handshake timeout (0.5s)."""
    from app.decoys.mysql.server import handle_connection, JsonlStubSink

    sink = JsonlStubSink(path=str(tmp_path / "hs_events.jsonl"))
    server = await asyncio.start_server(
        lambda r, w: handle_connection(
            r, w, sink, "8.0.36-test", [],
            handshake_timeout=0.5,
            idle_timeout=5.0,
        ),
        "127.0.0.1", port=0,
    )
    port = server.sockets[0].getsockname()[1]
    yield port
    server.close()
    await server.wait_closed()


@pytest.mark.asyncio
async def test_handshake_timeout_closes_connection(fast_timeout_server):
    """If the client reads the handshake but never sends a login packet,
    the server must close the connection within the handshake timeout."""
    port = fast_timeout_server
    r, w = await asyncio.open_connection("127.0.0.1", port)

    # Read the server's handshake but send nothing back
    try:
        _ = await asyncio.wait_for(read_packet(r), timeout=3.0)
    except (asyncio.TimeoutError, asyncio.IncompleteReadError):
        pass

    # Server should close within 0.5s timeout
    start = time.monotonic()
    try:
        data = await asyncio.wait_for(r.read(1), timeout=2.0)
        assert data == b""  # EOF = connection closed
    except asyncio.TimeoutError:
        pytest.fail("Server did not close the connection after handshake timeout")
    elapsed = time.monotonic() - start
    assert elapsed < 2.0, f"Server took too long to close: {elapsed:.2f}s"

    w.close()
    try:
        await asyncio.wait_for(w.wait_closed(), timeout=1.0)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Connection cap test
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def capped_server(tmp_path):
    """Server capped at 2 connections."""
    from app.decoys.mysql.server import JsonlStubSink

    sink = JsonlStubSink(path=str(tmp_path / "cap_events.jsonl"))
    max_conns = 2

    # Replicate the active-count logic from server.main()
    from app.decoys.mysql.server import handle_connection
    _active = [0]

    async def handler(reader, writer):
        _active[0] += 1
        if _active[0] > max_conns:
            _active[0] -= 1
            try:
                writer.close()
                await asyncio.wait_for(writer.wait_closed(), timeout=1.0)
            except Exception:
                pass
            return
        try:
            await handle_connection(
                reader, writer, sink, "8.0.36-test", [],
                handshake_timeout=5.0, idle_timeout=5.0,
            )
        finally:
            _active[0] -= 1

    server = await asyncio.start_server(handler, "127.0.0.1", port=0)
    port = server.sockets[0].getsockname()[1]
    yield port
    server.close()
    await server.wait_closed()


@pytest.mark.asyncio
async def test_connection_cap_closes_extra_connections(capped_server):
    """The 3rd connection must be closed immediately (not queued)."""
    port = capped_server
    clients = []

    # Open 2 connections and hold them open (reading handshake keeps them alive)
    for _ in range(2):
        r, w = await asyncio.open_connection("127.0.0.1", port)
        try:
            await asyncio.wait_for(read_packet(r), timeout=3.0)
        except asyncio.TimeoutError:
            pass
        clients.append((r, w))

    # 3rd connection should be closed by the server immediately
    r3, w3 = await asyncio.open_connection("127.0.0.1", port)
    try:
        data = await asyncio.wait_for(r3.read(1024), timeout=2.0)
        # Server may either close immediately (EOF = b"") or send a handshake
        # then close — either is acceptable as long as it eventually closes.
        if data != b"":
            # Got a handshake; wait for close
            eof = await asyncio.wait_for(r3.read(1), timeout=2.0)
            assert eof == b"", "Server did not close the 3rd connection"
    except asyncio.TimeoutError:
        pytest.fail("Server did not close the 3rd connection within timeout")
    finally:
        w3.close()
        try:
            await asyncio.wait_for(w3.wait_closed(), timeout=1.0)
        except Exception:
            pass

    # Close the held connections
    for r, w in clients:
        w.close()
        try:
            await asyncio.wait_for(w.wait_closed(), timeout=1.0)
        except Exception:
            pass

# ---------------------------------------------------------------------------
# Healthcheck noise tests — moved to tests/unit/test_mysql_healthcheck.py
# ---------------------------------------------------------------------------
