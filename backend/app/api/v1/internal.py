"""Internal ingestion endpoint for isolated decoy containers."""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import verify_internal_ingestion_token
from app.core.websocket_manager import ws_manager
from app.database import get_db
from app.models.security_event import SecurityEvent
from app.schemas.event import SecurityEventCreate

router = APIRouter(prefix="/internal", tags=["Internal Container Ingestion"])


@router.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_internal_event(
    event_in: SecurityEventCreate,
    _: None = Depends(verify_internal_ingestion_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Ingests security events forwarded from an isolated decoy container.
    Requires mutual INTERNAL_INGESTION_TOKEN authentication.
    """
    event_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    sec_event = SecurityEvent(
        id=event_id,
        decoy_service_id=event_in.decoy_service_id,
        timestamp=event_in.timestamp or now_utc,
        source_ip=event_in.source_ip,
        source_port=event_in.source_port,
        http_method=event_in.http_method,
        request_path=event_in.request_path,
        query_params=event_in.query_params,
        headers_sanitized=event_in.headers_sanitized,
        user_agent=event_in.user_agent,
        event_type=event_in.event_type,
        severity=event_in.severity,
        is_test_event=event_in.is_test_event,
        correlation_id=event_in.correlation_id,
        metadata_payload=event_in.metadata_payload,
    )
    db.add(sec_event)
    await db.commit()

    # Broadcast to connected dashboards
    summary = {
        "id": str(event_id),
        "timestamp": sec_event.timestamp.isoformat(),
        "source_ip": sec_event.source_ip,
        "event_type": sec_event.event_type,
        "severity": sec_event.severity,
        "request_path": sec_event.request_path,
        "http_method": sec_event.http_method,
        "user_agent": sec_event.user_agent[:100],
        "is_test_event": sec_event.is_test_event,
        "summary": f"Decoy interaction on {sec_event.request_path}",
    }
    await ws_manager.broadcast_event(summary)

    return {"status": "ingested", "event_id": str(event_id)}
