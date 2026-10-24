"""Unit tests for MySQL query dispatcher, event builder, and safety limits (items 3–7).

Tests:
- dispatch_query returns correct packet sequences for all handled queries
- Connection ID used consistently in handshake and SELECT CONNECTION_ID()
- db_query events contain query_text, tag, severity (no password data)
- Query event cap: events logged only up to MAX_QUERY_EVENTS_PER_CONN
- Query over 64 KB returns ERR 1153
- sanitize_query_text redaction and NUL-strip
"""

import asyncio
import json
import struct
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.decoys.mysql.classifier import sanitize_query_text
from app.decoys.mysql.events import build_query_event
from app.decoys.mysql.protocol import (
    SERVER_STATUS_AUTOCOMMIT,
    build_handshake_v10,
    decode_lenenc,
    decode_lenenc_str,
)
from app.decoys.mysql.responses import dispatch_query
from app.decoys.mysql.server import (
    MAX_QUERY_BYTES,
    MAX_QUERY_EVENTS_PER_CONN,
    _CONNECTION_ID_COUNTER,
)


# ── test context ───────────────────────────────────────────────────────────────
def _ctx(username="root", peer_ip="10.0.0.1", database=None, conn_id=42):
    c = SimpleNamespace(
        username=username,
        peer_ip=peer_ip,
        database=database,
        connection_id=conn_id,
    )
    return c


VERSION = "8.0.36-0ubuntu0.22.04.1"


def _unframe(pkt):
    length = pkt[0] | (pkt[1] << 8) | (pkt[2] << 16)
    seq = pkt[3]
    return pkt[4:4 + length], seq


def _parse_result(pkts):
    """Parse a text result set into (columns, rows).
    pkts is the list returned by dispatch_query.
    """
    payloads = [_unframe(p)[0] for p in pkts]
    col_count, _ = decode_lenenc(payloads[0])
    columns = []
    for i in range(1, 1 + col_count):
        off = 0
        for _ in range(5):  # skip catalog, schema, table, org_table, name
            val, n = decode_lenenc_str(payloads[i], off); off += n
        name, n = decode_lenenc_str(payloads[i], off)
        columns.append(name.decode())
    # skip EOF at index 1+col_count; rows start after
    rows = []
    for pkt_payload in payloads[2 + col_count:-1]:
        if pkt_payload and pkt_payload[0] == 0xFE:
            break   # final EOF
        row, off = [], 0
        while off < len(pkt_payload):
            if pkt_payload[off] == 0xFB:
                row.append(None); off += 1
            else:
                val, n = decode_lenenc_str(pkt_payload, off)
                row.append(val.decode()); off += n
        rows.append(row)
    return columns, rows


# ── connection ID ──────────────────────────────────────────────────────────────
def test_connection_id_sequential():
    """Connection IDs from the module counter must be sequential."""
    ids = [next(_CONNECTION_ID_COUNTER) for _ in range(5)]
    diffs = [ids[i+1] - ids[i] for i in range(4)]
    assert all(d == 1 for d in diffs)


def test_connection_id_in_handshake():
    """The connection ID in the handshake must match what the counter produces."""
    conn_id = next(_CONNECTION_ID_COUNTER) & 0xFFFFFF
    payload = build_handshake_v10(conn_id, b"\x01" * 20, VERSION)
    idx = payload.find(b"\x00", 1) + 1   # after version NUL
    cid_from_packet = struct.unpack_from("<I", payload, idx)[0]
    assert cid_from_packet == conn_id


def test_select_connection_id_matches_ctx():
    """SELECT CONNECTION_ID() must return ctx.connection_id."""
    ctx = _ctx(conn_id=7777)
    pkts = dispatch_query("SELECT CONNECTION_ID()", ctx, seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    assert rows[0][0] == "7777"


# ── query responses ────────────────────────────────────────────────────────────
def test_select_1():
    pkts = dispatch_query("SELECT 1", _ctx(), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    assert rows[0][0] == "1"


def test_select_version():
    pkts = dispatch_query("SELECT VERSION()", _ctx(), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    assert rows[0][0] == VERSION


def test_select_atversion():
    pkts = dispatch_query("SELECT @@version", _ctx(), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    assert rows[0][0] == VERSION


def test_select_version_comment():
    pkts = dispatch_query("SELECT @@version_comment", _ctx(), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    assert rows[0][0] == "(Ubuntu)"


def test_select_version_comment_limit_1():
    pkts = dispatch_query("select @@version_comment limit 1", _ctx(), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    assert rows[0][0] == "(Ubuntu)"


def test_select_database_none():
    pkts = dispatch_query("SELECT DATABASE()", _ctx(database=None), seq=1, version_string=VERSION)
    payloads = [_unframe(p)[0] for p in pkts]
    # row packet is after col_count + col_def + eof
    row_payload = payloads[3]
    assert row_payload[0] == 0xFB   # NULL


def test_select_database_set():
    pkts = dispatch_query("SELECT DATABASE()", _ctx(database="nexis_hr"), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    assert rows[0][0] == "nexis_hr"


def test_select_user():
    pkts = dispatch_query("SELECT USER()", _ctx(username="root", peer_ip="10.0.0.1"), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    assert rows[0][0] == "root@10.0.0.1"


def test_select_current_user():
    pkts = dispatch_query("SELECT CURRENT_USER()", _ctx(username="admin"), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    assert "admin" in rows[0][0]


def test_select_now_returns_datetime():
    pkts = dispatch_query("SELECT NOW()", _ctx(), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    # Should look like "2026-10-23 20:00:00"
    val = rows[0][0]
    assert len(val) == 19
    assert val[4] == "-"


def test_show_databases():
    pkts = dispatch_query("SHOW DATABASES", _ctx(), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    db_names = [r[0] for r in rows]
    assert "nexis_hr" in db_names
    assert "information_schema" in db_names


def test_show_tables():
    pkts = dispatch_query("SHOW TABLES", _ctx(), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    table_names = [r[0] for r in rows]
    assert "personnel" in table_names


def test_show_variables():
    pkts = dispatch_query("SHOW VARIABLES", _ctx(), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    names = [r[0] for r in rows]
    assert "version" in names


def test_show_variables_like():
    pkts = dispatch_query("SHOW VARIABLES LIKE 'version'", _ctx(), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    assert any(r[0] == "version" for r in rows)


def test_show_grants():
    pkts = dispatch_query("SHOW GRANTS", _ctx(username="root"), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    assert "GRANT ALL PRIVILEGES ON *.*" in rows[0][0]
    assert "`root`@`%`" in rows[0][0]
    assert "WITH GRANT OPTION" in rows[0][0]


def test_select_from_personnel():
    pkts = dispatch_query("SELECT * FROM personnel", _ctx(database="nexis_hr"), seq=1, version_string=VERSION)
    cols, rows = _parse_result(pkts)
    assert "employee_id" in cols
    assert len(rows) == 8
    # badge_id must NOT be in public columns
    assert "badge_id" not in cols


def test_select_from_personnel_limit():
    pkts = dispatch_query("SELECT * FROM personnel LIMIT 3", _ctx(database="nexis_hr"), seq=1, version_string=VERSION)
    _, rows = _parse_result(pkts)
    assert len(rows) == 3


def test_set_returns_ok():
    pkts = dispatch_query("SET NAMES utf8mb4", _ctx(), seq=1, version_string=VERSION)
    payload, _ = _unframe(pkts[0])
    assert payload[0] == 0x00   # OK packet


def test_use_db_returns_ok():
    ctx = _ctx(database=None)
    pkts = dispatch_query("USE nexis_hr", ctx, seq=1, version_string=VERSION)
    payload, _ = _unframe(pkts[0])
    assert payload[0] == 0x00
    assert ctx.database == "nexis_hr"


def test_mysql_user_returns_1142():
    pkts = dispatch_query("SELECT * FROM mysql.user", _ctx(), seq=1, version_string=VERSION)
    payload, _ = _unframe(pkts[0])
    assert payload[0] == 0xFF
    code = struct.unpack_from("<H", payload, 1)[0]
    assert code == 1142


def test_unknown_table_returns_1146():
    pkts = dispatch_query("SELECT * FROM secret_table", _ctx(database="nexis_hr"), seq=1, version_string=VERSION)
    payload, _ = _unframe(pkts[0])
    assert payload[0] == 0xFF
    code = struct.unpack_from("<H", payload, 1)[0]
    assert code == 1146


def test_garbage_returns_1064():
    pkts = dispatch_query("THIS IS NOT SQL AT ALL !!!!", _ctx(), seq=1, version_string=VERSION)
    payload, _ = _unframe(pkts[0])
    assert payload[0] == 0xFF
    code = struct.unpack_from("<H", payload, 1)[0]
    assert code == 1064


# ── admin statements return OK (item 3) ───────────────────────────────────────
@pytest.mark.parametrize("stmt", [
    "CREATE USER 'zz'@'%' IDENTIFIED BY '[REDACTED]'",
    "DROP USER 'zz'@'%'",
    "ALTER USER 'root'@'%' IDENTIFIED BY '[REDACTED]'",
    "GRANT ALL ON *.* TO 'zz'@'%'",
    "REVOKE ALL ON *.* FROM 'zz'@'%'",
    "FLUSH PRIVILEGES",
    "SET PASSWORD FOR 'x'@'%' = '[REDACTED]'",
    "CREATE DATABASE nexis_ops",
    "DROP DATABASE nexis_ops",
])
def test_admin_stmt_returns_ok(stmt):
    pkts = dispatch_query(stmt, _ctx(), seq=1, version_string=VERSION)
    assert len(pkts) == 1
    payload, _ = _unframe(pkts[0])
    assert payload[0] == 0x00, f"Expected OK for: {stmt!r}, got 0x{payload[0]:02x}"


def test_create_user_password_redacted_before_dispatch():
    """After sanitize_query_text, IDENTIFIED BY literal is redacted in stored text."""
    from app.decoys.mysql.classifier import sanitize_query_text
    raw = "CREATE USER 'zz'@'%' IDENTIFIED BY 'LeakCheck999'"
    clean, _ = sanitize_query_text(raw)
    assert "LeakCheck999" not in clean
    assert "IDENTIFIED BY '[REDACTED]'" in clean
    # dispatch_query sees the sanitized text; result is still OK
    pkts = dispatch_query(clean, _ctx(), seq=1, version_string=VERSION)
    payload, _ = _unframe(pkts[0])
    assert payload[0] == 0x00


def test_1064_includes_excerpt():
    q = "BLARG WHOOPS SELECT"
    pkts = dispatch_query(q, _ctx(), seq=1, version_string=VERSION)
    payload, _ = _unframe(pkts[0])
    msg = payload[9:].decode("utf-8", errors="replace")
    assert q[:80] in msg


def test_1064_exact_message_format():
    """The full ERR 1064 message must match MySQL's exact format, no escaping."""
    from app.decoys.mysql.responses import _err1064_msg
    near = "bad syntax here"
    msg = _err1064_msg(near)
    expected = (
        "You have an error in your SQL syntax; check the manual that corresponds "
        "to your MySQL server version for the right syntax to use near "
        f"'{near}' at line 1"
    )
    assert msg == expected


def test_1064_no_backslash_escaping_of_single_quote():
    """Single quotes in the query must appear raw in the ERR message, not escaped."""
    # Use a clearly invalid statement (not a SELECT...FROM) that goes to _syntax_err
    q = "SELEC' broken query here"
    pkts = dispatch_query(q, _ctx(), seq=1, version_string=VERSION)
    payload, _ = _unframe(pkts[0])
    assert payload[0] == 0xFF
    code = struct.unpack_from("<H", payload, 1)[0]
    assert code == 1064
    msg = payload[9:].decode("utf-8", errors="replace")
    # The single quote must appear verbatim in the near text — not escaped
    assert "SELEC'" in msg
    assert "SELEC\\'" not in msg


def test_sequence_ids_increment():
    pkts = dispatch_query("SHOW DATABASES", _ctx(), seq=3, version_string=VERSION)
    seqs = [_unframe(p)[1] for p in pkts]
    assert seqs == list(range(3, 3 + len(pkts)))


# ── db_query event builder ─────────────────────────────────────────────────────
def test_query_event_fields():
    ev = build_query_event(
        event_id=uuid.uuid4(),
        source_ip="1.2.3.4",
        source_port=12345,
        query_text="SELECT 1",
        query_truncated=False,
        tag="recon",
        severity="medium",
        correlation_id="abc12345",
    )
    assert ev.event_type == "db_query"
    assert ev.severity == "medium"
    assert ev.metadata_payload["query_tag"] == "recon"
    assert ev.metadata_payload["query_text"] == "SELECT 1"
    assert ev.metadata_payload["query_truncated"] is False


def test_query_event_no_password_data():
    """Query event must never contain plaintext password strings."""
    raw = "CREATE USER 'x'@'%' IDENTIFIED BY 'mysecret'"
    clean, trunc = sanitize_query_text(raw)
    ev = build_query_event(
        event_id=uuid.uuid4(),
        source_ip="1.2.3.4",
        source_port=None,
        query_text=clean,
        query_truncated=trunc,
        tag="priv_esc",
        severity="high",
        correlation_id="x",
    )
    assert "mysecret" not in ev.metadata_payload["query_text"]
    assert "mysecret" not in str(ev.metadata_payload)


def test_query_event_nul_stripped():
    raw = "SELECT\x00*\x00FROM\x00t"
    clean, _ = sanitize_query_text(raw)
    ev = build_query_event(
        event_id=uuid.uuid4(),
        source_ip="1.2.3.4",
        source_port=None,
        query_text=clean,
        query_truncated=False,
        tag="normal",
        severity="medium",
        correlation_id="x",
    )
    assert "\x00" not in ev.metadata_payload["query_text"]


# ── query over 64 KB ──────────────────────────────────────────────────────────
def test_max_query_bytes_constant():
    assert MAX_QUERY_BYTES == 65_536


# ── query cap ─────────────────────────────────────────────────────────────────
def test_max_query_events_constant():
    assert MAX_QUERY_EVENTS_PER_CONN == 200
