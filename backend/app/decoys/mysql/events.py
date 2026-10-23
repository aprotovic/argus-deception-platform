"""MySQL decoy event builders.

Task 4 of db-decoy spec (R3.1, R3.2).

Builds SecurityEvent (+optional LoginAttempt) objects for the two event
types emitted by the MySQL decoy:

  db_connection    — one per TCP connection, logged at close.
                     severity: low  (no login attempt made)
                                low  (login failed: unknown user, no username)
                                medium (login failed: username known)
                                high   (bait credential matched)

  db_login_attempt — one per AUTH exchange (built inside handle_connection
                     before the final OK/ERR is sent so the id is known).
                     Carries a LoginAttempt child with the HMAC fingerprint.

All string fields are truncated to their ingest-model limits BEFORE creating
ORM objects so the ForwardingEventSink serialiser never rejects a value.

Severity matrix (point 5 of task-4 instructions):
  - Probe with no username (no login packet sent) → low
  - Failed login (username present, not a bait credential) → medium
  - Successful bait login → high
"""

from __future__ import annotations

import hashlib
import hmac
import os
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Dict, Optional


# Column size limits (mirror ingest.py Field(max_length=...))
_MAX_IP = 45
_MAX_METHOD = 10
_MAX_PATH = 1024
_MAX_UA = 500
_MAX_EVENT_TYPE = 50
_MAX_SEVERITY = 20
_MAX_CORR_ID = 64
_MAX_USERNAME = 255


def _truncate(value: Optional[str], limit: int) -> str:
    if not value:
        return ""
    return value[:limit]


def _fingerprint(auth_response_hex: str) -> str:
    """HMAC-SHA256 fingerprint of the hex-encoded auth response.

    Keyed with ARGUS_PASSWORD_FINGERPRINT_SECRET (from env / settings).
    Returns a 64-char hex string. Never exposes the actual response bytes.
    """
    secret = os.environ.get(
        "ARGUS_PASSWORD_FINGERPRINT_SECRET",
        "argus_hmac_fingerprint_salt_secret_change_in_prod",
    ).encode("utf-8")
    raw = auth_response_hex.encode("utf-8")
    return hmac.new(secret, raw, hashlib.sha256).hexdigest()


def build_connection_event(
    *,
    event_id: uuid.UUID,
    source_ip: str,
    source_port: Optional[int],
    username: Optional[str],
    authenticated: bool,
    has_login_attempt: bool,
    duration_seconds: float,
    bytes_in: int,
    bytes_out: int,
    correlation_id: str,
    timestamp: Optional[datetime] = None,
) -> Any:
    """Build a SecurityEvent ORM-like object for a db_connection event."""
    from app.models.security_event import SecurityEvent

    # Severity rules (point 5)
    if authenticated:
        severity = "high"
    elif has_login_attempt and username:
        severity = "medium"
    else:
        severity = "low"

    return SecurityEvent(
        id=event_id,
        timestamp=timestamp or datetime.now(timezone.utc),
        source_ip=_truncate(source_ip, _MAX_IP),
        source_port=source_port,
        http_method="SQL"[:_MAX_METHOD],
        request_path="/mysql/connect"[:_MAX_PATH],
        query_params={},
        headers_sanitized={},
        user_agent="",
        event_type="db_connection"[:_MAX_EVENT_TYPE],
        severity=severity[:_MAX_SEVERITY],
        is_test_event=False,
        correlation_id=_truncate(correlation_id, _MAX_CORR_ID),
        metadata_payload={
            "duration_seconds": round(duration_seconds, 2),
            "bytes_in": bytes_in,
            "bytes_out": bytes_out,
            "authenticated": authenticated,
            "username": _truncate(username or "", _MAX_USERNAME),
        },
    )


def build_login_attempt_event(
    *,
    event_id: uuid.UUID,
    source_ip: str,
    source_port: Optional[int],
    username: str,
    auth_response: bytes,
    authenticated: bool,
    correlation_id: str,
    timestamp: Optional[datetime] = None,
) -> tuple:
    """Build (SecurityEvent, LoginAttempt) for a db_login_attempt.

    Returns a 2-tuple: (SecurityEvent, LoginAttempt).
    The auth_response bytes are fingerprinted via HMAC; never stored raw.
    """
    from app.models.security_event import SecurityEvent
    from app.models.login_attempt import LoginAttempt

    severity = "high" if authenticated else "medium"
    ts = timestamp or datetime.now(timezone.utc)

    sec_event = SecurityEvent(
        id=event_id,
        timestamp=ts,
        source_ip=_truncate(source_ip, _MAX_IP),
        source_port=source_port,
        http_method="SQL"[:_MAX_METHOD],
        request_path="/mysql/login"[:_MAX_PATH],
        query_params={},
        headers_sanitized={},
        user_agent="",
        event_type="db_login_attempt"[:_MAX_EVENT_TYPE],
        severity=severity[:_MAX_SEVERITY],
        is_test_event=False,
        correlation_id=_truncate(correlation_id, _MAX_CORR_ID),
        metadata_payload={
            "username": _truncate(username, _MAX_USERNAME),
            "authenticated": authenticated,
            "auth_response_length": len(auth_response),
        },
    )

    fingerprint = _fingerprint(auth_response.hex())
    login_attempt = LoginAttempt(
        id=uuid.uuid4(),
        event_id=event_id,
        submitted_username=_truncate(username, _MAX_USERNAME),
        password_length=len(auth_response),
        password_hmac_fingerprint=fingerprint[:64],
        is_flagged_credential=authenticated,
        success=False,           # decoy never grants real access
        failure_reason=(
            "bait_credential_matched" if authenticated
            else "invalid_credentials_simulated"
        )[:100],
        client_ip=_truncate(source_ip, _MAX_IP),
        user_agent="",
    )

    return sec_event, login_attempt


def _serialize_for_stub(obj: Any) -> Dict[str, Any]:
    """Serialize a SecurityEvent-like object for the JSONL stub sink.

    Used only during local testing without a backend.
    """
    result: Dict[str, Any] = {}
    for attr in (
        "source_ip", "source_port", "http_method", "request_path",
        "event_type", "severity", "is_test_event", "correlation_id",
    ):
        val = getattr(obj, attr, None)
        result[attr] = str(val) if val is not None else None

    obj_id = getattr(obj, "id", None)
    result["id"] = str(obj_id) if obj_id else None

    ts = getattr(obj, "timestamp", None)
    result["timestamp"] = ts.isoformat() if isinstance(ts, datetime) else str(ts) if ts else None
    result["metadata_payload"] = getattr(obj, "metadata_payload", {})
    return result
