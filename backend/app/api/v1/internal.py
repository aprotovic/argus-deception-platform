"""Internal ingestion endpoints for isolated decoy containers."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import verify_internal_ingestion_token
import asyncio
from app.config import settings
from app.core.alerts import send_telegram_alert
from app.core.websocket_manager import ws_manager
from app.database import get_db
from app.models.captured_file import CapturedFile
from app.models.decoy_service import DecoyService
from app.models.login_attempt import LoginAttempt
from app.models.security_event import SecurityEvent
from app.schemas.event import SecurityEventCreate
from app.schemas.ingest import IngestBatchRequest, IngestEventItem

router = APIRouter(prefix="/internal", tags=["Internal Container Ingestion"])


# ---------------------------------------------------------------------------
# Shared broadcast helper (used by both /ingest and /ingest-batch)
# ---------------------------------------------------------------------------
def _build_event_summary(event: SecurityEvent) -> dict:
    """Builds the WebSocket broadcast summary for a persisted SecurityEvent."""
    return {
        "id": str(event.id),
        "timestamp": event.timestamp.isoformat(),
        "source_ip": event.source_ip,
        "event_type": event.event_type,
        "severity": event.severity,
        "request_path": event.request_path,
        "http_method": event.http_method,
        "user_agent": (event.user_agent or "")[:100],
        "is_test_event": event.is_test_event,
        "summary": f"Decoy interaction on {event.request_path}",
    }


# ---------------------------------------------------------------------------
# Existing single-event ingest endpoint (unchanged)
# ---------------------------------------------------------------------------
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

    await ws_manager.broadcast_event(_build_event_summary(sec_event))

    return {"status": "ingested", "event_id": str(event_id)}


# ---------------------------------------------------------------------------
# Batch ingest endpoint
# ---------------------------------------------------------------------------
async def _ensure_default_decoy(db: AsyncSession) -> uuid.UUID:
    """Ensure the default DecoyService exists. Return its fixed id.

    Created on first ingest if missing. Committed in its own
    transaction so it survives even if the batch commit later fails.
    """
    default_id = uuid.UUID(settings.DEFAULT_DECOY_ID)
    stmt = select(DecoyService).where(DecoyService.id == default_id)
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        decoy = DecoyService(
            id=default_id,
            name="Nexis Defense Core Portal",
            portal_type="defense_contractor_portal",
            description="Operational access portal for simulated defense contractor",
            port=8080,
            banner_title="Nexis Cloud Infrastructure & Defense Systems",
            config_metadata={"theme": "dark_tactical", "version": "4.2.1-sec"},
            is_active=True,
        )
        db.add(decoy)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()

    meridian_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    stmt_meridian = select(DecoyService).where(DecoyService.id == meridian_id)
    result_meridian = await db.execute(stmt_meridian)
    if not result_meridian.scalar_one_or_none():
        meridian_decoy = DecoyService(
            id=meridian_id,
            name="Meridian Trust Bank Portal",
            portal_type="online_banking_portal",
            description="Fictional retail bank honeypot for credential and upload telemetry",
            port=8080,
            banner_title="Meridian Trust Bank",
            config_metadata={"theme": "bank_navy_teal", "version": "2.1.0", "brand": "meridian_trust_bank"},
            is_active=True,
        )
        db.add(meridian_decoy)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()

    return default_id


def _build_orm_objects(item: IngestEventItem, default_decoy_id: uuid.UUID) -> list:
    """Build ORM objects from a Pydantic IngestEventItem.

    Returns [SecurityEvent, (LoginAttempt), (CapturedFile)].
    decoy_service_id defaults to DEFAULT_DECOY_ID if not provided.
    """
    ev = item.event
    decoy_service_id = ev.decoy_service_id or default_decoy_id

    sec_event = SecurityEvent(
        id=ev.id,
        decoy_service_id=decoy_service_id,
        timestamp=ev.timestamp,
        source_ip=ev.source_ip,
        source_port=ev.source_port,
        http_method=ev.http_method,
        request_path=ev.request_path,
        query_params=ev.query_params,
        headers_sanitized=ev.headers_sanitized,
        user_agent=ev.user_agent,
        event_type=ev.event_type,
        severity=ev.severity,
        is_test_event=ev.is_test_event,
        correlation_id=ev.correlation_id,
        metadata_payload=ev.metadata_payload,
    )
    objects = [sec_event]

    if item.login_attempt:
        la = item.login_attempt
        objects.append(
            LoginAttempt(
                id=la.id,
                event_id=la.event_id,
                submitted_username=la.submitted_username,
                password_length=la.password_length,
                password_hmac_fingerprint=la.password_hmac_fingerprint,
                is_flagged_credential=la.is_flagged_credential,
                success=la.success,
                failure_reason=la.failure_reason,
                client_ip=la.client_ip,
                user_agent=la.user_agent,
            )
        )

    if item.captured_file:
        cf = item.captured_file
        objects.append(
            CapturedFile(
                id=cf.id,
                event_id=cf.event_id,
                original_filename_sanitized=cf.original_filename_sanitized,
                internal_storage_path=cf.internal_storage_path,
                sha256_hash=cf.sha256_hash,
                file_size_bytes=cf.file_size_bytes,
                declared_mime_type=cf.declared_mime_type,
                detected_mime_type=cf.detected_mime_type,
                quarantine_status=cf.quarantine_status,
                rejection_reason=cf.rejection_reason,
                source_ip=cf.source_ip,
                upload_timestamp=cf.upload_timestamp,
            )
        )

    return objects


@router.post("/ingest-batch", status_code=status.HTTP_200_OK)
async def ingest_batch(
    batch: IngestBatchRequest,
    _: None = Depends(verify_internal_ingestion_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Batch ingest security events from an isolated decoy container.

    Idempotent per event id: a repeated event is ignored without error.
    Duplicate events skip their child records and are not broadcast.
    Token checked via hmac.compare_digest.
    Max 100 events per batch. Default DecoyService created on first ingest.
    """
    # 1. Ensure default decoy exists (own transaction)
    default_decoy_id = await _ensure_default_decoy(db)

    # 2. Dedupe ids inside the batch
    seen_ids: set[uuid.UUID] = set()
    unique_items: list[IngestEventItem] = []
    for item in batch.events:
        if item.event.id not in seen_ids:
            seen_ids.add(item.event.id)
            unique_items.append(item)
    intra_batch_dups = len(batch.events) - len(unique_items)

    # 3. Query existing ids in DB (race-safe idempotency check)
    existing_ids: set[uuid.UUID] = set()
    if seen_ids:
        existing_stmt = select(SecurityEvent.id).where(SecurityEvent.id.in_(seen_ids))
        existing_result = await db.execute(existing_stmt)
        existing_ids = {row[0] for row in existing_result.all()}

    # 4. Filter to new items only
    new_items = [item for item in unique_items if item.event.id not in existing_ids]
    duplicates = len(unique_items) - len(new_items) + intra_batch_dups

    if not new_items:
        return {"accepted": 0, "duplicates": duplicates}

    # 5. Try batch insert
    for item in new_items:
        for obj in _build_orm_objects(item, default_decoy_id):
            db.add(obj)

    try:
        await db.commit()
        accepted = len(new_items)
        # Broadcast only for newly inserted events
        for item in new_items:
            sec_event = SecurityEvent(
                id=item.event.id,
                timestamp=item.event.timestamp,
                source_ip=item.event.source_ip,
                event_type=item.event.event_type,
                severity=item.event.severity,
                request_path=item.event.request_path,
                http_method=item.event.http_method,
                user_agent=item.event.user_agent,
                is_test_event=item.event.is_test_event,
            )
            await ws_manager.broadcast_event(_build_event_summary(sec_event))
    except IntegrityError:
        await db.rollback()
        # Per-event fallback (handles race condition: another request
        # inserted the same id between our SELECT and INSERT)
        accepted = 0
        for item in new_items:
            objects = _build_orm_objects(item, default_decoy_id)
            for obj in objects:
                db.add(obj)
            try:
                await db.commit()
                accepted += 1
                await ws_manager.broadcast_event(_build_event_summary(objects[0]))
            except IntegrityError:
                await db.rollback()
                duplicates += 1

    return {"accepted": accepted, "duplicates": duplicates}
