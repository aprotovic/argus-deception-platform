"""Security event Pydantic schemas."""

from datetime import datetime
from uuid import UUID
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.evidence import CapturedFileResponse


class LoginAttemptResponse(BaseModel):
    id: UUID
    event_id: UUID
    submitted_username: str
    password_length: int
    password_hmac_fingerprint: str
    is_flagged_credential: bool
    success: bool
    failure_reason: str
    client_ip: str
    user_agent: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SecurityEventBase(BaseModel):
    timestamp: datetime
    source_ip: str
    source_port: Optional[int] = None
    http_method: str
    request_path: str
    query_params: Dict[str, Any] = Field(default_factory=dict)
    headers_sanitized: Dict[str, Any] = Field(default_factory=dict)
    user_agent: str = ""
    event_type: str  # login_attempt, file_upload, recon_probe, unauthorized_access, malformed_request
    severity: str = "low"  # low, medium, high, critical
    is_test_event: bool = False
    correlation_id: Optional[str] = None
    metadata_payload: Dict[str, Any] = Field(default_factory=dict)


class SecurityEventCreate(SecurityEventBase):
    decoy_service_id: Optional[UUID] = None


class SecurityEventResponse(SecurityEventBase):
    id: UUID
    decoy_service_id: Optional[UUID] = None
    created_at: datetime
    login_attempt: Optional[LoginAttemptResponse] = None
    captured_file: Optional[CapturedFileResponse] = None
    mitre_attack: Optional[Dict[str, str]] = None

    model_config = ConfigDict(from_attributes=True)


class SecurityEventDetailResponse(SecurityEventResponse):
    correlated_events: List[SecurityEventResponse] = Field(default_factory=list)


class EventListResponse(BaseModel):
    items: List[SecurityEventResponse]
    total: int
    page: int
    limit: int
    pages: int
