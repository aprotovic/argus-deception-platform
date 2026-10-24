"""MySQL query classifier for the decoy server (item 5 of query-handling milestone).

classify(query_text) -> (tag, severity)

Tags and severities:
  sqli        high   — UNION SELECT, OR 1=1, trailing "-- ", /* ... */, sleep(, benchmark(
  file_access high   — INTO OUTFILE, DUMPFILE, LOAD_FILE
  priv_esc    high   — GRANT, CREATE USER, ALTER USER, DROP USER
  destructive high   — DROP (not "DROP USER"), TRUNCATE, DELETE FROM
  recon       medium — information_schema, @@version, SHOW DATABASES/TABLES/VARIABLES,
                       SELECT USER()/CURRENT_USER()/DATABASE()/NOW()/CONNECTION_ID()
                       SELECT 1 (connectivity check), mysql.user access
  normal      medium — everything else that reached the command phase

Rules (item 5):
  - A lone ' or -- alone is NOT sqli (typo / client quirk).
  - Use multi-character patterns: "union select", "or 1=1", trailing "-- "
    (with a space), /* as a comment opener, sleep( and benchmark(.
  - Case-insensitive throughout.
  - Never execute, eval, or parse SQL. Pattern matching only.
  - Strip NUL bytes before classifying (see sanitize_query_text).

Logging safety (item 6):
  sanitize_query_text():
    - Strip NUL bytes and control characters (Postgres jsonb rejects \\u0000)
    - Redact the literal after IDENTIFIED BY, PASSWORD( and SET PASSWORD
    - Truncate to 1024 chars and flag truncation
"""

from __future__ import annotations

import re
from typing import Tuple

# ── control-char / NUL strip ─────────────────────────────────────────────────
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]")

# ── secret-literal redaction ──────────────────────────────────────────────────
# Matches:  IDENTIFIED BY 'literal', PASSWORD('literal'), SET PASSWORD = 'literal'
_REDACT_RE = re.compile(
    r"""((?:identified\s+by|password\s*\(|set\s+password\s*=\s*))\s*'[^']*'""",
    re.IGNORECASE,
)

_QUERY_TEXT_MAX = 1024


def sanitize_query_text(raw: str) -> Tuple[str, bool]:
    """Strip control chars, redact secrets, truncate to 1024 chars.

    Returns (sanitized_text, truncated_flag).
    Redaction keeps the space: "IDENTIFIED BY '[REDACTED]'".
    """
    text = _CONTROL_RE.sub("", raw)
    text = _REDACT_RE.sub(r"\1 '[REDACTED]'", text)
    truncated = len(text) > _QUERY_TEXT_MAX
    return text[:_QUERY_TEXT_MAX], truncated


# ── classification patterns ───────────────────────────────────────────────────
# Order matters: checked top-to-bottom, first match wins.

# sqli patterns (item 5 — lone ' or -- are NOT listed here)
_SQLI_PATTERNS = [
    re.compile(r"union\s+select", re.IGNORECASE),
    re.compile(r"\bor\s+1\s*=\s*1\b", re.IGNORECASE),
    re.compile(r"--\s+", re.IGNORECASE),          # trailing "-- " with space
    re.compile(r"/\*"),                            # block comment opener
    re.compile(r"\bsleep\s*\(", re.IGNORECASE),
    re.compile(r"\bbenchmark\s*\(", re.IGNORECASE),
    re.compile(r"'\s*or\s*'", re.IGNORECASE),     # ' or '1'='1
    re.compile(r"1\s*=\s*1", re.IGNORECASE),      # 1=1 anywhere
    re.compile(r"'\s*=\s*'", re.IGNORECASE),      # '='
]

# file_access
_FILE_PATTERNS = [
    re.compile(r"\binto\s+outfile\b", re.IGNORECASE),
    re.compile(r"\binto\s+dumpfile\b", re.IGNORECASE),
    re.compile(r"\bload_file\s*\(", re.IGNORECASE),
]

# priv_esc
_PRIV_PATTERNS = [
    re.compile(r"\bgrant\b", re.IGNORECASE),
    re.compile(r"\bcreate\s+user\b", re.IGNORECASE),
    re.compile(r"\balter\s+user\b", re.IGNORECASE),
    re.compile(r"\bdrop\s+user\b", re.IGNORECASE),
]

# destructive (DROP TABLE/DATABASE but not DROP USER which is priv_esc)
_DESTRUCTIVE_PATTERNS = [
    re.compile(r"\bdrop\s+(?:table|database|schema|index|view)\b", re.IGNORECASE),
    re.compile(r"\btruncate\b", re.IGNORECASE),
    re.compile(r"\bdelete\s+from\b", re.IGNORECASE),
]

# recon
_RECON_PATTERNS = [
    re.compile(r"\binformation_schema\b", re.IGNORECASE),
    re.compile(r"@@version", re.IGNORECASE),
    re.compile(r"\bshow\s+(databases|tables|variables|grants)\b", re.IGNORECASE),
    re.compile(r"\bselect\s+user\s*\(\s*\)", re.IGNORECASE),
    re.compile(r"\bselect\s+current_user\s*\(\s*\)", re.IGNORECASE),
    re.compile(r"\bselect\s+database\s*\(\s*\)", re.IGNORECASE),
    re.compile(r"\bselect\s+now\s*\(\s*\)", re.IGNORECASE),
    re.compile(r"\bselect\s+connection_id\s*\(\s*\)", re.IGNORECASE),
    re.compile(r"\bselect\s+1\b", re.IGNORECASE),
    re.compile(r"\bselect\s+version\s*\(\s*\)", re.IGNORECASE),
    re.compile(r"\bmysql\s*\.\s*user\b", re.IGNORECASE),
    re.compile(r"\bselect\s+@@", re.IGNORECASE),
]


def classify(query_text: str) -> Tuple[str, str]:
    """Classify a query and return (tag, severity).

    tag one of: sqli, file_access, priv_esc, destructive, recon, normal
    severity: high (sqli/file_access/priv_esc/destructive), medium (recon/normal)
    """
    for pat in _SQLI_PATTERNS:
        if pat.search(query_text):
            return "sqli", "high"

    for pat in _FILE_PATTERNS:
        if pat.search(query_text):
            return "file_access", "high"

    for pat in _PRIV_PATTERNS:
        if pat.search(query_text):
            return "priv_esc", "high"

    for pat in _DESTRUCTIVE_PATTERNS:
        if pat.search(query_text):
            return "destructive", "high"

    for pat in _RECON_PATTERNS:
        if pat.search(query_text):
            return "recon", "medium"

    return "normal", "medium"
