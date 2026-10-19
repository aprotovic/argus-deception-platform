"""Audit trail query endpoints for compliance and forensic verification."""

from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import require_role
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(prefix="/audit-logs", tags=["Audit Trail"])


class AuditLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    action: str
    target_type: str
    target_id: str
    ip_address: str
    user_agent: str
    details: Dict[str, Any]
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    limit: int
    pages: int


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    action: Optional[str] = Query(None),
    current_user: User = Depends(require_role("admin", "auditor")),
    db: AsyncSession = Depends(get_db),
):
    """Returns an immutable record of administrative actions, evidence access, and exports."""
    query = select(AuditLog).order_by(desc(AuditLog.timestamp))
    count_query = select(func.count(AuditLog.id))

    if action:
        query = query.where(AuditLog.action == action.upper())
        count_query = count_query.where(AuditLog.action == action.upper())

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    results = await db.execute(query)
    logs = results.scalars().all()

    pages = (total + limit - 1) // limit if total > 0 else 1

    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )
