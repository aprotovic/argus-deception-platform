"""Test for race-safe _ensure_default_decoy (step 0 hardening).

Two concurrent calls with separate sessions against an empty DB must
not raise and must result in exactly one DecoyService row.
"""

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.v1.internal import _ensure_default_decoy
from app.config import settings
from app.models.decoy_service import DecoyService


@pytest.mark.asyncio
async def test_ensure_default_decoy_concurrent_no_duplicate(tmp_path):
    """Two concurrent calls each with their own session must produce one row."""
    db_url = f"sqlite+aiosqlite:///{tmp_path}/concurrent_test.db"
    engine = create_async_engine(db_url, future=True)

    # Create tables
    from app.database import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False,
    )

    async def call_ensure():
        async with SessionLocal() as session:
            return await _ensure_default_decoy(session)

    results = await __import__("asyncio").gather(
        call_ensure(), call_ensure(),
    )

    # Both must return the same default id, no exception
    expected_id = uuid.UUID(settings.DEFAULT_DECOY_ID)
    assert results[0] == expected_id
    assert results[1] == expected_id

    # Verify exactly one row in the DB
    async with SessionLocal() as session:
        stmt = select(DecoyService).where(DecoyService.id == expected_id)
        result = await session.execute(stmt)
        rows = result.scalars().all()
        assert len(rows) == 1

    await engine.dispose()
