"""Captured evidence and file Pydantic schemas."""

from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CapturedFileResponse(BaseModel):
    id: UUID
    event_id: UUID
    original_filename_sanitized: str
    sha256_hash: str
    file_size_bytes: int
    declared_mime_type: str
    detected_mime_type: str
    quarantine_status: str
    rejection_reason: Optional[str] = None
    source_ip: str
    upload_timestamp: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvidenceListResponse(BaseModel):
    items: list[CapturedFileResponse]
    total: int
    page: int
    limit: int
    pages: int
