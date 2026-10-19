"""Evidence management and quarantined artifact download router."""

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, require_role
from app.core.quarantine import is_safe_quarantine_path
from app.core.security import extract_client_ip
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.captured_file import CapturedFile
from app.models.user import User
from app.schemas.evidence import CapturedFileResponse, EvidenceListResponse

router = APIRouter(prefix="/evidence", tags=["Evidence Management"])


@router.get("", response_model=EvidenceListResponse)
async def list_quarantined_evidence(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    quarantine_status: Optional[str] = Query(None),
    source_ip: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all captured quarantined payloads and verification hashes."""
    query = select(CapturedFile).order_by(desc(CapturedFile.upload_timestamp))
    count_query = select(func.count(CapturedFile.id))

    if quarantine_status:
        query = query.where(CapturedFile.quarantine_status == quarantine_status.lower())
        count_query = count_query.where(CapturedFile.quarantine_status == quarantine_status.lower())

    if source_ip:
        query = query.where(CapturedFile.source_ip == source_ip.strip())
        count_query = count_query.where(CapturedFile.source_ip == source_ip.strip())

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    results = await db.execute(query)
    files = results.scalars().all()

    pages = (total + limit - 1) // limit if total > 0 else 1

    return EvidenceListResponse(
        items=[CapturedFileResponse.model_validate(f) for f in files],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/{evidence_id}/download")
async def download_quarantined_evidence(
    evidence_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Safely retrieves a quarantined payload.
    CRITICAL SECURITY CONTROLS:
    - Restricted exclusively to users with 'admin' role.
    - Path traversal strictly verified.
    - Downloads logged to tamper-evident audit trail.
    - Content-Disposition forces safe attachment without browser execution.
    """
    stmt = select(CapturedFile).where(CapturedFile.id == evidence_id)
    result = await db.execute(stmt)
    evidence = result.scalar_one_or_none()

    if not evidence or not evidence.internal_storage_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quarantined evidence record not found",
        )

    file_path = Path(evidence.internal_storage_path)

    # Path traversal validation
    if not is_safe_quarantine_path(str(file_path)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File path validation failed: artifact is outside quarantine boundary",
        )

    client_ip = extract_client_ip(request)
    user_agent = request.headers.get("user-agent", "")

    # Record tamper-evident audit log entry
    audit = AuditLog(
        user_id=current_user.id,
        action="EVIDENCE_DOWNLOAD",
        target_type="captured_file",
        target_id=str(evidence.id),
        ip_address=client_ip,
        user_agent=user_agent,
        details={
            "sha256": evidence.sha256_hash,
            "original_filename": evidence.original_filename_sanitized,
            "file_size": evidence.file_size_bytes,
        },
    )
    db.add(audit)
    await db.commit()

    safe_download_name = f"evidence_{evidence.sha256_hash[:12]}_{evidence.original_filename_sanitized}"

    return FileResponse(
        path=str(file_path),
        filename=safe_download_name,
        media_type="application/octet-stream",
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'",
            "X-Evidence-SHA256": evidence.sha256_hash,
        },
    )
