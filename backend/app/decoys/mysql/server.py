"""MySQL decoy server — asyncio TCP server with limits and timeouts.

Tasks 3 + 4 + query-handling milestone of db-decoy spec (R1, R3.1, R4).

Entry point: python -m app.decoys.mysql.server
Starts a ForwardingEventSink (BACKEND_INGEST_URL set) or JSONL stub sink.

Safety:
- HANDSHAKE_TIMEOUT (10s default): covers TCP-connect → login-packet.
- IDLE_TIMEOUT (30s default): covers each command after login.
- Packet length checked before payload is read.
- COM_QUERY payloads over 64 KB → ERR 1153, then close the connection.
- 201st connection is closed immediately (not queued on a semaphore).
- All errors caught; writer always closed in finally.
- No LOCAL INFILE, SSL or compression advertised.
- Bait credentials from settings / env, never hardcoded.
"""

from __future__ import annotations

import asyncio
import itertools
import json
import os
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from app.decoys.mysql.auth import verify_native_password
from app.decoys.mysql.classifier import classify, sanitize_query_text
from app.decoys.mysql.events import (
    build_connection_event,
    build_login_attempt_event,
    build_query_event,
    _serialize_for_stub,
)
from app.decoys.mysql.protocol import (
    MAX_PACKET_BYTES,
    build_err_packet,
    build_handshake_v10,
    build_ok_packet,
    build_packet,
    parse_handshake_response_41,
    read_packet,
)
from app.decoys.mysql.responses import dispatch_query
from app.logging_config import logger

# Per-process connection ID counter (starts at 11, wraps at 16 M)
_CONNECTION_ID_COUNTER = itertools.count(11)

# Maximum COM_QUERY payload in bytes (64 KB; oversize → ERR 1153 + close)
MAX_QUERY_BYTES = 65_536

# Maximum db_query events logged per connection before only counting
MAX_QUERY_EVENTS_PER_CONN = 200

# Safety cap for commands per connection. Real MySQL has no such limit;
# this is a runaway-protection ceiling only. Connections close via idle
# timeout or COM_QUIT, not by hitting this number.
_SAFETY_MAX_COMMANDS = 100_000


# ---------------------------------------------------------------------------
# Configuration helpers (read from settings or env vars)
# ---------------------------------------------------------------------------
def _get_settings():
    try:
        from app.config import settings
        return settings
    except Exception:
        return None


def _cfg(attr: str, default):
    s = _get_settings()
    return getattr(s, attr, default) if s else default


def _get_bait_credentials() -> List[Tuple[str, str]]:
    raw = _cfg("MYSQL_DECOY_BAIT_CREDENTIALS", "[]")
    try:
        creds = json.loads(raw)
        return [(c["username"], c["password"]) for c in creds]
    except (json.JSONDecodeError, KeyError, TypeError):
        return []


# ---------------------------------------------------------------------------
# JSONL stub sink (local testing without a backend)
# ---------------------------------------------------------------------------
class JsonlStubSink:
    """Writes events as JSONL to a file. Used for local testing only."""

    def __init__(self, path: str = "/tmp/mysql_decoy_events.jsonl"):
        self._path = path
        os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)

    async def persist(self, objects, broadcast_summary=None):
        with open(self._path, "a", encoding="utf-8") as f:
            for obj in objects:
                f.write(json.dumps(_serialize_for_stub(obj)) + "\n")


# ---------------------------------------------------------------------------
# Connection context
# ---------------------------------------------------------------------------
class ConnectionContext:
    """Mutable per-connection state."""

    __slots__ = (
        "peer_ip", "peer_port", "salt", "connection_id",
        "start_time", "bytes_in", "bytes_out", "commands",
        "username", "database", "authenticated",
        "has_login_attempt", "correlation_id",
        "login_event_id", "conn_event_id",
        "query_events_logged", "queries_total",
    )

    def __init__(self, writer: asyncio.StreamWriter):
        peername = writer.get_extra_info("peername")
        self.peer_ip: str = peername[0] if peername else "0.0.0.0"
        self.peer_port: Optional[int] = peername[1] if peername else None
        self.salt: bytes = secrets.token_bytes(20)
        self.connection_id: int = next(_CONNECTION_ID_COUNTER) & 0xFFFFFF
        self.start_time: float = time.monotonic()
        self.bytes_in: int = 0
        self.bytes_out: int = 0
        self.commands: int = 0
        self.username: Optional[str] = None
        self.database: Optional[str] = None
        self.authenticated: bool = False
        self.has_login_attempt: bool = False
        self.correlation_id: str = str(uuid.uuid4())[:8]
        self.login_event_id: uuid.UUID = uuid.uuid4()
        self.conn_event_id: uuid.UUID = uuid.uuid4()
        self.query_events_logged: int = 0   # db_query events emitted this connection
        self.queries_total: int = 0          # total COM_QUERY packets received


# ---------------------------------------------------------------------------
# Connection handler
# ---------------------------------------------------------------------------
async def handle_connection(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    sink,
    version_string: str,
    bait_credentials: List[Tuple[str, str]],
    handshake_timeout: float = 10.0,
    idle_timeout: float = 30.0,
    conn_lifetime: float = 300.0,
    max_commands: int = _SAFETY_MAX_COMMANDS,
):
    """Handle one MySQL connection end-to-end."""
    ctx = ConnectionContext(writer)
    logger.info(f"MySQL decoy: new connection from {ctx.peer_ip}:{ctx.peer_port}")

    try:
        deadline = time.monotonic() + conn_lifetime

        # ── 1. Send Initial Handshake v10 ───────────────────────────────────
        hs_payload = build_handshake_v10(ctx.connection_id, ctx.salt, version_string)
        pkt = build_packet(hs_payload, seq_id=0)
        writer.write(pkt)
        await writer.drain()
        ctx.bytes_out += len(pkt)

        # ── 2. Read client login packet (HANDSHAKE_TIMEOUT) ─────────────────
        try:
            payload, seq_id = await asyncio.wait_for(
                read_packet(reader, MAX_PACKET_BYTES),
                timeout=handshake_timeout,
            )
        except asyncio.TimeoutError:
            logger.info(f"MySQL decoy: handshake timeout from {ctx.peer_ip}")
            return
        except (asyncio.IncompleteReadError, ValueError) as e:
            logger.info(f"MySQL decoy: handshake read error from {ctx.peer_ip}: {e}")
            return

        ctx.bytes_in += len(payload) + 4

        # ── 3. Parse handshake response ──────────────────────────────────────
        try:
            resp = parse_handshake_response_41(payload)
        except ValueError as e:
            if "ssl_request" in str(e):
                logger.info(f"MySQL decoy: SSL request from {ctx.peer_ip}, closing")
            else:
                logger.warning(f"MySQL decoy: malformed handshake from {ctx.peer_ip}: {e}")
            return

        ctx.username = resp["username"]
        ctx.database = resp["database"]
        auth_response = resp["auth_response"]
        ctx.has_login_attempt = True

        # ── 4. Verify bait credentials ───────────────────────────────────────
        for cred_user, cred_pass in bait_credentials:
            if cred_user == ctx.username:
                if verify_native_password(
                    auth_response, ctx.salt, cred_pass.encode("utf-8")
                ):
                    ctx.authenticated = True
                    break

        # ── 5. Emit db_login_attempt event BEFORE sending OK/ERR ────────────
        try:
            login_ev, login_attempt = build_login_attempt_event(
                event_id=ctx.login_event_id,
                source_ip=ctx.peer_ip,
                source_port=ctx.peer_port,
                username=ctx.username,
                auth_response=auth_response,
                authenticated=ctx.authenticated,
                correlation_id=ctx.correlation_id,
            )
            await sink.persist([login_ev, login_attempt])
        except Exception as e:
            logger.error(f"MySQL decoy: failed to persist login event: {e}")

        # ── 6. Send OK or ERR 1045 ───────────────────────────────────────────
        ctx.bytes_out += await _send_auth_response(
            ctx, writer, auth_response
        )

        # ── 7. Command phase (only if authenticated) ─────────────────────────
        if ctx.authenticated:
            await _command_phase(
                ctx, reader, writer, deadline, idle_timeout, max_commands,
                sink, version_string,
            )

    except Exception as e:
        logger.error(f"MySQL decoy: unhandled error from {ctx.peer_ip}: {e}")
    finally:
        await _persist_connection_event(ctx, sink)
        try:
            writer.close()
            await asyncio.wait_for(writer.wait_closed(), timeout=2.0)
        except Exception:
            pass


async def _send_auth_response(
    ctx: ConnectionContext,
    writer: asyncio.StreamWriter,
    auth_response: bytes,
) -> int:
    """Send OK or ERR 1045. Returns bytes written."""
    seq = 2
    if ctx.authenticated:
        pkt = build_packet(build_ok_packet(), seq_id=seq)
        logger.info(
            f"MySQL decoy: login accepted user='{ctx.username}' from {ctx.peer_ip}"
        )
    else:
        msg = (
            f"Access denied for user '{ctx.username or ''}'@'{ctx.peer_ip}' "
            f"(using password: {'YES' if auth_response else 'NO'})"
        )
        pkt = build_packet(build_err_packet(1045, msg, sql_state="28000"), seq_id=seq)
        logger.info(
            f"MySQL decoy: login denied user='{ctx.username}' from {ctx.peer_ip}"
        )
    writer.write(pkt)
    await writer.drain()
    return len(pkt)


async def _command_phase(
    ctx: ConnectionContext,
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    deadline: float,
    idle_timeout: float,
    max_commands: int,
    sink,
    version_string: str,
):
    """Handle COM_* commands after a successful login."""
    while time.monotonic() < deadline and ctx.commands < max_commands:
        try:
            cmd_payload, cmd_seq = await asyncio.wait_for(
                read_packet(reader, MAX_PACKET_BYTES),
                timeout=idle_timeout,
            )
        except (asyncio.TimeoutError, asyncio.IncompleteReadError, ValueError):
            break

        ctx.bytes_in += len(cmd_payload) + 4
        ctx.commands += 1
        seq = cmd_seq + 1

        if not cmd_payload:
            break

        cmd = cmd_payload[0]
        if cmd == 0x01:  # COM_QUIT
            break

        elif cmd == 0x0E:  # COM_PING
            pkt = build_packet(build_ok_packet(), seq_id=seq)
            writer.write(pkt)
            await writer.drain()
            ctx.bytes_out += len(pkt)

        elif cmd == 0x02:  # COM_INIT_DB
            db = cmd_payload[1:].decode("utf-8", errors="replace")[:64]
            ctx.database = db
            pkt = build_packet(build_ok_packet(), seq_id=seq)
            writer.write(pkt)
            await writer.drain()
            ctx.bytes_out += len(pkt)

        elif cmd == 0x03:  # COM_QUERY
            query_bytes = cmd_payload[1:]

            # Item 7: query over 64 KB → ERR 1153 then close
            if len(query_bytes) > MAX_QUERY_BYTES:
                pkt = build_packet(
                    build_err_packet(1153, "Got a packet bigger than 'max_allowed_packet' bytes", "08S01"),
                    seq_id=seq,
                )
                writer.write(pkt)
                await writer.drain()
                break  # close connection after oversized query

            raw_query = query_bytes.decode("utf-8", errors="replace")
            ctx.queries_total += 1
            clean_query, truncated = sanitize_query_text(raw_query)
            tag, severity = classify(clean_query)

            # Build and send response
            response_pkts = dispatch_query(clean_query, ctx, seq, version_string)
            for pkt in response_pkts:
                writer.write(pkt)
            await writer.drain()
            ctx.bytes_out += sum(len(p) for p in response_pkts)

            # Log db_query event (capped at MAX_QUERY_EVENTS_PER_CONN)
            if ctx.query_events_logged < MAX_QUERY_EVENTS_PER_CONN:
                try:
                    qev = build_query_event(
                        event_id=uuid.uuid4(),
                        source_ip=ctx.peer_ip,
                        source_port=ctx.peer_port,
                        query_text=clean_query,
                        query_truncated=truncated,
                        tag=tag,
                        severity=severity,
                        correlation_id=ctx.correlation_id,
                    )
                    await sink.persist([qev])
                    ctx.query_events_logged += 1
                except Exception as e:
                    logger.error(f"MySQL decoy: failed to persist query event: {e}")

        else:
            pkt = build_packet(
                build_err_packet(1047, "Unknown command", "HY000"), seq_id=seq
            )
            writer.write(pkt)
            await writer.drain()
            ctx.bytes_out += len(pkt)


async def _persist_connection_event(ctx: ConnectionContext, sink):
    """Build and persist the db_connection event at connection close.

    Skips loopback connections with zero bytes received — these are
    Docker healthcheck TCP probes and would generate one event every
    15 seconds. Real scans from the host appear as the Docker gateway
    IP (e.g. 172.x.x.x), not 127.0.0.1/::1, so they are still logged.
    """
    if ctx.bytes_in == 0 and ctx.peer_ip in ("127.0.0.1", "::1"):
        return
    try:
        duration = time.monotonic() - ctx.start_time
        conn_ev = build_connection_event(
            event_id=ctx.conn_event_id,
            source_ip=ctx.peer_ip,
            source_port=ctx.peer_port,
            username=ctx.username,
            authenticated=ctx.authenticated,
            has_login_attempt=ctx.has_login_attempt,
            duration_seconds=duration,
            bytes_in=ctx.bytes_in,
            bytes_out=ctx.bytes_out,
            correlation_id=ctx.correlation_id,
            queries_total=getattr(ctx, "queries_total", 0),
        )
        await sink.persist([conn_ev])
    except Exception as e:
        logger.error(f"MySQL decoy: failed to persist connection event: {e}")


# ---------------------------------------------------------------------------
# Server entry point
# ---------------------------------------------------------------------------
async def main():
    """Start the MySQL decoy server."""
    port = _cfg("MYSQL_DECOY_PORT", 3306)
    version_string = _cfg("MYSQL_DECOY_VERSION_STRING", "8.0.36-0ubuntu0.22.04.1")
    bait_credentials = _get_bait_credentials()
    handshake_timeout = _cfg("MYSQL_DECOY_HANDSHAKE_TIMEOUT", 10.0)
    idle_timeout = _cfg("MYSQL_DECOY_IDLE_TIMEOUT", 30.0)
    max_conns = _cfg("MYSQL_DECOY_MAX_CONNECTIONS", 100)

    if os.environ.get("BACKEND_INGEST_URL") or _cfg("BACKEND_INGEST_URL", ""):
        from app.core.event_sink import ForwardingEventSink, set_event_sink
        sink = ForwardingEventSink()
        spool_dir = _cfg("MYSQL_DECOY_SPOOL_DIR", "/tmp/argus_mysql_decoy_spool")
        sink._spool_dir = __import__("pathlib").Path(spool_dir)
        sink._spool_file = sink._spool_dir / "events.jsonl"
        sink._spool_dir.mkdir(parents=True, exist_ok=True)
        sink.replay_spool_on_start()
        sink.start_worker()
        set_event_sink(sink)
        logger.info("MySQL decoy: using ForwardingEventSink")
    else:
        sink = JsonlStubSink()
        logger.info("MySQL decoy: using JSONL stub sink")

    # Active-connection counter (not a semaphore — 201st is closed, not queued)
    _active = [0]

    async def handler(reader, writer):
        _active[0] += 1
        if _active[0] > max_conns:
            _active[0] -= 1
            logger.warning(
                f"MySQL decoy: connection cap ({max_conns}) reached, "
                f"closing {writer.get_extra_info('peername')}"
            )
            try:
                writer.close()
                await asyncio.wait_for(writer.wait_closed(), timeout=1.0)
            except Exception:
                pass
            return
        try:
            await handle_connection(
                reader, writer, sink, version_string, bait_credentials,
                handshake_timeout=handshake_timeout,
                idle_timeout=idle_timeout,
            )
        finally:
            _active[0] -= 1

    server = await asyncio.start_server(handler, "0.0.0.0", port)
    logger.info(f"MySQL decoy listening on port {port} (max_conns={max_conns})")
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
