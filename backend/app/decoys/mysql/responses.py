"""Fake query responses for the MySQL decoy.

dispatch_query(query_text, ctx) -> list[bytes]

Returns a list of framed packets to write to the client.
Never executes SQL. Never touches a real database. Every answer is hardcoded
or generated from module-level constants.

Handled queries (all case-insensitive, trimmed):
  SELECT 1 / expressions               → result set
  SELECT VERSION() / @@version etc.    → version info
  SELECT DATABASE() / USER() / NOW()   → connection info
  SHOW DATABASES / SCHEMAS             → fixed list
  SHOW TABLES [FROM db]                → fixed list
  SHOW VARIABLES [LIKE pattern]        → ~20 realistic variables
  SHOW GRANTS [FOR user]               → GRANT ALL PRIVILEGES ... WITH GRANT OPTION
  SHOW COLUMNS / DESCRIBE <table>      → table schema
  SELECT * / col-list FROM <table>     → fake rows
  SELECT COUNT(*) FROM <table>         → row count
  SELECT ... WHERE col='value'         → filtered rows (exact case-insensitive match)
  SELECT ... FROM db.table             → db-qualified queries work without USE
  SELECT * FROM information_schema.tables → 3 nexis_hr tables
  SET ...                              → OK
  USE <db>                             → OK, updates ctx.database
  Admin DDL/DCL                        → OK

Error responses:
  Table query with ctx.database is None and no db-qualifier → ERR 1046
  mysql.user access                    → ERR 1142
  unknown database in SHOW TABLES FROM → ERR 1049
  unknown table                        → ERR 1146
  syntax errors / unknown              → ERR 1064 with first-80-char excerpt
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from app.decoys.mysql.protocol import (
    FIELD_TYPE_LONGLONG,
    FIELD_TYPE_VAR_STRING,
    build_err_packet,
    build_ok_packet,
    build_packet,
    build_result_set,
)
from app.decoys.mysql.fake_data import (
    ACCESS_LOG_COLUMNS,
    ACCESS_LOG_ROWS,
    DEPARTMENTS_COLUMNS,
    DEPARTMENTS_ROWS,
    PERSONNEL_PUBLIC_COLUMNS,
    PERSONNEL_ROWS,
    TABLE_SCHEMAS,
)

if TYPE_CHECKING:
    from app.decoys.mysql.server import ConnectionContext

# ── fixed fake values ─────────────────────────────────────────────────────────
_DATABASES = ["information_schema", "mysql", "performance_schema", "sys", "nexis_hr"]
_TABLES = ["personnel", "access_log", "departments"]

_TABLE_ROWS: Dict[str, Any] = {
    "personnel":   (PERSONNEL_PUBLIC_COLUMNS, PERSONNEL_ROWS),
    "access_log":  (ACCESS_LOG_COLUMNS,      ACCESS_LOG_ROWS),
    "departments": (DEPARTMENTS_COLUMNS,     DEPARTMENTS_ROWS),
}

_SHOW_VARIABLES: Dict[str, str] = {
    "auto_increment_increment":    "1",
    "character_set_client":        "utf8mb4",
    "character_set_connection":    "utf8mb4",
    "character_set_database":      "utf8mb4",
    "character_set_server":        "utf8mb4",
    "collation_server":            "utf8mb4_0900_ai_ci",
    "datadir":                     "/var/lib/mysql/",
    "event_scheduler":             "OFF",
    "hostname":                    "nexis-db-01",
    "innodb_buffer_pool_size":     "134217728",
    "lower_case_table_names":      "0",
    "max_allowed_packet":          "67108864",
    "max_connections":             "151",
    "port":                        "3306",
    "skip_networking":             "OFF",
    "sql_mode":                    "STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION",
    "time_zone":                   "+00:00",
    "tmpdir":                      "/tmp",
    "version":                     "8.0.36-0ubuntu0.22.04.1",
    "version_comment":             "(Ubuntu)",
}


# ── helpers ───────────────────────────────────────────────────────────────────
def _one_col_one_row(col_name: str, value: Any, seq: int) -> List[bytes]:
    return build_result_set([{"name": col_name}], [[value]], seq_start=seq)


def _ok(seq: int) -> List[bytes]:
    return [build_packet(build_ok_packet(), seq_id=seq)]


def _err(code: int, msg: str, state: str, seq: int) -> List[bytes]:
    return [build_packet(build_err_packet(code, msg, state), seq_id=seq)]


def _syntax_err(query_text: str, seq: int) -> List[bytes]:
    excerpt = query_text[:80]
    return _err(1064, _err1064_msg(excerpt), "42000", seq)


def _err1064_msg(near_text: str) -> str:
    """Build the exact MySQL ERR 1064 message. Single shared function."""
    return (
        "You have an error in your SQL syntax; check the manual that corresponds "
        "to your MySQL server version for the right syntax to use near "
        f"'{near_text}' at line 1"
    )


def _unknown_table_err(table_name: str, db: str, seq: int) -> List[bytes]:
    return _err(1146, f"Table '{db}.{table_name}' doesn't exist", "42S02", seq)


def _no_db_err(seq: int) -> List[bytes]:
    return _err(1046, "No database selected", "3D000", seq)


# ── normaliser ────────────────────────────────────────────────────────────────
def _norm(s: str) -> str:
    """Lowercase, collapse whitespace, strip trailing semicolons."""
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


# ── SHOW VARIABLES LIKE pattern compiler ──────────────────────────────────────
def _like_to_pattern(like_str: str):
    """Convert a SQL LIKE pattern to a Python re pattern, anchored."""
    parts = re.split(r"([%_])", like_str)
    result = []
    for p in parts:
        if p == "%":
            result.append(".*")
        elif p == "_":
            result.append(".")
        else:
            result.append(re.escape(p))
    return re.compile("^" + "".join(result) + "$", re.IGNORECASE)


# ── table-row helpers ──────────────────────────────────────────────────────────
def _apply_where_filter(rows: List[Dict], col: str, val: str) -> List[Dict]:
    """Filter rows by exact case-insensitive string equality on one column.
    Never builds a regex or SQL from the value.
    """
    return [r for r in rows if str(r.get(col, "")).lower() == val.lower()]


def _rows_to_list(rows: List[Dict], columns: List[str]) -> List[List]:
    return [[row.get(c) for c in columns] for row in rows]


# ── db-qualification splitter ──────────────────────────────────────────────────
_DB_TABLE_RE = re.compile(r"^`?(\w+)`?\.`?(\w+)`?$")

def _split_db_table(tbl_expr: str) -> tuple:
    """Return (db, table) from 'db.table', or (None, tbl_expr)."""
    m = _DB_TABLE_RE.match(tbl_expr)
    if m:
        return m.group(1), m.group(2)
    return None, tbl_expr


# ── DESCRIBE schema builder ────────────────────────────────────────────────────
def _describe_table(table_name: str, seq: int) -> List[bytes]:
    schema = TABLE_SCHEMAS.get(table_name)
    if schema is None:
        return []  # caller handles unknown table
    cols = [
        {"name": "Field"},
        {"name": "Type"},
        {"name": "Null"},
        {"name": "Key"},
        {"name": "Default"},
        {"name": "Extra"},
    ]
    return build_result_set(cols, schema, seq_start=seq)


# ── INFORMATION_SCHEMA.TABLES result ─────────────────────────────────────────
def _information_schema_tables(seq: int) -> List[bytes]:
    cols = [
        {"name": "TABLE_CATALOG"},
        {"name": "TABLE_SCHEMA"},
        {"name": "TABLE_NAME"},
        {"name": "TABLE_TYPE"},
        {"name": "ENGINE"},
        {"name": "TABLE_ROWS", "type": FIELD_TYPE_LONGLONG},
        {"name": "TABLE_COMMENT"},
    ]
    rows = [
        ["def", "nexis_hr", "personnel",   "BASE TABLE", "InnoDB", str(len(PERSONNEL_ROWS)),   "Employee directory"],
        ["def", "nexis_hr", "access_log",  "BASE TABLE", "InnoDB", str(len(ACCESS_LOG_ROWS)),  "Physical access records"],
        ["def", "nexis_hr", "departments", "BASE TABLE", "InnoDB", str(len(DEPARTMENTS_ROWS)), "Organizational units"],
    ]
    return build_result_set(cols, rows, seq_start=seq)


# ── main dispatcher ───────────────────────────────────────────────────────────
def dispatch_query(
    query_text: str,
    ctx: "ConnectionContext",
    seq: int,
    version_string: str,
) -> List[bytes]:
    """Dispatch a COM_QUERY payload and return response packets."""
    n = _norm(query_text)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # ── mysql.user → 1142 ─────────────────────────────────────────────────────
    if "mysql.user" in n or "mysql . user" in n:
        return _err(
            1142,
            f"SELECT command denied to user '{ctx.username}'@'{ctx.peer_ip}' "
            f"for table 'user'",
            "42000", seq,
        )

    # ── SET … → OK ────────────────────────────────────────────────────────────
    if n.startswith("set "):
        return _ok(seq)

    # ── USE <db> → OK ─────────────────────────────────────────────────────────
    m = re.match(r"^use\s+(\S+)$", n)
    if m:
        db = m.group(1).strip("`'\"")
        ctx.database = db[:64]
        return _ok(seq)

    # ── SELECT expressions (no FROM needed — no ERR 1046) ────────────────────
    if n in ("select 1", "select 1 as alive", "select 1 as ping"):
        return _one_col_one_row("1", "1", seq)
    if re.match(r"^select\s+version\s*\(\s*\)$", n):
        return _one_col_one_row("VERSION()", version_string, seq)
    if re.match(r"^select\s+@@version$", n):
        return _one_col_one_row("@@version", version_string, seq)
    if re.match(r"^select\s+@@version_comment(\s+limit\s+\d+)?$", n):
        return _one_col_one_row("@@version_comment", "(Ubuntu)", seq)
    m = re.match(r"^select\s+@@(\w+)$", n)
    if m:
        var = m.group(1)
        val = _SHOW_VARIABLES.get(var, "")
        return _one_col_one_row(f"@@{var}", val, seq)
    if re.match(r"^select\s+database\s*\(\s*\)$", n):
        return _one_col_one_row("DATABASE()", ctx.database or None, seq)
    if re.match(r"^select\s+(user|current_user)\s*\(\s*\)$", n):
        return _one_col_one_row("USER()", f"{ctx.username or ''}@{ctx.peer_ip}", seq)
    if re.match(r"^select\s+connection_id\s*\(\s*\)$", n):
        cols = [{"name": "CONNECTION_ID()", "type": FIELD_TYPE_LONGLONG, "length": 20}]
        return build_result_set(cols, [[str(ctx.connection_id)]], seq_start=seq)
    if re.match(r"^select\s+now\s*\(\s*\)$", n):
        return _one_col_one_row("NOW()", now_str, seq)

    # ── SHOW DATABASES ────────────────────────────────────────────────────────
    if n in ("show databases", "show schemas"):
        return build_result_set([{"name": "Database"}], [[d] for d in _DATABASES], seq_start=seq)

    # ── SHOW TABLES [FROM db] ─────────────────────────────────────────────────
    m_st = re.match(r"^show\s+(?:full\s+)?tables(?:\s+(?:from|in)\s+`?(\w+)`?)?", n)
    if m_st:
        explicit_db = m_st.group(1)
        db_name = explicit_db or ctx.database or "nexis_hr"
        if explicit_db and explicit_db.lower() not in ("nexis_hr", "information_schema",
                                                         "mysql", "performance_schema", "sys"):
            return _err(1049, f"Unknown database '{explicit_db}'", "42000", seq)
        tbl_label = f"Tables_in_{db_name}"
        return build_result_set([{"name": tbl_label}], [[t] for t in _TABLES], seq_start=seq)

    # ── SHOW VARIABLES [LIKE …] ────────────────────────────────────────────────
    if re.match(r"^show\s+(?:global\s+|session\s+)?variables", n):
        m_like = re.search(r"\blike\s+'([^']*)'", n)
        like_pat = _like_to_pattern(m_like.group(1)) if m_like else None
        cols = [{"name": "Variable_name"}, {"name": "Value"}]
        rows = [
            [k, v] for k, v in _SHOW_VARIABLES.items()
            if like_pat is None or like_pat.match(k)
        ]
        return build_result_set(cols, rows, seq_start=seq)

    # ── SHOW GRANTS ────────────────────────────────────────────────────────────
    if re.match(r"^show\s+grants", n):
        user = ctx.username or "root"
        col_name = f"Grants for `{user}`@`%`"
        grant = f"GRANT ALL PRIVILEGES ON *.* TO `{user}`@`%` WITH GRANT OPTION"
        return build_result_set([{"name": col_name}], [[grant]], seq_start=seq)

    # ── DESCRIBE / SHOW COLUMNS ───────────────────────────────────────────────
    m_desc = re.match(
        r"^(?:describe|desc|show\s+(?:full\s+)?columns\s+(?:from|in))\s+`?(\w+)`?$", n
    )
    if m_desc:
        tbl = m_desc.group(1)
        pkts = _describe_table(tbl, seq)
        if pkts:
            return pkts
        db = ctx.database or "nexis_hr"
        return _unknown_table_err(tbl, db, seq)

    # ── information_schema.tables ─────────────────────────────────────────────
    if re.match(r"^select\s+.*\bfrom\s+`?information_schema`?\s*\.\s*`?tables`?", n):
        return _information_schema_tables(seq)

    # ── SELECT COUNT(*) FROM <table> ──────────────────────────────────────────
    m_count = re.match(r"^select\s+count\s*\(\s*\*\s*\)\s+from\s+(`?\w+`?\.)?`?(\w+)`?", n)
    if m_count:
        db_prefix = (m_count.group(1) or "").strip("`.").lower()
        tbl = m_count.group(2).lower()
        # Resolve using db-qualified prefix or ctx.database
        effective_db = db_prefix or ctx.database
        if effective_db is None:
            return _no_db_err(seq)
        if tbl in _TABLE_ROWS:
            _, rows = _TABLE_ROWS[tbl]
            return build_result_set(
                [{"name": "COUNT(*)", "type": FIELD_TYPE_LONGLONG}],
                [[str(len(rows))]],
                seq_start=seq,
            )
        return _unknown_table_err(tbl, effective_db, seq)

    # ── Generic SELECT ... FROM ... ────────────────────────────────────────────
    # Handles: SELECT */col-list FROM [db.]table [WHERE col='val'] [LIMIT n]
    m_sel = re.match(
        r"^select\s+(.*?)\s+from\s+(`?\w+`?(?:\s*\.\s*`?\w+`?)?)((?:\s+where\s+.*?)?)"
        r"((?:\s+limit\s+\d+)?)\s*$",
        n,
    )
    if m_sel:
        select_list = m_sel.group(1).strip()
        tbl_expr    = m_sel.group(2).replace(" ", "").strip()
        where_part  = m_sel.group(3).strip()
        limit_part  = m_sel.group(4).strip()

        # Resolve db and table name
        db_q, tbl = _split_db_table(tbl_expr)
        effective_db = db_q or ctx.database

        # Require a database for unqualified table refs
        if effective_db is None:
            return _no_db_err(seq)

        if tbl not in _TABLE_ROWS:
            return _unknown_table_err(tbl, effective_db, seq)

        columns, all_rows = _TABLE_ROWS[tbl]

        # Apply WHERE col='value' (single equality only)
        filtered = list(all_rows)
        if where_part:
            m_where = re.match(r"^where\s+`?(\w+)`?\s*=\s*'([^']*)'$", where_part)
            if m_where:
                col_name = m_where.group(1).lower()
                col_val  = m_where.group(2)
                filtered = _apply_where_filter(filtered, col_name, col_val)
            # Unsupported WHERE (subqueries, OR, etc.) → fall through silently
            # returning all rows is safer than crashing

        # Apply LIMIT
        limit = _extract_limit(limit_part + " " + where_part) if limit_part else len(filtered)
        filtered = filtered[:limit]

        # Resolve column list
        if select_list == "*":
            col_names = columns
        else:
            # Parse comma-separated col names, strip backticks/spaces
            col_names = [c.strip().strip("`") for c in select_list.split(",")]
            # Only include columns that actually exist
            col_names = [c for c in col_names if c in columns]
            if not col_names:
                col_names = columns  # fallback to all

        result_cols = [{"name": c} for c in col_names]
        result_rows = [[row.get(c) for c in col_names] for row in filtered]
        return build_result_set(result_cols, result_rows, seq_start=seq)

    # ── Admin DDL / DCL → OK ──────────────────────────────────────────────────
    if re.match(
        r"^(create\s+user|drop\s+user|alter\s+user|grant\b|revoke\b|"
        r"flush\s+privileges|set\s+password|create\s+(?:database|schema)|"
        r"drop\s+(?:database|schema))\b",
        n,
    ):
        return _ok(seq)

    # ── Fallthrough: ERR 1064 ──────────────────────────────────────────────────
    return _syntax_err(query_text, seq)
