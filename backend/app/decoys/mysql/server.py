"""MySQL decoy server — asyncio TCP server with limits and timeouts.

Task 3 of db-decoy spec (R1, R3.1, R4).

Entry point: python -m app.decoys.mysql.server
Starts a ForwardingEventSink (or JSONL stub sink for local testing),
listens on the configured port, and handles connections.

Safety:
- Every read has asyncio.wait_for with the idle timeout.
- Packet length checked before reading payload.
- All errors caught; connection always closed cleanly.
- No outbound connections, no file reads except spool.
- Bait credentials from settings, never hardcoded.
"""

from __future__ import annotations

import asyncio
import os
import secrets
import struct
import time
from datetime import datetime, timezone
from typing import Optional

from app.decoys.mysql.auth import native_password_scramble, verify_native_password
from app.decoys.mysql.protocol import (
    MAX_PACKET_BYTES,
    build_err_packet,
    build_handshake_v10,
    build_ok_packet,
    build_packet,
    read_packet,
    parse_handshake_response_41,
)
from app.logging_config import logger


# Defaults (can be overridden by settings or env vars)
DEFAULT_PORT = 3306
MAX_CONNECTIONS = 200
IDLE_TIMEOUT = 30.0  # seconds
CONN_LIFETIME = 300.0  # 5 minutes
MAX_COMMANDS = 200
MAX_PACKET = MAX_PACKET_BYTES


def _get_bait_credentials():
    """Read bait credentials from settings env var.

    Format: JSON string like [{"username": "root", "password": "bait_pw"}, ...]
    Falls back to a test value if not set (for local testing only).
    """
    import json
    raw = os.environ.get("MYSQL_DECOY_BAIT_CREDENTIALS", "[]")
    try:
        creds = json.loads(raw)
        return [(c["username"], c["password"]) for c in creds]
    except (json.JSONDecodeError, KeyError, TypeError):
        return []


def _get_version_string():
    """Read the MySQL version string from env or default."""
    return os.environ.get("MYSQL_DECOY_VERSION_STRING", "8.0.36-0ubuntu0.22.04.1")


def _get_port():
    return int(os.environ.get("MYSQL_DECOY_PORT", "3306"))


# ============================================================================
# JSONL stub sink (for local testing without a backend)
# ============================================================================
class JsonlStubSink:
    """Writes events as JSONL to a file. Used for local testing only."""

    def __init__(self, path: str = "/tmp/mysql_decoy_events.jsonl"):
        self._path = path
        # Ensure parent dir exists
        import os
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)

    async def persist(self, objects, broadcast_summary=None):
        import json
        from app.decoys.mysql.events import _serialize_for_stub
        with open(self._path, "a", encoding="utf-8") as f:
            for obj in objects:
                f.write(json.dumps(_serialize_for_stub(obj)) + "\n")


# ============================================================================
# Connection state
# ============================================================================
class ConnectionContext:
    """Per-connection state."""

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        self.reader = reader
        self.writer = writer
        self.peer_ip = writer.get_extra_info("peername")[0] if writer.get_extra_info("peername") else "0.0.0.0"
        self.peer_port = writer.get_extra_info("peername")[1] if writer.get_extra_info("peername") else 0
        self.salt = secrets.token_bytes(20)
        self.connection_id = id(self) & 0xFFFFFFFF
        self.seq_id = 0
        self.start_time = time.time()
        self.bytes_in = 0
        self.bytes_out = 0
        self.commands = 0
        self.username = None
        self.database = None
        self.authenticated = False


# ============================================================================
# Connection handler
# ============================================================================
async def handle_connection(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    sink,
    version_string: str,
    bait_credentials: list,
    idle_timeout: float = IDLE_TIMEOUT,
    conn_lifetime: float = CONN_LIFETIME,
    max_commands: int = MAX_COMMANDS,
):
    """Handle a single MySQL connection."""
    ctx = ConnectionContext(reader, writer)
    logger.info(f"MySQL decoy connection from {ctx.peer_ip}:{ctx.peer_port}")

    try:
        deadline = time.time() + conn_lifetime

        # 1. Send initial handshake
        handshake_payload = build_handshake_v10(
            ctx.connection_id, ctx.salt, version_string
        )
        packet = build_packet(handshake_payload, seq_id=0)
        writer.write(packet)
        await writer.drain()
        ctx.bytes_out += len(packet)

        # 2. Read client response (with timeout)
        try:
            payload, seq_id = await asyncio.wait_for(
                read_packet(reader, MAX_PACKET),
                timeout=idle_timeout,
            )
        except (asyncio.TimeoutError, asyncio.IncompleteReadError, ValueError) as e:
            logger.warning(f"Handshake read failed from {ctx.peer_ip}: {e}")
            return

        ctx.bytes_in += len(payload) + 4  # payload + header

        # 3. Parse handshake response
        try:
            resp = parse_handshake_response_41(payload)
        except ValueError as e:
            if "ssl_request" in str(e):
                logger.info(f"SSL request from {ctx.peer_ip}, closing (we don't support SSL)")
            else:
                logger.warning(f"Malformed handshake from {ctx.peer_ip}: {e}")
            return

        ctx.username = resp["username"]
        ctx.database = resp["database"]
        auth_response = resp["auth_response"]

        # 4. Check bait credentials
        authenticated = False
        for cred_username, cred_password in bait_credentials:
            if cred_username == ctx.username:
                if verify_native_password(auth_response, ctx.salt, cred_password.encode("utf-8")):
                    authenticated = True
                    break

        # 5. Send OK or ERR
        ctx.seq_id = 2
        if authenticated:
            ctx.authenticated = True
            ok_payload = build_ok_packet()
            packet = build_packet(ok_payload, seq_id=ctx.seq_id)
            writer.write(packet)
            await writer.drain()
            ctx.bytes_out += len(packet)
            logger.info(f"MySQL login accepted: user='{ctx.username}' from {ctx.peer_ip}")
        else:
            err_msg = f"Access denied for user '{ctx.username}'@'{ctx.peer_ip}' (using password: {'YES' if auth_response else 'NO'})"
            err_payload = build_err_packet(1045, err_msg, sql_state="28000")
            packet = build_packet(err_payload, seq_id=ctx.seq_id)
            writer.write(packet)
            await writer.drain()
            ctx.bytes_out += len(packet)
            logger.info(f"MySQL login denied: user='{ctx.username}' from {ctx.peer_ip}")

        # 6. Command phase (only if authenticated)
        if ctx.authenticated:
            while time.time() < deadline and ctx.commands < max_commands:
                try:
                    cmd_payload, cmd_seq = await asyncio.wait_for(
                        read_packet(reader, MAX_PACKET),
                        timeout=idle_timeout,
                    )
                except (asyncio.TimeoutError, asyncio.IncompleteReadError, ValueError) as e:
                    logger.info(f"Connection from {ctx.peer_ip} closed: {e}")
                    break

                ctx.bytes_in += len(cmd_payload) + 4
                ctx.commands += 1
                ctx.seq_id = cmd_seq + 1

                if not cmd_payload:
                    break

                cmd_byte = cmd_payload[0]
                # COM_QUIT = 0x01
                if cmd_byte == 0x01:
                    break
                # COM_PING = 0x0e
                elif cmd_byte == 0x0e:
                    ok = build_ok_packet()
                    writer.write(build_packet(ok, seq_id=ctx.seq_id))
                    await writer.drain()
                    ctx.bytes_out += len(ok) + 4
                # COM_INIT_DB = 0x02
                elif cmd_byte == 0x02:
                    ctx.database = cmd_payload[1:].decode("utf-8", errors="replace")
                    ok = build_ok_packet()
                    writer.write(build_packet(ok, seq_id=ctx.seq_id))
                    await writer.drain()
                    ctx.bytes_out += len(ok) + 4
                # COM_QUERY = 0x03 (Milestone B — for now, send ERR 1064)
                elif cmd_byte == 0x03:
                    err = build_err_packet(1064, "You have an error in your SQL syntax", sql_state="42000")
                    writer.write(build_packet(err, seq_id=ctx.seq_id))
                    await writer.drain()
                    ctx.bytes_out += len(err) + 4
                else:
                    err = build_err_packet(1047, "Unknown command", sql_state="HY000")
                    writer.write(build_packet(err, seq_id=ctx.seq_id))
                    await writer.drain()
                    ctx.bytes_out += len(err) + 4

    except Exception as e:
        logger.error(f"MySQL decoy error from {ctx.peer_ip}: {e}")
    finally:
        # Log connection event
        try:
            duration = time.time() - ctx.start_time
            await _log_connection_event(sink, ctx, duration)
        except Exception:
            pass

        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass


async def _log_connection_event(sink, ctx: ConnectionContext, duration: float):
    """Build and persist a db_connection event."""
    import uuid
    from app.models.security_event import SecurityEvent

    event = SecurityEvent(
        id=uuid.uuid4(),
        timestamp=datetime.now(timezone.utc),
        source_ip=ctx.peer_ip,
        source_port=ctx.peer_port,
        http_method="SQL",
        request_path="/mysql/connect",
        query_params={},
        headers_sanitized={},
        user_agent="",
        event_type="db_connection",
        severity="low",
        is_test_event=False,
        correlation_id=str(uuid.uuid4())[:8],
        metadata_payload={
            "duration_seconds": round(duration, 2),
            "bytes_in": ctx.bytes_in,
            "bytes_out": ctx.bytes_out,
            "authenticated": ctx.authenticated,
            "username": ctx.username,
        },
    )
    await sink.persist([event])


# ============================================================================
# Server main
# ============================================================================
async def main():
    """Start the MySQL decoy server."""
    port = _get_port()
    version_string = _get_version_string()
    bait_credentials = _get_bait_credentials()

    # Choose sink: ForwardingEventSink if BACKEND_INGEST_URL is set,
    # JSONL stub sink otherwise
    if os.environ.get("BACKEND_INGEST_URL"):
        from app.core.event_sink import ForwardingEventSink, set_event_sink
        sink = ForwardingEventSink()
        sink.replay_spool_on_start()
        sink.start_worker()
        set_event_sink(sink)
        logger.info("MySQL decoy: using ForwardingEventSink")
    else:
        sink = JsonlStubSink()
        logger.info("MySQL decoy: using JSONL stub sink")

    sem = asyncio.Semaphore(MAX_CONNECTIONS)

    async def limited_handler(reader, writer):
        async with sem:
            await handle_connection(
                reader, writer, sink, version_string, bait_credentials
            )

    server = await asyncio.start_server(limited_handler, "0.0.0.0", port)
    logger.info(f"MySQL decoy listening on port {port} (version: {version_string})")

    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
