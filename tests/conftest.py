"""Pytest configuration and async test fixtures for ARGUS."""

import asyncio
import os
import sys
from pathlib import Path
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Ensure backend is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

# Use dedicated SQLite test database
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./data/test_telemetry.db"
os.environ["QUARANTINE_STORAGE_DIR"] = "./data/test_quarantine"
os.environ["SECRET_KEY"] = "test_secret_key_32_bytes_minimum_for_pytest"
os.environ["ARGUS_PASSWORD_FINGERPRINT_SECRET"] = "test_hmac_fingerprint_salt_secret"

from app.config import settings
from app.core.security import hash_password
from app.database import Base, get_db
from app.main import app
from app.models.user import User

test_engine = create_async_engine(
    "sqlite+aiosqlite:///./data/test_telemetry.db",
    echo=False,
    future=True,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Initializes tables for test session and seeds test admin and analyst."""
    test_q_dir = Path("./data/test_quarantine")
    test_q_dir.mkdir(parents=True, exist_ok=True)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        # Seed test admin
        admin = User(
            username="test_admin",
            email="admin@test.local",
            hashed_password=hash_password("AdminPass123!"),
            role="admin",
            is_active=True,
        )
        session.add(admin)

        # Seed test analyst
        analyst = User(
            username="test_analyst",
            email="analyst@test.local",
            hashed_password=hash_password("AnalystPass123!"),
            role="analyst",
            is_active=True,
        )
        session.add(analyst)
        await session.commit()

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()

    # Clean up test database file and test quarantine
    test_db_file = Path("./data/test_telemetry.db")
    if test_db_file.exists():
        try:
            test_db_file.unlink()
        except OSError:
            pass


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides an isolated database session per test."""
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provides an async HTTP test client using FastAPI ASGI transport."""

    async def override_get_db():
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()
