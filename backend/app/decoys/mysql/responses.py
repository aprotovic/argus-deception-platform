"""Fake query responses for the MySQL decoy (items 2, 3, 4 of query-handling milestone).

dispatch_query(query_text, ctx) -> list[bytes]

Returns a list of framed packets to write to the client.
Never executes SQL. Never touches a real database. Every answer is hardcoded
or generated from module-level constants.

Handled queries (all case-insensitive, trimmed):
  SELECT 1                        → single-column, single-row result set
  SELECT VERSION()                → server version string
  SELECT @@version                → same as VERSION()
  SELECT @@version_comment        → "(Ubuntu)"
  select @@version_comment limit 1 → same
  SELECT DATABASE()               → current database (ctx.database or "(none)")
  SELECT USER()                   → "<username>@<peer_ip>"
  SELECT CURRENT_USER()           → same as USER()
  SELECT CONNECTION_ID()          → ctx.connection_id
  SELECT NOW()                    → current UTC datetime string
  SHOW DATABASES                  → fixed list
  SHOW TABLES                     → fixed list for nexis_hr
  SHOW VARIABLES [LIKE …]         → key subset
  SHOW GRANTS                     → GRANT ALL on nexis_hr
  SELECT * FROM personnel [LIMIT] → fake_data rows (public columns only)
  SET …                           → OK
  USE <db>                        → OK, updates ctx.database
  COM_INIT_DB payload             → handled in server.py

Error responses:
  mysql.user access               → ERR 1142 (command denied)
  unknown table                   → ERR 1146
  syntax errors / unknown         → ERR 1064 with first-20-char excerpt

Notes:
  - mysql.user returning ERR 1142 is a slight tell for root because a
    real root user can read mysql.user. Acceptable for a low-interaction decoy.
  - LOCAL INFILE is never handled; classifier tags those as file_access first.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, List, TYPE_CHECKING

from app.decoys.mysql.protocol import (
    FIELD_TYPE_LONGLONG,
    FIELD_TYPE_VAR_STRING,
    build_err_packet,
    build_ok_packet,
    build_packet,
    build_result_set,
)
from app.decoys.mysql.fake_data import (
    PERSONNEL_PUBLIC_COLUMNS,
    PERSONNEL_ROWS,
)

if TYPE_CHECKING:
    from app.decoys.mysql.server import ConnectionContext

# ── fixed fake values ─────────────────────────────────────────────────────────
_DATABASES = ["information_schema", "mysql", "performance_schema", "sys", "nexis_hr"]
_TABLES = ["personnel", "access_log", "departments"]

_SHOW_VARIABLES = {
    "version": "8.0.36-0ubuntu0.22.04.1",
    "version_comment": "(Ubuntu)",
    "character_set_server": "utf8mb4",
    "collation_server": "utf8mb4_0900_ai_ci",
    "max_connections": "151",
    "datadir": "/var/lib/mysql/",
    "hostname": "nexis-db-01",
    "sql_mode": "STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION",
}

# ── helpers ───────────────────────────────────────────────────────────────────
def _one_col_one_row(col_name: str, value: Any, seq: int) -> List[bytes]:
    cols = [{"name": col_name}]
    rows = [[value]]
    return build_result_set(cols, rows, seq_start=seq)


def _ok(seq: int) -> List[bytes]:
    return [build_packet(build_ok_packet(), seq_id=seq)]


def _err(code: int, msg: str, state: str, seq: int) -> List[bytes]:
    return [build_packet(build_err_packet(code, msg, state), seq_id=seq)]


def _syntax_err(query_text: str, seq: int) -> List[bytes]:
    # No escaping: real MySQL shows the raw text from the failing token.
    # Truncate to 80 chars matching real MySQL's excerpt length.
    excerpt = query_text[:80]
    return _err(1064, _err1064_msg(excerpt), "42000", seq)


def _err1064_msg(near_text: str) -> str:
    """Build the exact MySQL ERR 1064 message string.

    Single shared function — no other code builds this message.
    No backslash-escaping of the near_text (real MySQL shows raw text).
    """
    return (
        "You have an error in your SQL syntax; check the manual that corresponds "
        "to your MySQL server version for the right syntax to use near "
        f"'{near_text}' at line 1"
    )


def _unknown_table_err(table_name: str, db: str, seq: int) -> List[bytes]:
    return _err(1146, f"Table '{db}.{table_name}' doesn't exist", "42S02", seq)


# ── normaliser ────────────────────────────────────────────────────────────────
def _norm(s: str) -> str:
    """Lowercase, collapse whitespace, strip trailing semicolon."""
    s = s.lower().strip()
    s = re.sub(r"\s+", " ", s)
    return s.rstrip(";").strip()


# ── LIMIT extractor ───────────────────────────────────────────────────────────
_LIMIT_RE = re.compile(r"\blimit\s+(\d+)", re.IGNORECASE)

def _extract_limit(query: str, default: int = 50) -> int:
    m = _LIMIT_RE.search(query)
    if m:
        return min(int(m.group(1)), 1000)
    return default


# ── main dispatcher ───────────────────────────────────────────────────────────
def dispatch_query(
    query_text: str,
    ctx: "ConnectionContext",
    seq: int,
    version_string: str,
) -> List[bytes]:
    """Dispatch a COM_QUERY payload and return response packets.

    Parameters
    ----------
    query_text   raw query string (already sanitized and truncated in server.py)
    ctx          ConnectionContext — read-only: peer_ip, username, database, connection_id
    seq          sequence id for the first response packet
    version_string the banner version string (from config / env)
    """
    n = _norm(query_text)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # ── mysql.user → 1142 (command denied) ────────────────────────────────────
    if "mysql.user" in n or "mysql . user" in n:
        return _err(
            1142,
            f"SELECT command denied to user '{ctx.username}'@'{ctx.peer_ip}' "
            f"for table 'user'",
            "42000", seq,
        )

    # ── SET … → OK ─────────────────────────────────────────────────────────────
    if n.startswith("set "):
        return _ok(seq)

    # ── USE <db> → OK, update ctx.database ─────────────────────────────────────
    m = re.match(r"^use\s+(\S+)$", n)
    if m:
        db = m.group(1).strip("`'\"")
        ctx.database = db[:64]
        return _ok(seq)

    # ── SELECT 1 ───────────────────────────────────────────────────────────────
    if n in ("select 1", "select 1 as alive", "select 1 as ping"):
        return _one_col_one_row("1", "1", seq)

    # ── SELECT VERSION() ───────────────────────────────────────────────────────
    if re.match(r"^select\s+version\s*\(\s*\)$", n):
        return _one_col_one_row("VERSION()", version_string, seq)

    # ── SELECT @@version ───────────────────────────────────────────────────────
    if re.match(r"^select\s+@@version$", n):
        return _one_col_one_row("@@version", version_string, seq)

    # ── SELECT @@version_comment [LIMIT 1] ─────────────────────────────────────
    if re.match(r"^select\s+@@version_comment(\s+limit\s+\d+)?$", n):
        return _one_col_one_row("@@version_comment", "(Ubuntu)", seq)

    # ── SELECT @@<var> (generic) ────────────────────────────────────────────────
    m = re.match(r"^select\s+@@(\w+)$", n)
    if m:
        var = m.group(1)
        val = _SHOW_VARIABLES.get(var, "")
        return _one_col_one_row(f"@@{var}", val, seq)

    # ── SELECT DATABASE() ──────────────────────────────────────────────────────
    if re.match(r"^select\s+database\s*\(\s*\)$", n):
        db = ctx.database or None
        return _one_col_one_row("DATABASE()", db, seq)

    # ── SELECT USER() / CURRENT_USER() ─────────────────────────────────────────
    if re.match(r"^select\s+(user|current_user)\s*\(\s*\)$", n):
        val = f"{ctx.username or ''}@{ctx.peer_ip}"
        return _one_col_one_row("USER()", val, seq)

    # ── SELECT CONNECTION_ID() ─────────────────────────────────────────────────
    if re.match(r"^select\s+connection_id\s*\(\s*\)$", n):
        cols = [{"name": "CONNECTION_ID()", "type": FIELD_TYPE_LONGLONG, "length": 20}]
        return build_result_set(cols, [[str(ctx.connection_id)]], seq_start=seq)

    # ── SELECT NOW() ───────────────────────────────────────────────────────────
    if re.match(r"^select\s+now\s*\(\s*\)$", n):
        return _one_col_one_row("NOW()", now_str, seq)

    # ── SHOW DATABASES ─────────────────────────────────────────────────────────
    if n in ("show databases", "show schemas"):
        cols = [{"name": "Database"}]
        rows = [[db] for db in _DATABASES]
        return build_result_set(cols, rows, seq_start=seq)

    # ── SHOW TABLES ────────────────────────────────────────────────────────────
    if re.match(r"^show\s+(?:full\s+)?tables", n):
        db_label = ctx.database or "nexis_hr"
        cols = [{"name": f"Tables_in_{db_label}"}]
        rows = [[t] for t in _TABLES]
        return build_result_set(cols, rows, seq_start=seq)

    # ── SHOW VARIABLES [LIKE …] ────────────────────────────────────────────────
    if re.match(r"^show\s+(?:global\s+|session\s+)?variables", n):
        m_like = re.search(r"like\s+'([^']+)'", n)
        like_pat = None
        if m_like:
            like_pat = re.compile(
                m_like.group(1).replace("%", ".*").replace("_", "."), re.IGNORECASE
            )
        cols = [{"name": "Variable_name"}, {"name": "Value"}]
        rows = [
            [k, v] for k, v in _SHOW_VARIABLES.items()
            if like_pat is None or like_pat.fullmatch(k)
        ]
        return build_result_set(cols, rows, seq_start=seq)

    # ── SHOW GRANTS ────────────────────────────────────────────────────────────
    if re.match(r"^show\s+grants", n):
        user_str = f"{ctx.username or ''}@{ctx.peer_ip}"
        grant = f"GRANT ALL PRIVILEGES ON `nexis_hr`.* TO '{user_str}'"
        cols = [{"name": f"Grants for {user_str}"}]
        return build_result_set(cols, [[grant]], seq_start=seq)

    # ── SELECT * FROM personnel [LIMIT n] ──────────────────────────────────────
    if re.match(r"^select\s+\*\s+from\s+`?personnel`?", n):
        limit = _extract_limit(n)
        cols = [{"name": c} for c in PERSONNEL_PUBLIC_COLUMNS]
        rows = [
            [row[c] for c in PERSONNEL_PUBLIC_COLUMNS]
            for row in PERSONNEL_ROWS[:limit]
        ]
        return build_result_set(cols, rows, seq_start=seq)

    # ── SELECT * FROM access_log / departments → empty result ──────────────────
    if re.match(r"^select\s+\*\s+from\s+`?(access_log|departments)`?", n):
        m_tbl = re.match(r"^select\s+\*\s+from\s+`?(\w+)`?", n)
        tbl = m_tbl.group(1) if m_tbl else "unknown"
        return build_result_set(
            [{"name": "id"}, {"name": "data"}], [], seq_start=seq
        )

    # ── SELECT * FROM <unknown table> → ERR 1146 ───────────────────────────────
    m_from = re.match(r"^select\s+.*\bfrom\s+`?(\w+)`?", n)
    if m_from:
        tbl = m_from.group(1)
        if tbl not in ("personnel", "access_log", "departments", "dual"):
            db = ctx.database or "nexis_hr"
            return _unknown_table_err(tbl, db, seq)

    # ── Fallthrough: ERR 1064 ──────────────────────────────────────────────────
    return _syntax_err(query_text, seq)
