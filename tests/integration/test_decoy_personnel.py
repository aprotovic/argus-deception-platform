"""Integration tests for the decoy personnel directory search endpoint.

Follows the exact style of tests/integration/test_decoy_endpoints.py:
- @pytest.mark.asyncio
- client + db_session fixtures from conftest.py
- Verify HTTP response, then verify SecurityEvent row in DB.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.security_event import SecurityEvent


@pytest.mark.asyncio
async def test_personnel_clean_query_returns_filtered_rows_and_logs_recon_probe(
    client: AsyncClient, db_session: AsyncSession
):
    """
    A clean substring query:
    - Returns 200 with matching rows.
    - Filtered rows contain only public columns (no badge_id).
    - Logs a SecurityEvent with event_type 'recon_probe', severity 'low'.
    - is_test_event is True (X-Argus-Test-Token header present).
    """
    response = await client.get(
        "/api/v1/decoy/search/personnel",
        params={"q": "crypto"},
        headers={"X-Argus-Test-Token": "test", "User-Agent": "TestScanner/1.0"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"

    # Must return at least one row matching "crypto" in title/department
    assert data["row_count"] >= 1
    assert len(data["records"]) == data["row_count"]

    # Public columns present in every returned row
    for row in data["records"]:
        assert "employee_id" in row
        assert "full_name" in row
        assert "clearance" in row
        assert "email" in row
        # badge_id must NEVER appear in a normal query response
        assert "badge_id" not in row

    # The word "canary" must not appear anywhere in the response
    assert "canary" not in response.text.lower()

    # Real secrets / admin data must not leak
    response_text = response.text
    assert "SECRET_KEY" not in response_text
    assert "DATABASE_URL" not in response_text
    assert "INTERNAL_INGESTION_TOKEN" not in response_text

    # Verify SecurityEvent persisted with correct classification
    stmt = (
        select(SecurityEvent)
        .where(SecurityEvent.request_path == "/api/v1/decoy/search/personnel")
        .where(SecurityEvent.event_type == "recon_probe")
        .order_by(SecurityEvent.timestamp.desc())
    )
    result = await db_session.execute(stmt)
    event = result.scalars().first()

    assert event is not None
    assert event.severity == "low"
    assert event.is_test_event is True
    assert event.metadata_payload.get("search_query") == "crypto"


@pytest.mark.asyncio
async def test_personnel_empty_query_returns_all_public_rows(
    client: AsyncClient, db_session: AsyncSession
):
    """
    An empty query string matches everything (substring '' is in any string).
    Returns all rows without badge_id and logs recon_probe.
    """
    response = await client.get(
        "/api/v1/decoy/search/personnel",
        params={"q": ""},
        headers={"X-Argus-Test-Token": "test"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["row_count"] == 8  # all 8 fake rows
    for row in data["records"]:
        assert "badge_id" not in row

    assert "canary" not in response.text.lower()

    stmt = (
        select(SecurityEvent)
        .where(SecurityEvent.request_path == "/api/v1/decoy/search/personnel")
        .where(SecurityEvent.event_type == "recon_probe")
        .order_by(SecurityEvent.timestamp.desc())
    )
    result = await db_session.execute(stmt)
    event = result.scalars().first()
    assert event is not None
    assert event.severity == "low"


@pytest.mark.asyncio
async def test_personnel_no_match_returns_empty_list(
    client: AsyncClient, db_session: AsyncSession
):
    """
    A clean query with no matching rows returns an empty list, not an error.
    Still logs a recon_probe event.
    """
    response = await client.get(
        "/api/v1/decoy/search/personnel",
        params={"q": "zzz_no_such_person_xyz"},
        headers={"X-Argus-Test-Token": "test"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["row_count"] == 0
    assert data["records"] == []

    stmt = (
        select(SecurityEvent)
        .where(SecurityEvent.request_path == "/api/v1/decoy/search/personnel")
        .where(SecurityEvent.event_type == "recon_probe")
        .order_by(SecurityEvent.timestamp.desc())
    )
    result = await db_session.execute(stmt)
    event = result.scalars().first()
    assert event is not None


@pytest.mark.asyncio
async def test_personnel_sqli_payload_logs_sql_injection_and_leaks_badge_ids(
    client: AsyncClient, db_session: AsyncSession
):
    """
    A SQL injection payload:
    - Logs SecurityEvent with event_type 'sql_injection', severity 'high'.
    - Response simulates a full table dump including badge_id values.
    - The word 'canary' does not appear in the response.
    - The 'note' field is not present in the response.
    - Raw injected payload is stored truncated (<=200 chars) in metadata_payload,
      never evaluated or echoed as executable SQL.
    - is_test_event is True.
    """
    sqli_payload = "' OR '1'='1' --"

    response = await client.get(
        "/api/v1/decoy/search/personnel",
        params={"q": sqli_payload},
        headers={"X-Argus-Test-Token": "test", "User-Agent": "sqlmap/1.7"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"

    # Full dump returned — all 8 rows
    assert data["row_count"] == 8

    # badge_id MUST appear in the leaked rows (tripwire working)
    assert any("badge_id" in row for row in data["records"])
    # Every leaked row has a badge_id in the NX-XXXX-NNNN-XX format
    for row in data["records"]:
        assert "badge_id" in row
        assert row["badge_id"].startswith("NX-")

    # The word "canary" must NOT appear anywhere in the response
    assert "canary" not in response.text.lower()

    # The "note" field must not be present (removed per spec)
    assert "note" not in data

    # Verify SecurityEvent in DB
    stmt = (
        select(SecurityEvent)
        .where(SecurityEvent.request_path == "/api/v1/decoy/search/personnel")
        .where(SecurityEvent.event_type == "sql_injection")
        .order_by(SecurityEvent.timestamp.desc())
    )
    result = await db_session.execute(stmt)
    event = result.scalars().first()

    assert event is not None
    assert event.severity == "high"
    assert event.is_test_event is True
    # Payload stored safely — truncated, not executed
    stored = event.metadata_payload.get("injected_query", "")
    assert stored == sqli_payload
    assert len(stored) <= 200
    assert event.metadata_payload.get("badge_id_leaked") is True


@pytest.mark.asyncio
async def test_personnel_sqli_union_select_detected(
    client: AsyncClient, db_session: AsyncSession
):
    """
    UNION SELECT variant is also detected as SQLi.
    """
    response = await client.get(
        "/api/v1/decoy/search/personnel",
        params={"q": "admin' UNION SELECT username,password FROM users--"},
        headers={"X-Argus-Test-Token": "test"},
    )

    assert response.status_code == 200
    data = response.json()
    # Returns full synthetic dump, not real DB data
    assert data["row_count"] == 8
    # Real user table data must NOT appear
    assert "hashed_password" not in response.text
    assert "test_admin" not in response.text
    # The word "canary" must not appear
    assert "canary" not in response.text.lower()

    stmt = (
        select(SecurityEvent)
        .where(SecurityEvent.event_type == "sql_injection")
        .where(SecurityEvent.request_path == "/api/v1/decoy/search/personnel")
        .order_by(SecurityEvent.timestamp.desc())
    )
    result = await db_session.execute(stmt)
    event = result.scalars().first()
    assert event is not None
    assert event.severity == "high"


@pytest.mark.asyncio
async def test_personnel_endpoint_requires_no_auth(client: AsyncClient):
    """
    The endpoint is part of the public decoy surface and must not require
    a JWT or any authentication header.
    """
    response = await client.get(
        "/api/v1/decoy/search/personnel",
        params={"q": "ops"},
        # Deliberately no Authorization header
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_personnel_response_contains_no_real_secrets(client: AsyncClient):
    """
    Comprehensive check: no real application secrets, no real database
    connection strings, and no admin credentials appear in any response,
    even under a SQLi simulation.
    """
    for payload in ["' OR 1=1--", "UNION SELECT * FROM users", "admin"]:
        response = await client.get(
            "/api/v1/decoy/search/personnel",
            params={"q": payload},
            headers={"X-Argus-Test-Token": "test"},
        )
        assert response.status_code == 200
        body = response.text
        # Real secrets must never appear
        assert "argus_default_dev_secret_key" not in body
        assert "argus_hmac_fingerprint_salt" not in body
        assert "argus_internal_decoy_token" not in body
        assert "test_secret_key_32_bytes" not in body
        assert "postgresql+asyncpg" not in body
        # Real test user accounts must not appear
        assert "test_admin" not in body
        assert "test_analyst" not in body
        assert "AdminPass" not in body


@pytest.mark.asyncio
async def test_personnel_long_correlation_id_is_capped_at_64_chars(
    client: AsyncClient, db_session: AsyncSession
):
    """
    A 300-character X-Correlation-ID header must be accepted (returns 200)
    and stored truncated to 64 characters — matching the String(64) column
    constraint in the SecurityEvent model.
    """
    long_id = "A" * 300

    response = await client.get(
        "/api/v1/decoy/search/personnel",
        params={"q": "ops"},
        headers={
            "X-Argus-Test-Token": "test",
            "X-Correlation-ID": long_id,
        },
    )

    assert response.status_code == 200

    stmt = (
        select(SecurityEvent)
        .where(SecurityEvent.request_path == "/api/v1/decoy/search/personnel")
        .order_by(SecurityEvent.timestamp.desc())
    )
    result = await db_session.execute(stmt)
    event = result.scalars().first()

    assert event is not None
    assert event.correlation_id is not None
    assert len(event.correlation_id) <= 64
    # Confirm it is the truncated form of our header, not a random UUID fragment
    assert event.correlation_id == "A" * 64
