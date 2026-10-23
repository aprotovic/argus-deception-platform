"""Integration tests for the MySQL decoy server (task 3).

Uses a raw-socket MySQL client (no external dependencies) to:
- Complete the handshake.
- Login with a bait credential → OK.
- Login with a wrong password → ERR 1045.
- Send garbage as the first packet → server closes connection cleanly,
  and the server still accepts a normal login afterwards.
- Assert events are written to the JSONL stub sink.
"""

import asyncio
import json
import os
import struct

import pytest
import pytest_asyncio

from app.decoys.mysql.auth import native_password_scramble
from app.decoys.mysql.protocol import (
    build_packet,
    read_packet,
)


# ---------------------------------------------------------------------------
# Raw-socket MySQL test client
# ---------------------------------------------------------------------------
class RawMySQLClient:
    """Minimal raw-socket MySQL client for testing only."""

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
        """Read Initial Handshake v10 and extract the 20-byte salt. Returns version string."""
        payload, seq_id = await asyncio.wait_for(read_packet(self.reader), timeout=5.0)
        self.seq_id = seq_id + 1

        assert payload[0] == 10, f"Expected protocol v10, got {payload[0]}"
        idx = payload.find(b"\x00", 1)
        version = payload[1:idx].decode("utf-8", errors="replace")
        idx += 1  # skip NUL
        idx += 4  # skip connection id
        salt1 = payload[idx:idx + 8]
        idx += 9   # 8 bytes salt + 1 filler byte
        idx += 2   # capability lower 2 bytes
        idx += 1   # charset
        idx += 2   # status flags
        idx += 2   # capability upper 2 bytes
        idx += 1   # auth data length
        idx += 10  # 10 reserved bytes
        salt2 = payload[idx:idx + 12]
        self.salt = salt1 + salt2
        assert len(self.salt) == 20
        return version

    async def send_login(self, username: str, password: str, database: str = None):
        """Send a Handshake Response 41 with the given credentials."""
        from app.decoys.mysql.protocol import (
            CAP_PROTOCOL_41,
            CAP_SECURE_CONNECTION,
            CAP_PLUGIN_AUTH,
            CAP_CONNECT_WITH_DB,
        )

        caps = CAP_PROTOCOL_41 | CAP_SECURE_CONNECTION | CAP_PLUGIN_AUTH
        if database:
            caps |= CAP_CONNECT_WITH_DB

        payload = bytearray()
        payload += struct.pack("<I", caps)
        payload += struct.pack("<I", 0x01000000)  # max packet
        payload.append(45)                         # utf8mb4 charset
        payload += b"\x00" * 23                    # reserved

        payload += username.encode("utf-8") + b"\x00"

        # Length-prefixed auth response (CLIENT_SECURE_CONNECTION)
        scramble = native_password_scramble(password.encode("utf-8"), self.salt) if password else b""
        payload.append(len(scramble))
        payload += scramble

        if database:
            payload += database.encode("utf-8") + b"\x00"

        payload += b"mysql_native_password\x00"

        pkt = build_packet(bytes(payload), seq_id=self.seq_id)
        self.writer.write(pkt)
        await self.writer.drain()
        self.seq_id += 1

    async def read_response(self):
        """Read the server auth response. Returns ('ok', None) or ('err', (code, msg))."""
        payload, seq_id = await asyncio.wait_for(read_packet(self.reader), timeout=5.0)
        if payload[0] == 0x00:
            return "ok", None
        elif payload[0] == 0xFF:
            code = struct.unpack_from("<H", payload, 1)[0]
            # payload: 0xFF + code(2) + "#" + sqlstate(5) + message
            msg = payload[9:].decode("utf-8", errors="replace") if len(payload) > 9 else ""
            return "err", (code, msg)
        return "unknown", payload[0]

    async def send_quit(self):
        """Send COM_QUIT."""
        pkt = build_packet(b"\x01", seq_id=self.seq_id)
        self.writer.write(pkt)
        await self.writer.drain()

    async def close(self):
        if self.writer:
            try:
                self.writer.close()
                await asyncio.wait_for(self.writer.wait_closed(), timeout=2.0)
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Fixture: start the server in-process on a random port
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def mysql_server(tmp_path):
    """Start the MySQL decoy server on a random OS-assigned port."""
    from app.decoys.mysql.server import handle_connection, JsonlStubSink

    sink_path = str(tmp_path / "events.jsonl")
    sink = JsonlStubSink(path=sink_path)
    version_string = "8.0.36-test"
    bait_creds = [("root", "test_bait_123")]

    server = await asyncio.start_server(
        lambda r, w: handle_connection(
            r, w, sink, version_string, bait_creds,
            idle_timeout=5.0,
            conn_lifetime=30.0,
        ),
        "127.0.0.1",
        port=0,  # let OS pick a free port
    )
    port = server.sockets[0].getsockname()[1]

    yield port, sink_path

    server.close()
    await server.wait_closed()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bait_credential_gets_ok(mysql_server):
    """Login with the correct bait credential must receive OK."""
    port, sink_path = mysql_server
    client = RawMySQLClient("127.0.0.1", port)
    await client.connect()
    version = await client.read_handshake()
    assert "8.0.36" in version

    await client.send_login("root", "test_bait_123")
    result, detail = await client.read_response()
    assert result == "ok", f"Expected ok, got {result!r} detail={detail}"

    await client.send_quit()
    await client.close()


@pytest.mark.asyncio
async def test_wrong_password_gets_err_1045(mysql_server):
    """Wrong password must produce ERR 1045 Access denied."""
    port, sink_path = mysql_server
    client = RawMySQLClient("127.0.0.1", port)
    await client.connect()
    await client.read_handshake()

    await client.send_login("root", "completely_wrong_pw")
    result, detail = await client.read_response()
    assert result == "err", f"Expected err, got {result!r}"
    assert detail[0] == 1045, f"Expected error 1045, got {detail[0]}"
    assert "Access denied" in detail[1]

    await client.close()


@pytest.mark.asyncio
async def test_unknown_user_gets_err_1045(mysql_server):
    """An unknown username must also produce ERR 1045."""
    port, sink_path = mysql_server
    client = RawMySQLClient("127.0.0.1", port)
    await client.connect()
    await client.read_handshake()

    await client.send_login("nobody", "any_password")
    result, detail = await client.read_response()
    assert result == "err"
    assert detail[0] == 1045

    await client.close()


@pytest.mark.asyncio
async def test_garbage_first_packet_closes_connection_server_still_works(mysql_server):
    """Garbage as first response closes the connection; the server then still
    accepts a normal login on a fresh connection (no crash, no hanging)."""
    port, sink_path = mysql_server

    # Send garbage instead of a valid handshake response
    garbage_client = RawMySQLClient("127.0.0.1", port)
    await garbage_client.connect()
    await garbage_client.read_handshake()  # server sends handshake OK

    # Send raw garbage as the client's response
    garbage_client.writer.write(b"\xff\xfe\xfd\xfc" + b"\x42" * 100)
    await garbage_client.writer.drain()

    # Server should close the connection (read returns empty or raises)
    try:
        payload, _ = await asyncio.wait_for(read_packet(garbage_client.reader), timeout=3.0)
        # If we got a response, it should be an ERR packet or EOF
        assert len(payload) == 0 or payload[0] in (0xFF, 0xFE)
    except (asyncio.TimeoutError, asyncio.IncompleteReadError, ConnectionResetError):
        pass  # Connection was closed — expected
    await garbage_client.close()

    # Now a normal login must still work
    good_client = RawMySQLClient("127.0.0.1", port)
    await good_client.connect()
    await good_client.read_handshake()
    await good_client.send_login("root", "test_bait_123")
    result, detail = await good_client.read_response()
    assert result == "ok", f"Server broke after garbage — got {result!r}"
    await good_client.close()


@pytest.mark.asyncio
async def test_events_logged_to_jsonl_stub(mysql_server):
    """Connection events must be written to the JSONL stub sink."""
    port, sink_path = mysql_server

    # Do a failed login to trigger an event
    client = RawMySQLClient("127.0.0.1", port)
    await client.connect()
    await client.read_handshake()
    await client.send_login("root", "wrong_pw")
    await client.read_response()
    await client.close()

    # Give the connection close a moment to flush the event
    await asyncio.sleep(0.3)

    assert os.path.exists(sink_path), "JSONL event file was not created"
    with open(sink_path, "r", encoding="utf-8") as f:
        lines = [json.loads(line) for line in f if line.strip()]

    assert len(lines) >= 1, "No events were written"
    event = lines[0]
    assert event["event_type"] == "db_connection"
    assert event["http_method"] == "SQL"
    assert event["request_path"] == "/mysql/connect"
    assert event["source_ip"] == "127.0.0.1"
