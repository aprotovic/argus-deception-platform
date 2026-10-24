"""Decoy Personnel Database search endpoint.

Presents a convincing fake internal employee directory to attackers.
Detects SQL injection attempts and logs security telemetry using exactly
the same patterns as the other decoy routes in decoy.py.

New file — no changes to decoy.py, main.py, config.py, models, or docker-compose.
Compatible with EventForwarderSession: only db.add() and await db.commit() are
called on the injected session.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.decoy import check_is_test, get_or_create_default_decoy
from app.core.security import extract_client_ip, sanitize_headers
from app.core.websocket_manager import ws_manager
from app.database import get_db
from app.logging_config import logger
from app.models.security_event import SecurityEvent

router = APIRouter(prefix="/decoy", tags=["Decoy Portal"])

# ============================================================================
# FAKE PERSONNEL TABLE  (module-level constant — no DB, no file, no network)
# These rows are entirely fictional. The badge_id field contains a unique
# identifier per employee that the SOC can use to detect exfiltration.
# ============================================================================
_FAKE_PERSONNEL: list[dict[str, Any]] = [
    {
        "employee_id": "NX-1001",
        "full_name": "Harrison Blake",
        "title": "Director of Enclave Operations",
        "clearance": "TS/SCI",
        "department": "Tactical Network Division",
        "email": "h.blake@defense.internal",
        "office_ext": "DSN-312-555-0101",
        "location": "Enclave VA-01 // Pentagon Annex B",
        "badge_id": "NX-7F3A-1001-B9",
    },
    {
        "employee_id": "NX-1008",
        "full_name": "Sophia Reeves",
        "title": "Cryptographic Systems Architect",
        "clearance": "TS/SCI-Q",
        "department": "Crypto Engineering",
        "email": "s.reeves@defense.internal",
        "office_ext": "DSN-312-555-0108",
        "location": "Enclave VA-01 // SCIF Lab 3",
        "badge_id": "NX-A2C8-1008-F1",
    },
    {
        "employee_id": "NX-1015",
        "full_name": "Marcus Webb",
        "title": "Satellite Link Operations Lead",
        "clearance": "SECRET",
        "department": "SATCOM Division",
        "email": "m.webb@satcom.defense.internal",
        "office_ext": "DSN-312-555-0115",
        "location": "Enclave PAC-03 // Remote Node",
        "badge_id": "NX-3D91-1015-C4",
    },
    {
        "employee_id": "NX-1022",
        "full_name": "Elena Vasquez",
        "title": "SecOps Incident Response Analyst",
        "clearance": "SECRET",
        "department": "Security Operations Center",
        "email": "e.vasquez@soc.defense.internal",
        "office_ext": "DSN-312-555-0122",
        "location": "Enclave VA-01 // SOC Floor 2",
        "badge_id": "NX-B5E0-1022-D7",
    },
    {
        "employee_id": "NX-1031",
        "full_name": "Tariq Al-Nasir",
        "title": "Zero-Trust Network Architect",
        "clearance": "TS/SCI",
        "department": "Network Security",
        "email": "t.alnasir@defense.internal",
        "office_ext": "DSN-312-555-0131",
        "location": "Enclave EU-02 // Frankfurt Node",
        "badge_id": "NX-9F12-1031-A3",
    },
    {
        "employee_id": "NX-1042",
        "full_name": "Miller Christopher",
        "title": "Lead Systems Engineer",
        "clearance": "TS/SCI",
        "department": "Infrastructure",
        "email": "c.miller@defense.internal",
        "office_ext": "DSN-312-555-0142",
        "location": "Enclave VA-01 // Server Farm B",
        "badge_id": "NX-C4B7-1042-E2",
    },
    {
        "employee_id": "NX-1058",
        "full_name": "Dana Park",
        "title": "Compliance & STIG Auditor",
        "clearance": "SECRET",
        "department": "Compliance Division",
        "email": "d.park@compliance.defense.internal",
        "office_ext": "DSN-312-555-0158",
        "location": "Enclave VA-01 // Admin Wing",
        "badge_id": "NX-E8D3-1058-61",
    },
    {
        "employee_id": "NX-1067",
        "full_name": "James Okoro",
        "title": "Hardware Security Module Engineer",
        "clearance": "TS/SCI-Q",
        "department": "Crypto Engineering",
        "email": "j.okoro@hsm.defense.internal",
        "office_ext": "DSN-312-555-0167",
        "location": "Enclave VA-01 // SCIF Lab 1",
        "badge_id": "NX-F1A6-1067-22",
    },
]

# Columns returned for normal (non-injection) queries.
# badge_id is intentionally excluded from normal results so it only
# leaks on a simulated SQLi dump, making it a useful tripwire.
_PUBLIC_COLUMNS = [
    "employee_id",
    "full_name",
    "title",
    "clearance",
    "department",
    "email",
    "office_ext",
    "location",
]

# SQL injection indicators — same set as decoy_telemetry_query in decoy.py,
# duplicated here because they are not exported from that module.
_SQLI_INDICATORS = [
    "'",
    '"',
    "--",
    "/*",
    "UNION",
    "SELECT",
    "OR 1=1",
    "OR '1'='1",
    "DROP",
    "SLEEP",
    "BENCHMARK",
    "INFORMATION_SCHEMA",
]


def _is_sqli(value: str) -> bool:
    """Returns True if value contains any known SQL injection indicator."""
    upper = value.upper()
    return any(ind in upper for ind in _SQLI_INDICATORS)


def _safe_rows_for_normal_query(q: str) -> list[dict[str, Any]]:
    """
    Filters the fake personnel table by plain case-insensitive substring match
    against name, title, department, or employee_id.
    Returns only the public columns — badge_id is never included.
    Never formats q into a query string or evaluates it.
    """
    needle = q.strip().lower()
    results = []
    for row in _FAKE_PERSONNEL:
        haystack = " ".join(
            str(row.get(col, "")).lower()
            for col in ("full_name", "title", "department", "employee_id", "location")
        )
        if needle in haystack:
            results.append({col: row[col] for col in _PUBLIC_COLUMNS})
    return results


def _leaked_rows_for_sqli() -> list[dict[str, Any]]:
    """
    Returns all columns including badge_id, simulating a full table dump
    from a successful SQL injection. Used only when SQLi is detected.
    """
    return [dict(row) for row in _FAKE_PERSONNEL]


# ============================================================================
# PERSONNEL SEARCH ENDPOINT
# ============================================================================
@router.get("/search/personnel")
async def decoy_personnel_search(
    request: Request,
    q: str = Query(default="", max_length=500),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Deceptive internal personnel directory search.

    Normal query: returns filtered rows (public columns only).
    SQLi payload:  returns all columns including badge_id values, simulating
                   a database dump, then logs a high-severity sql_injection event.

    Security guarantees:
    - q is NEVER formatted into a SQL string or evaluated.
    - Raw attacker input is truncated to 200 chars before storage.
    - badge_id values are only returned on simulated SQLi to act as tripwires.
    - No real database tables are involved; all data is the module-level constant.
    """
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = await get_or_create_default_decoy(db)

    # Sanitize before any storage — truncate, never eval
    raw_q = q.strip()
    stored_q = raw_q[:200]

    # Compute once and reuse — avoids scanning the payload twice.
    sqli = _is_sqli(raw_q)

    event_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    if sqli:
        event_type = "sql_injection"
        severity = "high"
        records = _leaked_rows_for_sqli()
        summary_msg = (
            f"SQL injection detected in personnel search from {client_ip} "
            f"(payload: '{stored_q[:60]}')"
        )
        metadata: dict[str, Any] = {
            "injected_query": stored_q,
            "simulated_engine": "PostgreSQL 16 Enterprise (STIG Enclave)",
            "table_dumped": "nx_personnel_directory",
            "badge_id_leaked": True,
        }
    else:
        event_type = "recon_probe"
        severity = "low"
        records = _safe_rows_for_normal_query(raw_q)
        summary_msg = (
            f"Decoy personnel directory search from {client_ip} "
            f"(query: '{stored_q[:40]}')"
        )
        metadata = {
            "search_query": stored_q,
            "result_count": len(records),
        }

    # -----------------------------------------------------------------------
    # DB write — ONLY db.add() and await db.commit(), compatible with
    # EventForwarderSession used in decoy_main.py after the split.
    # correlation_id capped at 64 chars (column is String(64) in the model).
    # -----------------------------------------------------------------------
    sec_event = SecurityEvent(
        id=event_id,
        decoy_service_id=decoy.id,
        timestamp=now_utc,
        source_ip=client_ip,
        source_port=request.client.port if request.client else None,
        http_method=request.method,
        request_path=str(request.url.path),
        query_params=dict(request.query_params),
        headers_sanitized=sanitize_headers(dict(request.headers)),
        user_agent=request.headers.get("user-agent", "")[:500],
        event_type=event_type,
        severity=severity,
        is_test_event=is_test,
        correlation_id=(
            request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8]
        )[:64],
        metadata_payload=metadata,
    )
    db.add(sec_event)
    await db.commit()

    # Live broadcast to SOC dashboard — same pattern as all other decoy routes
    event_summary = {
        "id": str(event_id),
        "timestamp": now_utc.isoformat(),
        "source_ip": client_ip,
        "event_type": event_type,
        "severity": severity,
        "request_path": str(request.url.path),
        "http_method": request.method,
        "user_agent": request.headers.get("user-agent", "")[:100],
        "is_test_event": is_test,
        "summary": summary_msg,
    }
    await ws_manager.broadcast_event(event_summary)

    logger.info(
        f"Decoy personnel search from {client_ip} "
        f"(type={event_type}, severity={severity})",
        extra={"event_id": str(event_id), "source_ip": client_ip, "event_type": event_type},
    )

    if sqli:
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "query": raw_q,
                "row_count": len(records),
                "records": records,
                "database_cluster": "cluster-va-pg16.internal",
                "table": "nx_personnel_directory",
            },
        )

    return JSONResponse(
        status_code=200,
        content={
            "status": "success",
            "query": raw_q,
            "row_count": len(records),
            "records": records,
            "database_cluster": "cluster-va-pg16.internal",
            "table": "nx_personnel_directory",
        },
    )
