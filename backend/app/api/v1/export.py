"""Security event export router for CSV and JSON forensic reports."""

import csv
import io
import json
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, require_role
from app.core.security import extract_client_ip
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.security_event import SecurityEvent
from app.models.user import User

router = APIRouter(prefix="/export", tags=["Export & Reporting"])


@router.get("/events")
async def export_security_events(
    request: Request,
    export_format: str = Query("json", pattern="^(json|csv)$"),
    severity: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    is_test_event: Optional[bool] = Query(None),
    limit: int = Query(1000, ge=1, le=5000),
    current_user: User = Depends(require_role("admin", "analyst")),
    db: AsyncSession = Depends(get_db),
):
    """
    Exports filtered security events in CSV or JSON format.
    Every export action is recorded in the tamper-evident audit trail.
    """
    query = select(SecurityEvent).order_by(desc(SecurityEvent.timestamp)).limit(limit)

    if severity:
        query = query.where(SecurityEvent.severity == severity.lower())
    if event_type:
        query = query.where(SecurityEvent.event_type == event_type.lower())
    if is_test_event is not None:
        query = query.where(SecurityEvent.is_test_event == is_test_event)

    results = await db.execute(query)
    events = results.scalars().all()

    # Record export action in audit log
    client_ip = extract_client_ip(request)
    audit = AuditLog(
        user_id=current_user.id,
        action="EVENT_EXPORT",
        target_type="security_events",
        target_id=f"count_{len(events)}",
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent", ""),
        details={
            "format": export_format,
            "record_count": len(events),
            "filter_severity": severity,
            "filter_type": event_type,
        },
    )
    db.add(audit)
    await db.commit()

    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")

    if export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "Event ID",
                "Timestamp (UTC)",
                "Source IP",
                "HTTP Method",
                "Request Path",
                "Event Type",
                "Severity",
                "Is Test Event",
                "User Agent",
            ]
        )
        for ev in events:
            writer.writerow(
                [
                    str(ev.id),
                    ev.timestamp.isoformat(),
                    ev.source_ip,
                    ev.http_method,
                    ev.request_path,
                    ev.event_type,
                    ev.severity,
                    ev.is_test_event,
                    ev.user_agent,
                ]
            )

        csv_content = output.getvalue()
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=argus_events_{timestamp_str}.csv"
            },
        )

    # JSON export
    data = [
        {
            "id": str(ev.id),
            "timestamp": ev.timestamp.isoformat(),
            "source_ip": ev.source_ip,
            "http_method": ev.http_method,
            "request_path": ev.request_path,
            "event_type": ev.event_type,
            "severity": ev.severity,
            "is_test_event": ev.is_test_event,
            "user_agent": ev.user_agent,
            "query_params": ev.query_params,
            "metadata": ev.metadata_payload,
        }
        for ev in events
    ]

    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=argus_events_{timestamp_str}.json"
        },
    )


@router.get("/incident-report/{ip_address}")
async def export_incident_report(
    ip_address: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export a full PDF incident report for a given attacker IP address."""
    from app.core.pdf_report import generate_incident_report
    from fastapi.responses import Response as FastAPIResponse

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    stmt = (
        select(SecurityEvent)
        .where(SecurityEvent.source_ip == ip_address)
        .where(SecurityEvent.timestamp >= cutoff)
        .where(SecurityEvent.is_test_event == False)
        .order_by(SecurityEvent.timestamp)
    )
    result = await db.execute(stmt)
    events = result.scalars().all()

    # Compute threat score
    weights = {
        "recon_probe": 1, "login_attempt": 2, "file_upload": 3,
        "terminal_exec": 4, "sql_injection": 5, "honeytoken_access": 4,
        "contractor_credential_use": 5, "unauthorized_access": 2,
    }
    score = sum(weights.get(e.event_type, 1) for e in events)
    severities = {e.severity for e in events}
    if "critical" in severities:
        score += 5
    elif "high" in severities:
        score += 3
    level = (
        "critical" if score >= 25 else
        "high"     if score >= 15 else
        "medium"   if score >= 6  else
        "low"
    )

    event_dicts = [
        {
            "timestamp": e.timestamp,
            "event_type": e.event_type,
            "severity": e.severity,
            "request_path": e.request_path,
            "summary": e.metadata_payload.get("summary", ""),
        }
        for e in events
    ]

    pdf_bytes = generate_incident_report(event_dicts, ip_address, score, level)
    safe_ip = ip_address.replace(".", "_").replace(":", "_")
    filename = f"argus_incident_{safe_ip}.pdf"

    return FastAPIResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
