"""Integration tests for Dashboard management, RBAC, evidence custody, and exports."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog
from app.models.captured_file import CapturedFile


@pytest.mark.asyncio
async def test_dashboard_auth_login_success_and_failure(client: AsyncClient):
    # 1. Invalid login
    res_bad = await client.post(
        "/api/v1/auth/login",
        json={"username": "test_admin", "password": "WrongPassword!"},
    )
    assert res_bad.status_code == 401

    # 2. Valid login
    res_good = await client.post(
        "/api/v1/auth/login",
        json={"username": "test_admin", "password": "AdminPass123!"},
    )
    assert res_good.status_code == 200
    token_data = res_good.json()
    assert "access_token" in token_data
    assert token_data["role"] == "admin"


@pytest.mark.asyncio
async def test_dashboard_metrics_and_events_listing(client: AsyncClient):
    # Log in as test_analyst
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"username": "test_analyst", "password": "AnalystPass123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Query Metrics
    metrics_res = await client.get("/api/v1/overview/metrics", headers=headers)
    assert metrics_res.status_code == 200
    metrics = metrics_res.json()
    assert "total_events" in metrics
    assert "unique_ips" in metrics
    assert "events_by_severity" in metrics

    # 2. Query Events
    events_res = await client.get("/api/v1/events?limit=10", headers=headers)
    assert events_res.status_code == 200
    events_data = events_res.json()
    assert "items" in events_data
    assert "total" in events_data
    assert isinstance(events_data["items"], list)


@pytest.mark.asyncio
async def test_evidence_download_rbac_and_audit_logging(
    client: AsyncClient, db_session: AsyncSession
):
    # 1. Get tokens
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"username": "test_admin", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]

    analyst_login = await client.post(
        "/api/v1/auth/login",
        json={"username": "test_analyst", "password": "AnalystPass123!"},
    )
    analyst_token = analyst_login.json()["access_token"]

    # 2. Upload test evidence file
    upload_res = await client.post(
        "/api/v1/decoy/upload/diagnostics",
        files={"file": ("target_dump.bin", b"DATA_FOR_RBAC_TEST", "application/octet-stream")},
    )
    assert upload_res.status_code == 200
    file_hash = upload_res.json()["artifact_hash"]

    # Retrieve evidence ID
    stmt = select(CapturedFile).where(CapturedFile.sha256_hash == file_hash)
    result = await db_session.execute(stmt)
    evidence_record = result.scalar_one()

    # 3. Analyst attempts download -> 403 Forbidden (RBAC test)
    analyst_download = await client.get(
        f"/api/v1/evidence/{evidence_record.id}/download",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert analyst_download.status_code == 403

    # 4. Admin downloads -> 200 OK
    admin_download = await client.get(
        f"/api/v1/evidence/{evidence_record.id}/download",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_download.status_code == 200
    assert admin_download.content == b"DATA_FOR_RBAC_TEST"

    # 5. Verify audit log entry exists
    audit_stmt = (
        select(AuditLog)
        .where(AuditLog.action == "EVIDENCE_DOWNLOAD")
        .where(AuditLog.target_id == str(evidence_record.id))
    )
    audit_res = await db_session.execute(audit_stmt)
    audit_log = audit_res.scalar_one_or_none()
    assert audit_log is not None
    assert audit_log.details["sha256"] == file_hash
