"""Integration tests for Decoy honeypot endpoints."""

import hashlib
import io
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.captured_file import CapturedFile
from app.models.login_attempt import LoginAttempt
from app.models.security_event import SecurityEvent


@pytest.mark.asyncio
async def test_decoy_login_records_telemetry_without_plaintext_password(
    client: AsyncClient, db_session: AsyncSession
):
    """
    Verifies decoy login:
    - Returns 401 Unauthorized
    - Records security_event with event_type 'login_attempt'
    - Records login_attempt with password length and HMAC fingerprint
    - Plaintext password NEVER exists in database
    """
    raw_password = "P@ssword123SuperSecret"
    username = "admin"

    response = await client.post(
        "/api/v1/decoy/auth/login",
        data={"username": username, "password": raw_password},
        headers={"User-Agent": "TestAttackerScanner/1.0", "X-Argus-Test-Token": "test"},
    )

    assert response.status_code == 401
    data = response.json()
    assert data["status"] == "error"
    assert "request_id" in data

    # Verify database persistence
    stmt = (
        select(SecurityEvent, LoginAttempt)
        .join(LoginAttempt, SecurityEvent.id == LoginAttempt.event_id)
        .where(LoginAttempt.submitted_username == username)
    )
    result = await db_session.execute(stmt)
    row = result.first()

    assert row is not None
    sec_event, login_attempt = row

    assert sec_event.event_type == "login_attempt"
    assert sec_event.is_test_event is True
    assert sec_event.severity == "high"  # targeting 'admin'

    # Plaintext Password Invariant Verification
    assert login_attempt.password_length == len(raw_password)
    assert len(login_attempt.password_hmac_fingerprint) == 64
    assert raw_password not in login_attempt.password_hmac_fingerprint
    assert login_attempt.success is False


@pytest.mark.asyncio
async def test_decoy_safe_file_upload_quarantine_and_hashing(
    client: AsyncClient, db_session: AsyncSession
):
    """
    Verifies file upload to decoy:
    - Quarantines file with UUID filename
    - Verifies SHA-256 hash
    - Persists CapturedFile record linked to SecurityEvent
    """
    file_bytes = b"Suspicious exploit script payload simulation.\n#!/bin/sh\necho compromised"
    expected_hash = hashlib.sha256(file_bytes).hexdigest()

    files = {"file": ("exploit_test.sh", io.BytesIO(file_bytes), "text/x-shellscript")}
    response = await client.post(
        "/api/v1/decoy/upload/diagnostics",
        files=files,
        headers={"X-Argus-Test-Token": "test"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["artifact_hash"] == expected_hash

    # Verify database persistence
    stmt = select(CapturedFile).where(CapturedFile.sha256_hash == expected_hash)
    result = await db_session.execute(stmt)
    captured = result.scalar_one_or_none()

    assert captured is not None
    assert captured.original_filename_sanitized == "exploit_test.sh"
    assert captured.file_size_bytes == len(file_bytes)
    assert captured.quarantine_status == "quarantined"
    assert captured.detected_mime_type == "text/x-shellscript"


@pytest.mark.asyncio
async def test_decoy_scanner_probe_trap(client: AsyncClient, db_session: AsyncSession):
    """Verifies that scanner probes targeting .env are trapped and logged."""
    response = await client.get(
        "/api/v1/decoy/probe/.env",
        headers={"User-Agent": "Masscan/1.3", "X-Argus-Test-Token": "test"},
    )

    assert response.status_code == 404
    data = response.json()
    assert data["status"] == "error"

    # Verify security event logged with high severity
    stmt = (
        select(SecurityEvent)
        .where(SecurityEvent.request_path == "/.env")
        .where(SecurityEvent.event_type == "recon_probe")
    )
    result = await db_session.execute(stmt)
    event = result.scalar_one_or_none()

    assert event is not None
    assert event.severity == "high"
    assert event.is_test_event is True
