"""Unit tests for ARGUS Telegram bot administrator-only lockdown and access control."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest
from app.config import settings
from app.core.alerts import get_authorized_recipient_ids
from app.models.telegram_user import TelegramUser
from app.services.telegram_bot import process_update
from sqlalchemy import select


def test_admin_numeric_id_resolution_and_fail_closed(monkeypatch):
    """Verify administrator ID must be strictly numeric and fails closed if invalid."""
    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_ID", "6288136999")
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID", "")
    assert settings.telegram_admin_numeric_id == "6288136999"

    # Non-numeric fails closed
    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_ID", "invalid_alpha_id")
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID", "")
    assert settings.telegram_admin_numeric_id is None

    # Empty fails closed
    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_ID", "")
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID", "")
    assert settings.telegram_admin_numeric_id is None


@pytest.mark.asyncio
async def test_get_authorized_recipient_ids_only_approved(db_session, monkeypatch):
    """Verify only approved subscribers receive alerts; revoked/pending receive nothing."""
    admin_id = "6288136999"
    revoked_id = "6110551799"
    pending_id = "9999999999"

    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_ID", admin_id)

    # Upsert test users
    for uid, status, sub, role in [
        (admin_id, "approved", True, "admin"),
        (revoked_id, "revoked", False, "user"),
        (pending_id, "pending", False, "user"),
    ]:
        stmt = select(TelegramUser).where(TelegramUser.telegram_id == uid)
        u = (await db_session.execute(stmt)).scalar_one_or_none()
        if not u:
            u = TelegramUser(
                id=uuid.uuid4(),
                telegram_id=uid,
                status=status,
                is_subscribed=sub,
                role=role,
            )
            db_session.add(u)
        else:
            u.status = status
            u.is_subscribed = sub
            u.role = role
    await db_session.commit()

    recipients = await get_authorized_recipient_ids()

    assert admin_id in recipients
    assert revoked_id not in recipients
    assert pending_id not in recipients


@pytest.mark.asyncio
async def test_non_admin_cannot_execute_admin_commands(monkeypatch):
    """Non-administrator cannot execute /users, /approve, /revoke, or /lockdown."""
    admin_id = "6288136999"
    non_admin_id = "6110551799"

    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_ID", admin_id)

    mock_client = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client.post.return_value = mock_resp

    # Non-admin tries /users
    update_users = {
        "update_id": 101,
        "message": {
            "chat": {"id": non_admin_id},
            "from": {"id": int(non_admin_id), "username": "attacker"},
            "text": "/users",
        },
    }
    await process_update(mock_client, update_users)

    # Check reply contains Unauthorized
    sent_calls = mock_client.post.call_args_list
    assert any("Unauthorized" in str(c) for c in sent_calls)

    # Non-admin tries /lockdown
    mock_client.reset_mock()
    update_lockdown = {
        "update_id": 102,
        "message": {
            "chat": {"id": non_admin_id},
            "from": {"id": int(non_admin_id)},
            "text": "/lockdown",
        },
    }
    await process_update(mock_client, update_lockdown)
    assert any("Unauthorized" in str(c) for c in mock_client.post.call_args_list)


@pytest.mark.asyncio
async def test_new_user_gets_pending_and_cannot_access_telemetry(db_session, monkeypatch):
    """New user starts bot -> status is pending -> /status is denied."""
    admin_id = "6288136999"
    new_user_id = "8881234567"

    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_ID", admin_id)

    mock_client = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client.post.return_value = mock_resp

    # User sends /start
    update_start = {
        "update_id": 201,
        "message": {
            "chat": {"id": new_user_id},
            "from": {"id": int(new_user_id), "username": "newbie"},
            "text": "/start",
        },
    }
    await process_update(mock_client, update_start)

    # Verify DB status is pending
    stmt = select(TelegramUser).where(TelegramUser.telegram_id == new_user_id)
    user = (await db_session.execute(stmt)).scalar_one_or_none()
    assert user is not None
    assert user.status == "pending"
    assert user.is_subscribed is False

    # User tries /status -> should be denied
    mock_client.reset_mock()
    update_status = {
        "update_id": 202,
        "message": {
            "chat": {"id": new_user_id},
            "from": {"id": int(new_user_id)},
            "text": "/status",
        },
    }
    await process_update(mock_client, update_status)
    assert any("Access Denied" in str(c) for c in mock_client.post.call_args_list)


@pytest.mark.asyncio
async def test_admin_can_approve_and_revoke_user(db_session, monkeypatch):
    """Admin can approve a pending user, granting access, and then revoke them."""
    admin_id = "6288136999"
    target_id = "7776543210"

    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_ID", admin_id)

    mock_client = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client.post.return_value = mock_resp

    # Admin executes /approve
    update_approve = {
        "update_id": 301,
        "message": {
            "chat": {"id": admin_id},
            "from": {"id": int(admin_id), "username": "admin"},
            "text": f"/approve {target_id}",
        },
    }
    await process_update(mock_client, update_approve)

    # Verify user is approved in DB
    stmt = select(TelegramUser).where(TelegramUser.telegram_id == target_id)
    user = (await db_session.execute(stmt)).scalar_one_or_none()
    assert user is not None
    assert user.status == "approved"
    assert user.is_subscribed is True
    assert user.approved_by == admin_id

    # Target user now has access to /status
    mock_client.reset_mock()
    update_status = {
        "update_id": 302,
        "message": {
            "chat": {"id": target_id},
            "from": {"id": int(target_id)},
            "text": "/status",
        },
    }
    await process_update(mock_client, update_status)
    assert any("ARGUS PLATFORM OPERATIONAL STATUS" in str(c) for c in mock_client.post.call_args_list)

    # Admin executes /revoke
    mock_client.reset_mock()
    update_revoke = {
        "update_id": 303,
        "message": {
            "chat": {"id": admin_id},
            "from": {"id": int(admin_id)},
            "text": f"/revoke {target_id}",
        },
    }
    await process_update(mock_client, update_revoke)

    # Verify user is revoked in DB
    await db_session.refresh(user)
    assert user.status == "revoked"
    assert user.is_subscribed is False

    # Revoked user tries /status again -> Denied!
    mock_client.reset_mock()
    await process_update(mock_client, update_status)
    assert any("Access Denied" in str(c) for c in mock_client.post.call_args_list)
