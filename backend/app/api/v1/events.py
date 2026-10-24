"""Security event querying, filtering, and investigation endpoints."""

import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_user
from app.database import get_db
from app.models.security_event import SecurityEvent
from app.models.user import User
from app.core.mitre import get_mitre
from app.schemas.event import (
    EventListResponse,
    SecurityEventDetailResponse,
    SecurityEventResponse,
)

router = APIRouter(prefix="/events", tags=["Security Events"])


@router.get("", response_model=EventListResponse)
async def list_security_events(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    severity: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    source_ip: Optional[str] = Query(None),
    is_test_event: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a paginated list of observed security events with comprehensive filtering.
    Clearly allows distinguishing genuine observed events from test suite events.
    """
    query = (
        select(SecurityEvent)
        .options(
            selectinload(SecurityEvent.login_attempt),
            selectinload(SecurityEvent.captured_file),
        )
        .order_by(desc(SecurityEvent.timestamp))
    )

    count_query = select(func.count(SecurityEvent.id))

    # Apply filters
    if severity:
        query = query.where(SecurityEvent.severity == severity.lower())
        count_query = count_query.where(SecurityEvent.severity == severity.lower())

    if event_type:
        query = query.where(SecurityEvent.event_type == event_type.lower())
        count_query = count_query.where(SecurityEvent.event_type == event_type.lower())

    if source_ip:
        query = query.where(SecurityEvent.source_ip == source_ip.strip())
        count_query = count_query.where(SecurityEvent.source_ip == source_ip.strip())

    if is_test_event is not None:
        query = query.where(SecurityEvent.is_test_event == is_test_event)
        count_query = count_query.where(SecurityEvent.is_test_event == is_test_event)

    if start_date:
        query = query.where(SecurityEvent.timestamp >= start_date)
        count_query = count_query.where(SecurityEvent.timestamp >= start_date)

    if end_date:
        query = query.where(SecurityEvent.timestamp <= end_date)
        count_query = count_query.where(SecurityEvent.timestamp <= end_date)

    if search:
        search_term = f"%{search.strip()}%"
        search_filter = or_(
            SecurityEvent.source_ip.ilike(search_term),
            SecurityEvent.request_path.ilike(search_term),
            SecurityEvent.user_agent.ilike(search_term),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Apply pagination
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    results = await db.execute(query)
    events = results.scalars().all()

    pages = (total + limit - 1) // limit if total > 0 else 1

    def _enrich(ev):
        r = SecurityEventResponse.model_validate(ev)
        r.mitre_attack = get_mitre(ev.event_type)
        return r

    return EventListResponse(
        items=[_enrich(e) for e in events],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/{event_id}", response_model=SecurityEventDetailResponse)
async def get_security_event_detail(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns full investigation metadata for a specific security event,
    along with correlated events observed from the same source IP.
    """
    stmt = (
        select(SecurityEvent)
        .options(
            selectinload(SecurityEvent.login_attempt),
            selectinload(SecurityEvent.captured_file),
        )
        .where(SecurityEvent.id == event_id)
    )
    result = await db.execute(stmt)
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Security event not found",
        )

    # Fetch correlated events from the same source IP (excluding this event)
    corr_stmt = (
        select(SecurityEvent)
        .options(
            selectinload(SecurityEvent.login_attempt),
            selectinload(SecurityEvent.captured_file),
        )
        .where(SecurityEvent.source_ip == event.source_ip)
        .where(SecurityEvent.id != event.id)
        .order_by(desc(SecurityEvent.timestamp))
        .limit(10)
    )
    corr_results = await db.execute(corr_stmt)
    correlated = corr_results.scalars().all()

    def _enrich(ev):
        r = SecurityEventResponse.model_validate(ev)
        r.mitre_attack = get_mitre(ev.event_type)
        return r

    base_response = _enrich(event)
    return SecurityEventDetailResponse(
        **base_response.model_dump(),
        correlated_events=[_enrich(c) for c in correlated],
    )
