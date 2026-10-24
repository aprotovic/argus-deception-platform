"""Pydantic models for batch ingestion from isolated decoy containers.

Task 5 of the decoy-split spec (R3.2–R3.5).

Every string field has max_length matching the corresponding DB column
so oversized payloads are rejected with 422 before touching the database.
event.id is REQUIRED — the decoy generates it once and reuses it on retry.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class IngestEventModel(BaseModel):
    """SecurityEvent fields as sent by the decoy. id is REQUIRED."""

    id: UUID
    decoy_service_id: Optional[UUID] = None
    timestamp: datetime
    source_ip: str = Field(max_length=45)
    source_port: Optional[int] = None
    http_method: str = Field(max_length=10)
    request_path: str = Field(max_length=1024)
    query_params: Dict[str, Any] = Field(default_factory=dict)
    headers_sanitized: Dict[str, Any] = Field(default_factory=dict)
    user_agent: str = Field(default="", max_length=500)
    event_type: str = Field(max_length=50)
    severity: str = Field(default="low", max_length=20)
    is_test_event: bool = False
    correlation_id: Optional[str] = Field(default=None, max_length=64)
    metadata_payload: Dict[str, Any] = Field(default_factory=dict)


class IngestLoginAttemptModel(BaseModel):
    """LoginAttempt fields as sent by the decoy. id and event_id are REQUIRED."""

    id: UUID
    event_id: UUID
    submitted_username: str = Field(max_length=255)
    password_length: int
    password_hmac_fingerprint: str = Field(max_length=64)
    is_flagged_credential: bool = False
    success: bool = False
    failure_reason: str = Field(default="invalid_credentials_simulated", max_length=100)
    client_ip: str = Field(max_length=45)
    user_agent: str = Field(default="", max_length=500)


class IngestCapturedFileModel(BaseModel):
    """CapturedFile fields as sent by the decoy. id and event_id are REQUIRED."""

    id: UUID
    event_id: UUID
    original_filename_sanitized: str = Field(max_length=255)
    internal_storage_path: str = Field(max_length=512)
    sha256_hash: str = Field(max_length=64)
    file_size_bytes: int
    declared_mime_type: str = Field(default="application/octet-stream", max_length=100)
    detected_mime_type: str = Field(default="unknown", max_length=100)
    quarantine_status: str = Field(default="quarantined", max_length=30)
    rejection_reason: Optional[str] = Field(default=None, max_length=255)
    source_ip: str = Field(max_length=45)
    upload_timestamp: datetime


class IngestEventItem(BaseModel):
    """One event with its optional child records, linked by event_id."""

    event: IngestEventModel
    login_attempt: Optional[IngestLoginAttemptModel] = None
    captured_file: Optional[IngestCapturedFileModel] = None


class IngestBatchRequest(BaseModel):
    """Batch of events from the decoy. Max 100 events per batch."""

    events: List[IngestEventItem] = Field(..., max_length=100)
