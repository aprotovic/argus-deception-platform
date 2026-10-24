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


@pytest.mark.asyncio
async def test_user_activity_tracking_and_userinfo(db_session, monkeypatch):
    """Verify command count, command history tracking, and /userinfo profile display."""
    admin_id = "6288136999"
    target_id = "5551234567"

    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_ID", admin_id)

    mock_client = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client.post.return_value = mock_resp

    # Target user joins and executes commands
    update_start = {
        "update_id": 401,
        "message": {
            "chat": {"id": target_id},
            "from": {"id": int(target_id), "username": "analyst_john", "first_name": "John", "last_name": "Doe"},
            "text": "/start",
        },
    }
    await process_update(mock_client, update_start)

    # Approve target user so they can run commands
    update_approve = {
        "update_id": 402,
        "message": {
            "chat": {"id": admin_id},
            "from": {"id": int(admin_id)},
            "text": f"/approve {target_id}",
        },
    }
    await process_update(mock_client, update_approve)

    # Target user executes /status and /stats
    for u_id, cmd in [(403, "/status"), (404, "/stats")]:
        update_cmd = {
            "update_id": u_id,
            "message": {
                "chat": {"id": target_id},
                "from": {"id": int(target_id), "username": "analyst_john"},
                "text": cmd,
            },
        }
        await process_update(mock_client, update_cmd)

    # Check DB record for activity tracking
    stmt = select(TelegramUser).where(TelegramUser.telegram_id == target_id)
    user = (await db_session.execute(stmt)).scalar_one_or_none()
    assert user is not None
    assert user.command_count == 3  # /start, /status, /stats
    assert user.last_command == "/stats"
    assert user.username == "analyst_john"
    assert user.first_name == "John"
    assert user.last_name == "Doe"

    # Admin requests /userinfo
    mock_client.reset_mock()
    update_info = {
        "update_id": 405,
        "message": {
            "chat": {"id": admin_id},
            "from": {"id": int(admin_id)},
            "text": f"/userinfo {target_id}",
        },
    }
    await process_update(mock_client, update_info)

    # Verify profile output contains username, name, command count, and command history
    sent_calls = str(mock_client.post.call_args_list)
    assert "@analyst_john" in sent_calls
    assert "John Doe" in sent_calls
    assert "Commands sent:" in sent_calls
    assert "/stats" in sent_calls
    assert "/status" in sent_calls

    # Non-admin trying /userinfo must be denied
    mock_client.reset_mock()
    update_unauth = {
        "update_id": 406,
        "message": {
            "chat": {"id": target_id},
            "from": {"id": int(target_id)},
            "text": f"/userinfo {target_id}",
        },
    }
    await process_update(mock_client, update_unauth)
    assert any("Unauthorized" in str(c) for c in mock_client.post.call_args_list)


@pytest.mark.asyncio
async def test_admin_delete_user_and_callback(db_session, monkeypatch):
    """Verify admin can delete a user, cannot delete self, and callback delete works."""
    admin_id = "6288136999"
    target_id = "4449876543"

    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_ID", admin_id)

    mock_client = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client.post.return_value = mock_resp

    # Register target user
    update_start = {
        "update_id": 501,
        "message": {
            "chat": {"id": target_id},
            "from": {"id": int(target_id), "username": "bad_actor"},
            "text": "/start",
        },
    }
    await process_update(mock_client, update_start)

    # Admin attempts to delete themselves -> rejected
    update_del_self = {
        "update_id": 502,
        "message": {
            "chat": {"id": admin_id},
            "from": {"id": int(admin_id)},
            "text": f"/delete {admin_id}",
        },
    }
    await process_update(mock_client, update_del_self)
    assert any("Cannot delete the administrator account" in str(c) for c in mock_client.post.call_args_list)

    # Admin deletes target user via /delete
    mock_client.reset_mock()
    update_del = {
        "update_id": 503,
        "message": {
            "chat": {"id": admin_id},
            "from": {"id": int(admin_id)},
            "text": f"/delete {target_id}",
        },
    }
    await process_update(mock_client, update_del)
    assert any("PERMANENTLY DELETED" in str(c) for c in mock_client.post.call_args_list)

    # Verify user record is gone from DB
    stmt = select(TelegramUser).where(TelegramUser.telegram_id == target_id)
    user_after = (await db_session.execute(stmt)).scalar_one_or_none()
    assert user_after is None

    # Re-register user and test inline callback delete
    await process_update(mock_client, update_start)
    mock_client.reset_mock()

    cb_update = {
        "update_id": 504,
        "callback_query": {
            "id": "cb_del_1",
            "from": {"id": int(admin_id)},
            "message": {"chat": {"id": int(admin_id)}},
            "data": f"delete:{target_id}",
        },
    }
    await process_update(mock_client, cb_update)
    assert any("PERMANENTLY DELETED" in str(c) for c in mock_client.post.call_args_list)

    # Verify again gone
    user_after_cb = (await db_session.execute(stmt)).scalar_one_or_none()
    assert user_after_cb is None


@pytest.mark.asyncio
async def test_button_driven_navigation_and_callbacks(db_session, monkeypatch):
    """Verify persistent keyboard button clicks and inline command callbacks without typing slash commands."""
    admin_id = "6288136999"
    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_ID", admin_id)

    mock_client = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client.post.return_value = mock_resp

    # 1. Admin taps persistent reply keyboard button "🛡️ Status" (no slash command)
    btn_status = {
        "update_id": 601,
        "message": {
            "chat": {"id": admin_id},
            "from": {"id": int(admin_id), "username": "admin"},
            "text": "🛡️ Status",
        },
    }
    await process_update(mock_client, btn_status)
    assert any("ARGUS PLATFORM OPERATIONAL STATUS" in str(c) for c in mock_client.post.call_args_list)

    # 2. Admin taps persistent reply keyboard button "📊 Stats"
    mock_client.reset_mock()
    btn_stats = {
        "update_id": 602,
        "message": {
            "chat": {"id": admin_id},
            "from": {"id": int(admin_id)},
            "text": "📊 Stats",
        },
    }
    await process_update(mock_client, btn_stats)
    assert any("ARGUS THREAT TELEMETRY STATS" in str(c) for c in mock_client.post.call_args_list)

    # 3. Admin taps inline button callback "cmd:events"
    mock_client.reset_mock()
    cb_events = {
        "update_id": 603,
        "callback_query": {
            "id": "cb_ev_1",
            "from": {"id": int(admin_id)},
            "message": {"chat": {"id": int(admin_id)}},
            "data": "cmd:events",
        },
    }
    await process_update(mock_client, cb_events)
    sent_events = str(mock_client.post.call_args_list)
    assert ("RECENT TRAPPED INCIDENTS" in sent_events or "No security events" in sent_events)

    # 4. Admin taps inline button callback "cmd:lockdown_prompt"
    mock_client.reset_mock()
    cb_lock_prompt = {
        "update_id": 604,
        "callback_query": {
            "id": "cb_lock_1",
            "from": {"id": int(admin_id)},
            "message": {"chat": {"id": int(admin_id)}},
            "data": "cmd:lockdown_prompt",
        },
    }
    await process_update(mock_client, cb_lock_prompt)
    assert any("CONFIRM EMERGENCY LOCKDOWN" in str(c) for c in mock_client.post.call_args_list)

    # 5. Non-admin tapping admin-only callback is rejected
    non_admin_id = "1122334455"
    mock_client.reset_mock()
    cb_unauth = {
        "update_id": 605,
        "callback_query": {
            "id": "cb_unauth_1",
            "from": {"id": int(non_admin_id)},
            "message": {"chat": {"id": int(non_admin_id)}},
            "data": "cmd:users",
        },
    }
    await process_update(mock_client, cb_unauth)
    assert any("Unauthorized" in str(c) for c in mock_client.post.call_args_list)


@pytest.mark.asyncio
async def test_super_admin_and_secondary_admin_hierarchy(db_session, monkeypatch):
    """Verify Super Admin can promote/demote secondary Admins, and secondary Admins are properly restricted."""
    super_admin_id = "6288136999"
    secondary_admin_id = "3331112222"
    analyst_id = "4445556666"

    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_ID", super_admin_id)

    mock_client = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client.post.return_value = mock_resp

    # 1. Register candidate user
    update_start = {
        "update_id": 701,
        "message": {
            "chat": {"id": secondary_admin_id},
            "from": {"id": int(secondary_admin_id), "username": "candidate"},
            "text": "/start",
        },
    }
    await process_update(mock_client, update_start)

    # 2. Super Admin promotes candidate to Admin
    mock_client.reset_mock()
    update_promote = {
        "update_id": 702,
        "message": {
            "chat": {"id": super_admin_id},
            "from": {"id": int(super_admin_id)},
            "text": f"/promote {secondary_admin_id}",
        },
    }
    await process_update(mock_client, update_promote)
    assert any("PROMOTED TO ADMINISTRATOR" in str(c) for c in mock_client.post.call_args_list)

    # Verify DB state: role is admin, promoted_by is super admin
    stmt = select(TelegramUser).where(TelegramUser.telegram_id == secondary_admin_id)
    sec_user = (await db_session.execute(stmt)).scalar_one_or_none()
    assert sec_user is not None
    assert sec_user.role == "admin"
    assert sec_user.status == "approved"
    assert sec_user.promoted_by == super_admin_id

    # 3. Secondary Admin CAN access /users
    mock_client.reset_mock()
    update_sec_users = {
        "update_id": 703,
        "message": {
            "chat": {"id": secondary_admin_id},
            "from": {"id": int(secondary_admin_id)},
            "text": "/users",
        },
    }
    await process_update(mock_client, update_sec_users)
    assert any("Total Registered" in str(c) for c in mock_client.post.call_args_list)

    # 4. Secondary Admin CANNOT promote another user to admin
    mock_client.reset_mock()
    update_sec_promote = {
        "update_id": 704,
        "message": {
            "chat": {"id": secondary_admin_id},
            "from": {"id": int(secondary_admin_id)},
            "text": f"/promote {analyst_id}",
        },
    }
    await process_update(mock_client, update_sec_promote)
    assert any("Only the Super Administrator can promote" in str(c) for c in mock_client.post.call_args_list)

    # 5. Secondary Admin CANNOT delete users
    mock_client.reset_mock()
    update_sec_delete = {
        "update_id": 705,
        "message": {
            "chat": {"id": secondary_admin_id},
            "from": {"id": int(secondary_admin_id)},
            "text": f"/delete {analyst_id}",
        },
    }
    await process_update(mock_client, update_sec_delete)
    assert any("Only the Super Administrator can permanently delete" in str(c) for c in mock_client.post.call_args_list)

    # 6. Secondary Admin CANNOT revoke Super Admin
    mock_client.reset_mock()
    update_sec_revoke_super = {
        "update_id": 706,
        "message": {
            "chat": {"id": secondary_admin_id},
            "from": {"id": int(secondary_admin_id)},
            "text": f"/revoke {super_admin_id}",
        },
    }
    await process_update(mock_client, update_sec_revoke_super)
    assert any("Cannot revoke the Super Administrator" in str(c) for c in mock_client.post.call_args_list)

    # 7. Secondary Admin CANNOT execute lockdown
    mock_client.reset_mock()
    update_sec_lockdown = {
        "update_id": 707,
        "message": {
            "chat": {"id": secondary_admin_id},
            "from": {"id": int(secondary_admin_id)},
            "text": "/lockdown",
        },
    }
    await process_update(mock_client, update_sec_lockdown)
    assert any("Only the Super Administrator can execute platform lockdown" in str(c) for c in mock_client.post.call_args_list)

    # 8. Super Admin demotes secondary Admin back to analyst
    mock_client.reset_mock()
    update_demote = {
        "update_id": 708,
        "message": {
            "chat": {"id": super_admin_id},
            "from": {"id": int(super_admin_id)},
            "text": f"/demote {secondary_admin_id}",
        },
    }
    await process_update(mock_client, update_demote)
    assert any("DEMOTED TO ANALYST" in str(c) for c in mock_client.post.call_args_list)

    # Verify DB: role is now user
    await db_session.refresh(sec_user)
    assert sec_user.role == "user"
    assert sec_user.promoted_by is None


@pytest.mark.asyncio
async def test_super_admin_quick_action_buttons_and_lists(db_session, monkeypatch):
    """Verify Super Admin one-tap Quick Action buttons: Make Admin, Make Analyst, Revoke."""
    super_admin_id = "6288136999"
    analyst_id = "111222333"
    secondary_admin_id = "444555666"
    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_ID", super_admin_id)

    mock_client = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client.post.return_value = mock_resp

    # Register Super Admin
    await process_update(mock_client, {
        "update_id": 801,
        "message": {"chat": {"id": super_admin_id}, "from": {"id": int(super_admin_id)}, "text": "/start"},
    })

    # Register Analyst (user role, approved)
    await process_update(mock_client, {
        "update_id": 802,
        "message": {"chat": {"id": analyst_id}, "from": {"id": int(analyst_id), "username": "analyst_bob"}, "text": "/start"},
    })
    # Approve analyst
    await process_update(mock_client, {
        "update_id": 803,
        "message": {"chat": {"id": super_admin_id}, "from": {"id": int(super_admin_id)}, "text": f"/approve {analyst_id}"},
    })

    # Register Secondary Admin
    await process_update(mock_client, {
        "update_id": 804,
        "message": {"chat": {"id": secondary_admin_id}, "from": {"id": int(secondary_admin_id), "username": "admin_charlie"}, "text": "/start"},
    })
    await process_update(mock_client, {
        "update_id": 805,
        "message": {"chat": {"id": super_admin_id}, "from": {"id": int(super_admin_id)}, "text": f"/promote {secondary_admin_id}"},
    })

    # 1. Test Quick Promote callback
    mock_client.reset_mock()
    cb_promote = {
        "update_id": 806,
        "callback_query": {
            "id": "cb_qp_1",
            "from": {"id": int(super_admin_id)},
            "message": {"chat": {"id": int(super_admin_id)}},
            "data": "cmd:quick_promote",
        },
    }
    await process_update(mock_client, cb_promote)
    assert any("MAKE ADMINISTRATOR" in str(c) for c in mock_client.post.call_args_list)

    # 2. Test Quick Demote callback
    mock_client.reset_mock()
    cb_demote = {
        "update_id": 807,
        "callback_query": {
            "id": "cb_qd_1",
            "from": {"id": int(super_admin_id)},
            "message": {"chat": {"id": int(super_admin_id)}},
            "data": "cmd:quick_demote",
        },
    }
    await process_update(mock_client, cb_demote)
    assert any("MAKE ANALYST" in str(c) for c in mock_client.post.call_args_list)

    # 3. Test Quick Revoke callback
    mock_client.reset_mock()
    cb_revoke = {
        "update_id": 808,
        "callback_query": {
            "id": "cb_qr_1",
            "from": {"id": int(super_admin_id)},
            "message": {"chat": {"id": int(super_admin_id)}},
            "data": "cmd:quick_revoke",
        },
    }
    await process_update(mock_client, cb_revoke)
    assert any("REVOKE ACCESS" in str(c) for c in mock_client.post.call_args_list)

    # 4. Test persistent keyboard text translation
    mock_client.reset_mock()
    btn_text_update = {
        "update_id": 809,
        "message": {
            "chat": {"id": super_admin_id},
            "from": {"id": int(super_admin_id)},
            "text": "⭐ Make Admin",
        },
    }
    await process_update(mock_client, btn_text_update)
    assert any("MAKE ADMINISTRATOR" in str(c) for c in mock_client.post.call_args_list)
