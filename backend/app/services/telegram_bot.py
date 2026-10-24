"""ARGUS Telegram Incident Command Bot Service.

Enforces hierarchical server-side administrator lockdown with full button-driven controls:
- 👑 SUPER ADMINISTRATOR: The verified numeric administrator Telegram ID from configuration.
  Full root authority: can promote/demote administrators, audit all users, execute lockdown,
  and revoke or delete accounts. Cannot be modified or demoted by anyone.
- ⭐ ADMINISTRATORS: Secondary admins promoted by the Super Administrator.
  Can review telemetry, audit users, and approve/reject/revoke standard analysts.
  Cannot modify fellow administrators or the Super Administrator, and cannot promote/demote.
- 🛡️ ANALYSTS: Standard approved users with telemetry monitoring and incident alert delivery.
- Interactive persistent reply keyboard and inline keyboards for all operations:
  no manual command typing required.
"""

import asyncio
import html
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import delete, desc, func, select

from app.config import settings
from app.database import AsyncSessionLocal
from app.logging_config import logger
from app.models.audit_log import AuditLog
from app.models.captured_file import CapturedFile
from app.models.security_event import SecurityEvent
from app.models.telegram_user import TelegramUser

_bot_task: Optional[asyncio.Task] = None
_shutdown_event = asyncio.Event()

# Maximum command history entries stored per user
_HISTORY_LIMIT = 10


# ---------------------------------------------------------------------------
# Keyboards & Navigation Layouts
# ---------------------------------------------------------------------------

def _super_admin_reply_keyboard() -> Dict[str, Any]:
    """Persistent bottom keyboard for the Super Administrator."""
    return {
        "keyboard": [
            [{"text": "🛡️ Status"}, {"text": "📊 Stats"}, {"text": "🚨 Events"}],
            [{"text": "🔔 Toggle Alerts"}, {"text": "👥 Manage Users"}],
            [{"text": "🚨 Emergency Lockdown"}, {"text": "🏠 Main Menu"}],
        ],
        "resize_keyboard": True,
        "is_persistent": True,
    }


def _secondary_admin_reply_keyboard() -> Dict[str, Any]:
    """Persistent bottom keyboard for secondary Administrators."""
    return {
        "keyboard": [
            [{"text": "🛡️ Status"}, {"text": "📊 Stats"}, {"text": "🚨 Events"}],
            [{"text": "🔔 Toggle Alerts"}, {"text": "👥 Manage Users"}],
            [{"text": "🏠 Main Menu"}],
        ],
        "resize_keyboard": True,
        "is_persistent": True,
    }


def _analyst_reply_keyboard() -> Dict[str, Any]:
    """Persistent bottom keyboard for approved analysts."""
    return {
        "keyboard": [
            [{"text": "🛡️ Status"}, {"text": "📊 Stats"}],
            [{"text": "🚨 Events"}, {"text": "🔔 Toggle Alerts"}],
            [{"text": "🏠 Main Menu"}],
        ],
        "resize_keyboard": True,
        "is_persistent": True,
    }


def _super_admin_dashboard_inline() -> Dict[str, Any]:
    """Interactive command dashboard inline buttons for Super Administrator."""
    return {
        "inline_keyboard": [
            [
                {"text": "🛡️ Platform Status", "callback_data": "cmd:status"},
                {"text": "📊 Threat Stats", "callback_data": "cmd:stats"},
            ],
            [
                {"text": "🚨 Trapped Events", "callback_data": "cmd:events"},
                {"text": "🔔 Toggle Alerts", "callback_data": "cmd:alerts_toggle"},
            ],
            [
                {"text": "👥 Manage Users & Admins", "callback_data": "cmd:users"},
                {"text": "🚨 Emergency Lockdown", "callback_data": "cmd:lockdown_prompt"},
            ],
            [
                {"text": "🔄 Refresh Console", "callback_data": "cmd:refresh_menu"},
            ],
        ]
    }


def _secondary_admin_dashboard_inline() -> Dict[str, Any]:
    """Interactive command dashboard inline buttons for secondary Administrators."""
    return {
        "inline_keyboard": [
            [
                {"text": "🛡️ Platform Status", "callback_data": "cmd:status"},
                {"text": "📊 Threat Stats", "callback_data": "cmd:stats"},
            ],
            [
                {"text": "🚨 Trapped Events", "callback_data": "cmd:events"},
                {"text": "🔔 Toggle Alerts", "callback_data": "cmd:alerts_toggle"},
            ],
            [
                {"text": "👥 Manage Analysts", "callback_data": "cmd:users"},
                {"text": "🔄 Refresh Console", "callback_data": "cmd:refresh_menu"},
            ],
        ]
    }


def _analyst_dashboard_inline() -> Dict[str, Any]:
    """Interactive dashboard inline buttons for approved analysts."""
    return {
        "inline_keyboard": [
            [
                {"text": "🛡️ Platform Status", "callback_data": "cmd:status"},
                {"text": "📊 Threat Stats", "callback_data": "cmd:stats"},
            ],
            [
                {"text": "🚨 Trapped Events", "callback_data": "cmd:events"},
                {"text": "🔔 Toggle Alerts", "callback_data": "cmd:alerts_toggle"},
            ],
            [
                {"text": "🔄 Refresh Console", "callback_data": "cmd:refresh_menu"},
            ],
        ]
    }


def _quick_nav_inline(is_admin: bool = False) -> Dict[str, Any]:
    """Quick-action toolbar attached to command outputs for rapid navigation."""
    row1 = [
        {"text": "🛡️ Status", "callback_data": "cmd:status"},
        {"text": "📊 Stats", "callback_data": "cmd:stats"},
        {"text": "🚨 Events", "callback_data": "cmd:events"},
    ]
    row2 = [
        {"text": "🔔 Alerts", "callback_data": "cmd:alerts_toggle"},
        {"text": "🏠 Menu", "callback_data": "cmd:menu"},
    ]
    if is_admin:
        row2.insert(0, {"text": "👥 Users", "callback_data": "cmd:users"})
    return {"inline_keyboard": [row1, row2]}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _send_msg(
    client: httpx.AsyncClient,
    chat_id: str,
    text: str,
    reply_markup: Optional[Dict[str, Any]] = None,
) -> bool:
    """Send an HTML-mode message via Telegram Bot API."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return False
    try:
        payload: Dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup
        resp = await client.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
            json=payload,
            timeout=10.0,
        )
        return resp.status_code == 200
    except Exception as e:
        logger.warning(f"Failed to send Telegram message to {chat_id}: {e}")
        return False


async def _answer_callback(
    client: httpx.AsyncClient, callback_query_id: str, text: str, alert: bool = False
) -> None:
    try:
        await client.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/answerCallbackQuery",
            json={"callback_query_id": callback_query_id, "text": text, "show_alert": alert},
            timeout=5.0,
        )
    except Exception as e:
        logger.warning(f"Failed to answer callback query {callback_query_id}: {e}")


async def _log_audit_event(
    action: str, target_id: str, user_id: str, details: Dict[str, Any]
) -> None:
    """Record an access-control or administrative action into ARGUS audit_logs."""
    try:
        async with AsyncSessionLocal() as session:
            entry = AuditLog(
                id=uuid.uuid4(),
                user_id=None,
                action=action,
                target_type="TELEGRAM_BOT",
                target_id=target_id,
                ip_address="127.0.0.1",
                user_agent="ARGUS_TELEGRAM_BOT",
                details=details,
                timestamp=datetime.now(timezone.utc),
            )
            session.add(entry)
            await session.commit()
    except Exception as exc:
        logger.error(f"Failed to write audit log for bot action {action}: {exc}")


async def _record_activity(user_id: str, command: str) -> None:
    """Update last_command, last_seen, command_count, and rolling command_history for a user."""
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(TelegramUser).where(TelegramUser.telegram_id == user_id)
            res = await session.execute(stmt)
            user = res.scalar_one_or_none()
            if not user:
                return

            now = datetime.now(timezone.utc)
            user.last_command = command
            user.last_seen = now
            user.command_count = (user.command_count or 0) + 1

            # Rolling history (newest first, capped at _HISTORY_LIMIT)
            try:
                history: List[Dict[str, str]] = json.loads(user.command_history or "[]")
            except (json.JSONDecodeError, TypeError):
                history = []
            history.insert(0, {"cmd": command, "ts": now.strftime("%Y-%m-%d %H:%M:%S UTC")})
            history = history[:_HISTORY_LIMIT]
            user.command_history = json.dumps(history)

            await session.commit()
    except Exception as exc:
        logger.warning(f"Failed to record activity for user {user_id}: {exc}")


def _display_name(user: TelegramUser) -> str:
    """Return a human-readable display name for a TelegramUser record."""
    if user.username:
        return f"@{user.username}"
    parts = [user.first_name or "", user.last_name or ""]
    full = " ".join(p for p in parts if p).strip()
    return full if full else f"ID {user.telegram_id}"


def _role_badge(role: str, is_super: bool = False) -> str:
    if is_super or role == "super_admin":
        return "👑 SUPER ADMINISTRATOR"
    elif role == "admin":
        return "⭐ ADMINISTRATOR"
    return "🛡️ ANALYST"


def _status_emoji(status: str) -> str:
    return {"approved": "✅", "pending": "⏳", "revoked": "🔒", "rejected": "❌"}.get(status, "❓")


# ---------------------------------------------------------------------------
# Command Handlers
# ---------------------------------------------------------------------------

async def handle_start(
    client: httpx.AsyncClient,
    from_user: Dict[str, Any],
    chat_id: str,
    user_id: str,
    admin_id: str,
) -> None:
    """Handle /start — role-based welcome with interactive button keyboards."""
    is_super = user_id == admin_id
    username = from_user.get("username")
    first_name = from_user.get("first_name", "")
    last_name = from_user.get("last_name", "")

    async with AsyncSessionLocal() as session:
        stmt = select(TelegramUser).where(TelegramUser.telegram_id == user_id)
        res = await session.execute(stmt)
        user_record = res.scalar_one_or_none()
        now = datetime.now(timezone.utc)

        # 1. Super Administrator Flow
        if is_super:
            if not user_record:
                user_record = TelegramUser(
                    id=uuid.uuid4(),
                    telegram_id=user_id,
                    username=username,
                    first_name=first_name,
                    last_name=last_name,
                    role="super_admin",
                    status="approved",
                    is_subscribed=True,
                    registered_at=now,
                    approved_by=admin_id,
                    approved_at=now,
                    last_command="/start",
                    last_seen=now,
                    command_count=1,
                    command_history=json.dumps([{"cmd": "/start", "ts": now.strftime("%Y-%m-%d %H:%M:%S UTC")}]),
                )
                session.add(user_record)
            else:
                user_record.role = "super_admin"
                user_record.status = "approved"
                user_record.is_subscribed = True
                user_record.approved_by = admin_id
                user_record.approved_at = now
                user_record.last_command = "/start"
                user_record.last_seen = now
                user_record.command_count = (user_record.command_count or 0) + 1
                try:
                    hist = json.loads(user_record.command_history or "[]")
                except Exception:
                    hist = []
                hist.insert(0, {"cmd": "/start", "ts": now.strftime("%Y-%m-%d %H:%M:%S UTC")})
                user_record.command_history = json.dumps(hist[:_HISTORY_LIMIT])
                if username:
                    user_record.username = username
                if first_name:
                    user_record.first_name = first_name
                if last_name:
                    user_record.last_name = last_name
            await session.commit()

            admin_welcome = (
                "🛡️ <b>ARGUS INCIDENT COMMAND — ROOT CONTROL</b>\n\n"
                "<b>Role:</b> <code>👑 SUPER ADMINISTRATOR</code>\n"
                "<b>Status:</b> <code>ROOT VERIFIED ACTIVE</code>\n"
                f"<b>Admin ID:</b> <code>{user_id}</code>\n\n"
                "<b>Super Admin Command Console:</b>\n"
                "You hold full root authority to monitor telemetry, appoint or demote "
                "Administrators, manage analyst access, or execute emergency platform lockdown.\n\n"
                "• <b>Status / Stats / Events</b> — Live sensor health and threat metrics\n"
                "• <b>Toggle Alerts</b> — One-tap alert notifications switch\n"
                "• <b>Manage Users & Admins</b> — Promote/demote admins, approve, revoke, or delete\n"
                "• <b>Emergency Lockdown</b> — Immediately revoke all non-admin analyst accounts"
            )

            await _send_msg(client, chat_id, admin_welcome, reply_markup=_super_admin_dashboard_inline())
            await _send_msg(
                client, chat_id,
                "⌨️ <i>Super Administrator console active below. Tap any button to proceed:</i>",
                reply_markup=_super_admin_reply_keyboard(),
            )
            return

        # 2. Secondary Administrator Flow
        if user_record and user_record.status == "approved" and user_record.role == "admin":
            user_record.last_command = "/start"
            user_record.last_seen = now
            user_record.command_count = (user_record.command_count or 0) + 1
            if username:
                user_record.username = username
            if first_name:
                user_record.first_name = first_name
            if last_name:
                user_record.last_name = last_name
            await session.commit()

            sec_welcome = (
                "🛡️ <b>ARGUS INCIDENT COMMAND — ADMINISTRATOR</b>\n\n"
                "<b>Role:</b> <code>⭐ ADMINISTRATOR</code>\n"
                "<b>Status:</b> <code>VERIFIED ACTIVE</code>\n"
                f"<b>Admin ID:</b> <code>{user_id}</code>\n"
                f"<b>Appointed by Super Admin:</b> <code>{user_record.promoted_by or admin_id}</code>\n\n"
                "<b>Administrator Controls:</b>\n"
                "You can inspect security telemetry, audit registered users, and approve or revoke analyst accounts.\n\n"
                "• <b>Status / Stats / Events</b> — Live platform metrics\n"
                "• <b>Toggle Alerts</b> — Live incident delivery toggle\n"
                "• <b>Manage Analysts</b> — Audit, approve, or revoke analyst users"
            )
            await _send_msg(client, chat_id, sec_welcome, reply_markup=_secondary_admin_dashboard_inline())
            await _send_msg(
                client, chat_id,
                "⌨️ <i>Administrator keyboard active below:</i>",
                reply_markup=_secondary_admin_reply_keyboard(),
            )
            return

        # 3. Non-admin handling (revoked / rejected / approved analyst)
        if user_record and user_record.status == "revoked":
            await _send_msg(
                client, chat_id,
                "⛔ <b>ACCESS DENIED — AUTHORIZATION REVOKED</b>\n\n"
                "Your ARGUS Telegram bot access has been revoked by an Administrator.\n"
                "You cannot view telemetry or receive incident alerts.",
            )
            return

        if user_record and user_record.status == "rejected":
            await _send_msg(
                client, chat_id,
                "⛔ <b>ACCESS REJECTED</b>\n\n"
                "Your registration request was rejected by an Administrator.",
            )
            return

        if user_record and user_record.status == "approved":
            analyst_welcome = (
                "🛡️ <b>ARGUS INCIDENT MONITOR</b>\n\n"
                f"<b>Status:</b> <code>APPROVED (ANALYST)</code>\n"
                f"<b>User ID:</b> <code>{user_id}</code>\n\n"
                "<b>Available Controls:</b>\n"
                "Tap buttons below to view telemetry and alerts without typing commands."
            )
            await _send_msg(client, chat_id, analyst_welcome, reply_markup=_analyst_dashboard_inline())
            await _send_msg(
                client, chat_id,
                "⌨️ <i>Command keyboard active below.</i>",
                reply_markup=_analyst_reply_keyboard(),
            )
            return

        # 4. New user: register as pending
        if user_record:
            if username:
                user_record.username = username
            if first_name:
                user_record.first_name = first_name
            if last_name:
                user_record.last_name = last_name
            user_record.last_command = "/start"
            user_record.last_seen = now
            user_record.command_count = (user_record.command_count or 0) + 1
        else:
            user_record = TelegramUser(
                id=uuid.uuid4(),
                telegram_id=user_id,
                username=username,
                first_name=first_name,
                last_name=last_name,
                role="user",
                status="pending",
                is_subscribed=False,
                registered_at=now,
                last_command="/start",
                last_seen=now,
                command_count=1,
                command_history=json.dumps([{"cmd": "/start", "ts": now.strftime("%Y-%m-%d %H:%M:%S UTC")}]),
            )
            session.add(user_record)
        await session.commit()

        await _send_msg(
            client, chat_id,
            "⏳ <b>REGISTRATION RECEIVED — PENDING APPROVAL</b>\n\n"
            f"<b>Your User ID:</b> <code>{user_id}</code>\n"
            "<b>Status:</b> <code>PENDING ADMINISTRATOR REVIEW</code>\n\n"
            "Your account has been registered. You do not have access to ARGUS "
            "security telemetry or alerts until explicitly approved by an administrator.",
        )

        user_display = f"@{username}" if username else f"{first_name} {last_name}".strip()
        markup = {
            "inline_keyboard": [[
                {"text": "✅ Approve User", "callback_data": f"approve:{user_id}"},
                {"text": "❌ Reject User",  "callback_data": f"reject:{user_id}"},
            ]]
        }
        await _send_msg(
            client, admin_id,
            "🔔 <b>ARGUS USER ACCESS REQUEST</b>\n\n"
            f"A new user is requesting bot access:\n"
            f"• <b>User ID:</b> <code>{user_id}</code>\n"
            f"• <b>Name:</b> {html.escape(user_display or 'Unknown')}\n"
            f"• <b>Username:</b> {'@' + html.escape(username) if username else '—'}\n"
            f"• <b>Status:</b> <code>PENDING</code>\n\n"
            "<i>Tap below to authorize or deny immediately:</i>",
            reply_markup=markup,
        )


async def handle_status(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str
) -> None:
    """Protected: Platform operational health."""
    is_super = user_id == admin_id
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == user_id))
        user = res.scalar_one_or_none()
    is_admin = is_super or (user is not None and user.role == "admin" and user.status == "approved")
    if not is_super and (not user or user.status != "approved"):
        await _send_msg(client, chat_id, "⛔ Access Denied. Approved authorization required.")
        return
    msg = (
        "🛡️ <b>ARGUS PLATFORM OPERATIONAL STATUS</b>\n\n"
        "• <b>Core API:</b> <code>ONLINE (Port 8000)</code>\n"
        "• <b>Web Decoy Portal:</b> <code>ONLINE (Port 8081)</code>\n"
        "• <b>MySQL Protocol Decoy:</b> <code>ONLINE (Port 3306)</code>\n"
        "• <b>Lockdown Policy:</b> <code>SUPER-ADMIN-ENFORCED</code>\n"
        "• <b>Quarantine Storage:</b> <code>SECURED</code>\n"
        f"• <b>System Time:</b> <code>{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</code>"
    )
    await _send_msg(client, chat_id, msg, reply_markup=_quick_nav_inline(is_admin=is_admin))


async def handle_stats(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str
) -> None:
    """Protected: Telemetry statistics."""
    is_super = user_id == admin_id
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == user_id))
        user = res.scalar_one_or_none()
        is_admin = is_super or (user is not None and user.role == "admin" and user.status == "approved")
        if not is_super and (not user or user.status != "approved"):
            await _send_msg(client, chat_id, "⛔ Access Denied. Approved authorization required.")
            return
        total_events   = await session.scalar(select(func.count(SecurityEvent.id)))
        crit_events    = await session.scalar(select(func.count(SecurityEvent.id)).where(SecurityEvent.severity == "critical"))
        high_events    = await session.scalar(select(func.count(SecurityEvent.id)).where(SecurityEvent.severity == "high"))
        captured_files = await session.scalar(select(func.count(CapturedFile.id)))

    msg = (
        "📊 <b>ARGUS THREAT TELEMETRY STATS</b>\n\n"
        f"• <b>Total Trapped Events:</b> <code>{total_events or 0}</code>\n"
        f"• <b>Critical Incursions:</b> <code>{crit_events or 0}</code>\n"
        f"• <b>High Severity Alerts:</b> <code>{high_events or 0}</code>\n"
        f"• <b>Quarantined Artifacts:</b> <code>{captured_files or 0}</code>\n\n"
        "<i>All telemetry isolated in ARGUS sensor sandbox.</i>"
    )
    await _send_msg(client, chat_id, msg, reply_markup=_quick_nav_inline(is_admin=is_admin))


async def handle_events(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str
) -> None:
    """Protected: Recent security events."""
    is_super = user_id == admin_id
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == user_id))
        user = res.scalar_one_or_none()
        is_admin = is_super or (user is not None and user.role == "admin" and user.status == "approved")
        if not is_super and (not user or user.status != "approved"):
            await _send_msg(client, chat_id, "⛔ Access Denied. Approved authorization required.")
            return
        events_res = await session.execute(
            select(SecurityEvent).order_by(desc(SecurityEvent.timestamp)).limit(5)
        )
        events = events_res.scalars().all()

    if not events:
        await _send_msg(client, chat_id, "ℹ️ No security events currently logged.", reply_markup=_quick_nav_inline(is_admin=is_admin))
        return
    lines = ["🛡️ <b>RECENT TRAPPED INCIDENTS (LAST 5)</b>\n"]
    for ev in events:
        sev = ev.severity.upper()
        ts  = ev.timestamp.strftime("%H:%M:%S UTC") if ev.timestamp else "N/A"
        lines.append(
            f"• <code>[{sev}]</code> <b>{ev.event_type}</b>\n"
            f"  IP: <code>{ev.source_ip}</code> | Time: <code>{ts}</code>\n"
            f"  Path: <code>{html.escape(ev.request_path[:40])}</code>\n"
        )
    await _send_msg(client, chat_id, "\n".join(lines), reply_markup=_quick_nav_inline(is_admin=is_admin))


async def handle_alerts_toggle(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str, arg: str = ""
) -> None:
    """Protected: Toggle user's alert delivery with one-tap inline buttons."""
    is_super = user_id == admin_id
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == user_id))
        user = res.scalar_one_or_none()
        if not is_super and (not user or user.status != "approved"):
            await _send_msg(client, chat_id, "⛔ Access Denied. Approved authorization required.")
            return
        if not user and is_super:
            user = TelegramUser(
                id=uuid.uuid4(), telegram_id=user_id,
                role="super_admin", status="approved", is_subscribed=True,
            )
            session.add(user)

        arg = arg.strip().lower()
        if arg == "on":
            user.is_subscribed = True
        elif arg == "off":
            user.is_subscribed = False
        else:
            user.is_subscribed = not user.is_subscribed

        await session.commit()
        state = "ENABLED" if user.is_subscribed else "MUTED"
        emoji = "🔔" if user.is_subscribed else "🔕"

    toggle_markup = {
        "inline_keyboard": [
            [
                {"text": "🔔 Enable Alerts" if not user.is_subscribed else "🔕 Mute Alerts", "callback_data": "cmd:alerts_toggle"},
                {"text": "📊 Stats", "callback_data": "cmd:stats"},
            ],
            [
                {"text": "🏠 Main Menu", "callback_data": "cmd:menu"},
            ],
        ]
    }
    await _send_msg(
        client, chat_id,
        f"{emoji} Live incident alert delivery: <b>{state}</b>\n<i>Tap button below to toggle at any time:</i>",
        reply_markup=toggle_markup,
    )


# ---------------------------------------------------------------------------
# Super Administrator & Administrator Management Commands
# ---------------------------------------------------------------------------

async def handle_promote(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str, target_id: str
) -> None:
    """Super Admin only: Promote an approved user to Administrator."""
    if user_id != admin_id:
        await _send_msg(client, chat_id, "⛔ Unauthorized: Only the Super Administrator can promote users to Administrator.")
        await _log_audit_event("UNAUTHORIZED_SUPER_ADMIN_COMMAND", target_id, user_id, {"command": "/promote"})
        return

    target_id = target_id.strip()
    if not target_id or not target_id.isdigit():
        await _send_msg(client, chat_id, "⚠️ Usage: <code>/promote &lt;numeric_user_id&gt;</code>")
        return

    if target_id == admin_id:
        await _send_msg(client, chat_id, "ℹ️ You are already the Super Administrator.")
        return

    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == target_id))
        user = res.scalar_one_or_none()
        if not user:
            await _send_msg(client, chat_id, f"❓ No user found with ID <code>{target_id}</code>. User must register first.")
            return

        if user.role == "admin" and user.status == "approved":
            await _send_msg(client, chat_id, f"ℹ️ User <code>{target_id}</code> is already an Administrator.")
            return

        user.role = "admin"
        user.status = "approved"
        user.is_subscribed = True
        user.promoted_by = admin_id
        user.promoted_at = now
        await session.commit()
        target_name = _display_name(user)

    await _log_audit_event("TELEGRAM_USER_PROMOTED_ADMIN", target_id, admin_id, {"promoted_by": admin_id})

    nav = {
        "inline_keyboard": [
            [
                {"text": "🔍 View Profile", "callback_data": f"info:{target_id}"},
                {"text": "🔻 Demote to Analyst", "callback_data": f"demote:{target_id}"},
            ],
            [
                {"text": "👥 All Users", "callback_data": "cmd:users"},
                {"text": "🏠 Main Menu", "callback_data": "cmd:menu"},
            ],
        ]
    }
    await _send_msg(
        client, chat_id,
        f"⭐ User <code>{target_id}</code> (<b>{html.escape(target_name)}</b>) has been <b>PROMOTED TO ADMINISTRATOR</b>.\n"
        "They now have access to analyst audits and authorizations.",
        reply_markup=nav,
    )
    # Notify the promoted user
    await _send_msg(
        client, target_id,
        "⭐ <b>PROMOTED TO ADMINISTRATOR</b>\n\n"
        "You have been granted Administrator privileges by the Super Administrator.\n"
        "You can now manage analyst requests and review platform security telemetry.",
        reply_markup=_secondary_admin_reply_keyboard(),
    )


async def handle_demote(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str, target_id: str
) -> None:
    """Super Admin only: Demote an Administrator back to standard Analyst."""
    if user_id != admin_id:
        await _send_msg(client, chat_id, "⛔ Unauthorized: Only the Super Administrator can demote Administrators.")
        await _log_audit_event("UNAUTHORIZED_SUPER_ADMIN_COMMAND", target_id, user_id, {"command": "/demote"})
        return

    target_id = target_id.strip()
    if not target_id or not target_id.isdigit():
        await _send_msg(client, chat_id, "⚠️ Usage: <code>/demote &lt;numeric_user_id&gt;</code>")
        return

    if target_id == admin_id:
        await _send_msg(client, chat_id, "⚠️ Action refused: Cannot demote the Super Administrator.")
        return

    async with AsyncSessionLocal() as session:
        res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == target_id))
        user = res.scalar_one_or_none()
        if not user:
            await _send_msg(client, chat_id, f"❓ No user found with ID <code>{target_id}</code>.")
            return

        if user.role != "admin":
            await _send_msg(client, chat_id, f"ℹ️ User <code>{target_id}</code> is not an Administrator (current role: <code>{user.role}</code>).")
            return

        user.role = "user"
        user.promoted_by = None
        user.promoted_at = None
        await session.commit()
        target_name = _display_name(user)

    await _log_audit_event("TELEGRAM_USER_DEMOTED_USER", target_id, admin_id, {"demoted_by": admin_id})

    nav = {
        "inline_keyboard": [
            [
                {"text": "🔍 View Profile", "callback_data": f"info:{target_id}"},
                {"text": "⭐ Re-Promote", "callback_data": f"promote:{target_id}"},
            ],
            [
                {"text": "👥 All Users", "callback_data": "cmd:users"},
                {"text": "🏠 Main Menu", "callback_data": "cmd:menu"},
            ],
        ]
    }
    await _send_msg(
        client, chat_id,
        f"🔻 Administrator <code>{target_id}</code> (<b>{html.escape(target_name)}</b>) has been <b>DEMOTED TO ANALYST</b>.",
        reply_markup=nav,
    )
    # Notify demoted user
    await _send_msg(
        client, target_id,
        "ℹ️ <b>ADMINISTRATOR PRIVILEGES REVOKED</b>\n\n"
        "Your role has been updated to Analyst by the Super Administrator.",
        reply_markup=_analyst_reply_keyboard(),
    )


async def handle_lockdown_prompt(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str
) -> None:
    """Super Admin only: Show emergency lockdown confirmation dialog with buttons."""
    if user_id != admin_id:
        await _send_msg(client, chat_id, "⛔ Unauthorized: Only the Super Administrator can execute platform lockdown.")
        return

    text = (
        "🚨 <b>CONFIRM EMERGENCY LOCKDOWN</b>\n\n"
        "Are you sure you want to execute an emergency platform lockdown?\n\n"
        "• <b>All non-administrator analyst accounts will be immediately REVOKED.</b>\n"
        "• <b>Live alert notifications will be restricted to Administrators only.</b>\n"
        "• <b>Non-admin analyst access will be BLOCKED.</b>\n\n"
        "<i>Tap a button below to execute or cancel:</i>"
    )
    markup = {
        "inline_keyboard": [
            [
                {"text": "🚨 Yes, Execute Lockdown", "callback_data": "cmd:lockdown_confirm"},
                {"text": "❌ Cancel", "callback_data": "cmd:lockdown_cancel"},
            ]
        ]
    }
    await _send_msg(client, chat_id, text, reply_markup=markup)


async def handle_lockdown(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str
) -> None:
    """Super Admin only: Emergency lockdown — revoke all non-admin analyst accounts."""
    if user_id != admin_id:
        await _send_msg(client, chat_id, "⛔ Unauthorized: Only the Super Administrator can execute platform lockdown.")
        await _log_audit_event("UNAUTHORIZED_SUPER_ADMIN_COMMAND", "LOCKDOWN", user_id, {"command": "/lockdown"})
        return

    now = datetime.now(timezone.utc)
    revoked_count = 0
    async with AsyncSessionLocal() as session:
        # Revoke non-admin users (preserve secondary admins and super admin)
        res = await session.execute(
            select(TelegramUser).where(TelegramUser.telegram_id != admin_id, TelegramUser.role == "user")
        )
        users = res.scalars().all()
        for u in users:
            if u.status != "revoked":
                u.status = "revoked"
                u.is_subscribed = False
                u.revoked_by = admin_id
                u.revoked_at = now
                revoked_count += 1
        await session.commit()

    await _log_audit_event("EMERGENCY_LOCKDOWN_EXECUTED", admin_id, admin_id, {"revoked_count": revoked_count})
    summary_nav = {
        "inline_keyboard": [
            [
                {"text": "👥 Manage Users", "callback_data": "cmd:users"},
                {"text": "🛡️ Platform Status", "callback_data": "cmd:status"},
            ],
            [
                {"text": "🏠 Main Menu", "callback_data": "cmd:menu"},
            ],
        ]
    }
    await _send_msg(
        client,
        chat_id,
        f"🚨 <b>EMERGENCY LOCKDOWN COMPLETE</b>\n\n"
        f"• Revoked non-admin accounts: <code>{revoked_count}</code>\n"
        f"• Alert delivery: <b>RESTRICTED TO ADMINISTRATORS ONLY</b>\n"
        f"• Non-admin command access: <b>BLOCKED</b>",
        reply_markup=summary_nav,
    )


async def handle_users(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str
) -> None:
    """Admin & Super Admin: List all registered Telegram users with interactive action buttons."""
    is_super = user_id == admin_id
    async with AsyncSessionLocal() as session:
        caller_res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == user_id))
        caller = caller_res.scalar_one_or_none()
        is_admin = is_super or (caller is not None and caller.role == "admin" and caller.status == "approved")

        if not is_admin:
            await _send_msg(client, chat_id, "⛔ Unauthorized: Administrator privilege required.")
            await _log_audit_event("UNAUTHORIZED_ADMIN_COMMAND", "/users", user_id, {"command": "/users"})
            return

        res = await session.execute(select(TelegramUser).order_by(TelegramUser.registered_at))
        users = res.scalars().all()

    if not users:
        await _send_msg(client, chat_id, "No Telegram users registered.")
        return

    for u in users:
        is_target_super = u.telegram_id == admin_id
        badge = _role_badge(u.role, is_super=is_target_super)
        sub   = "🔔 ON" if u.is_subscribed else "🔕 OFF"
        name  = _display_name(u)
        semoji = _status_emoji(u.status)
        registered = u.registered_at.strftime("%Y-%m-%d") if u.registered_at else "—"
        last_seen  = u.last_seen.strftime("%Y-%m-%d %H:%M UTC") if u.last_seen else "never"
        last_cmd   = html.escape(u.last_command or "—")

        card = (
            f"{semoji} <b>{html.escape(name)}</b>\n"
            f"<b>ID:</b> <code>{u.telegram_id}</code>\n"
            f"<b>Role:</b> <code>{badge}</code> | <b>Status:</b> <b>{u.status.upper()}</b>\n"
            f"<b>Alerts:</b> {sub} | <b>Commands:</b> <code>{u.command_count or 0}</code>\n"
            f"<b>Joined:</b> <code>{registered}</code> | <b>Last seen:</b> <code>{last_seen}</code>\n"
            f"<b>Last action:</b> <code>{last_cmd}</code>"
        )

        # Inline action buttons based on hierarchy
        if is_target_super:
            markup = None
        elif is_super:
            # Super Admin sees full control buttons
            buttons = [{"text": "🔍 Info", "callback_data": f"info:{u.telegram_id}"}]
            if u.role == "admin":
                buttons.append({"text": "🔻 Demote", "callback_data": f"demote:{u.telegram_id}"})
                buttons.append({"text": "🔒 Revoke", "callback_data": f"revoke:{u.telegram_id}"})
                buttons.append({"text": "🗑 Delete", "callback_data": f"delete:{u.telegram_id}"})
            elif u.status == "approved":
                buttons.append({"text": "⭐ Make Admin", "callback_data": f"promote:{u.telegram_id}"})
                buttons.append({"text": "🔒 Revoke", "callback_data": f"revoke:{u.telegram_id}"})
                buttons.append({"text": "🗑 Delete", "callback_data": f"delete:{u.telegram_id}"})
            elif u.status in ("pending", "revoked", "rejected"):
                buttons.append({"text": "✅ Approve", "callback_data": f"approve:{u.telegram_id}"})
                buttons.append({"text": "🗑 Delete", "callback_data": f"delete:{u.telegram_id}"})
            markup = {"inline_keyboard": [buttons]}
        else:
            # Secondary Admin viewing: cannot modify other Admins or Super Admin
            buttons = [{"text": "🔍 Info", "callback_data": f"info:{u.telegram_id}"}]
            if u.role == "admin":
                pass
            elif u.status == "approved":
                buttons.append({"text": "🔒 Revoke", "callback_data": f"revoke:{u.telegram_id}"})
            elif u.status in ("pending", "revoked", "rejected"):
                buttons.append({"text": "✅ Approve", "callback_data": f"approve:{u.telegram_id}"})
            markup = {"inline_keyboard": [buttons]}

        await _send_msg(client, chat_id, card, reply_markup=markup)

    # Footer navigation toolbar
    footer_row = [{"text": "🔄 Refresh User List", "callback_data": "cmd:users"}]
    if is_super:
        footer_row.append({"text": "🚨 Emergency Lockdown", "callback_data": "cmd:lockdown_prompt"})
    footer_markup = {
        "inline_keyboard": [
            footer_row,
            [{"text": "🏠 Main Menu", "callback_data": "cmd:menu"}],
        ]
    }
    await _send_msg(
        client, chat_id,
        f"👥 <b>Total Registered:</b> <code>{len(users)}</code> accounts\n"
        "<i>Tap buttons above to inspect details, promote, approve, revoke, or delete accounts.</i>",
        reply_markup=footer_markup,
    )


async def handle_userinfo(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str, target_id: str
) -> None:
    """Admin & Super Admin: Show full profile and command history for a specific user."""
    is_super = user_id == admin_id
    async with AsyncSessionLocal() as session:
        caller_res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == user_id))
        caller = caller_res.scalar_one_or_none()
        is_admin = is_super or (caller is not None and caller.role == "admin" and caller.status == "approved")

        if not is_admin:
            await _send_msg(client, chat_id, "⛔ Unauthorized: Administrator privilege required.")
            await _log_audit_event("UNAUTHORIZED_ADMIN_COMMAND", target_id, user_id, {"command": "/userinfo"})
            return

        target_id = target_id.strip()
        if not target_id or not target_id.isdigit():
            await _send_msg(client, chat_id, "⚠️ Usage: <code>/userinfo &lt;numeric_user_id&gt;</code>")
            return

        res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == target_id))
        u = res.scalar_one_or_none()

    if not u:
        await _send_msg(client, chat_id, f"❓ No user found with ID <code>{target_id}</code>.")
        return

    is_target_super = u.telegram_id == admin_id
    badge  = _role_badge(u.role, is_super=is_target_super)
    semoji = _status_emoji(u.status)
    name   = _display_name(u)

    full_name_parts = [u.first_name or "", u.last_name or ""]
    full_name = " ".join(p for p in full_name_parts if p).strip() or "—"

    registered  = u.registered_at.strftime("%Y-%m-%d %H:%M:%S UTC") if u.registered_at else "—"
    last_seen   = u.last_seen.strftime("%Y-%m-%d %H:%M:%S UTC") if u.last_seen else "never"
    approved_at = u.approved_at.strftime("%Y-%m-%d %H:%M UTC") if u.approved_at else "—"
    revoked_at  = u.revoked_at.strftime("%Y-%m-%d %H:%M UTC") if u.revoked_at else "—"
    promoted_at = u.promoted_at.strftime("%Y-%m-%d %H:%M UTC") if u.promoted_at else "—"

    profile = (
        f"🔍 <b>ARGUS USER PROFILE & TELEMETRY</b>\n\n"
        f"{semoji} <b>Display:</b> {html.escape(name)}\n"
        f"<b>Full Name:</b> {html.escape(full_name)}\n"
        f"<b>Username:</b> {'@' + html.escape(u.username) if u.username else '—'}\n"
        f"<b>Telegram ID:</b> <code>{u.telegram_id}</code>\n\n"
        f"<b>Role:</b> <code>{badge}</code>\n"
        f"<b>Status:</b> <code>{u.status.upper()}</code>\n"
        f"<b>Alerts:</b> {'🔔 ON' if u.is_subscribed else '🔕 OFF'}\n\n"
        f"<b>Registered:</b> <code>{registered}</code>\n"
        f"<b>Approved by:</b> <code>{u.approved_by or '—'}</code> at <code>{approved_at}</code>\n"
    )

    if u.promoted_by:
        profile += f"<b>Promoted to Admin by:</b> <code>{u.promoted_by}</code> at <code>{promoted_at}</code>\n"
    if u.revoked_by:
        profile += f"<b>Revoked by:</b> <code>{u.revoked_by}</code> at <code>{revoked_at}</code>\n"

    profile += (
        f"\n<b>Commands sent:</b> <code>{u.command_count or 0}</code>\n"
        f"<b>Last seen:</b> <code>{last_seen}</code>\n"
        f"<b>Last command:</b> <code>{html.escape(u.last_command or '—')}</code>"
    )

    try:
        history: List[Dict[str, str]] = json.loads(u.command_history or "[]")
    except (json.JSONDecodeError, TypeError):
        history = []

    if history:
        profile += "\n\n<b>📋 Recent Command History:</b>\n"
        for i, entry in enumerate(history, 1):
            profile += f"  {i}. <code>{html.escape(entry.get('cmd', '?'))}</code> — <i>{entry.get('ts', '')}</i>\n"
    else:
        profile += "\n\n<i>No command history recorded yet.</i>"

    # Action buttons
    markup = None
    if not is_target_super:
        actions = []
        if is_super:
            if u.role == "admin":
                actions.append({"text": "🔻 Demote to Analyst", "callback_data": f"demote:{target_id}"})
            elif u.status == "approved":
                actions.append({"text": "⭐ Promote to Admin", "callback_data": f"promote:{target_id}"})

            if u.status in ("pending", "revoked", "rejected"):
                actions.append({"text": "✅ Approve", "callback_data": f"approve:{target_id}"})
            if u.status == "approved":
                actions.append({"text": "🔒 Revoke", "callback_data": f"revoke:{target_id}"})
            actions.append({"text": "🗑 Delete", "callback_data": f"delete:{target_id}"})
        else:
            # Secondary admin
            if u.role != "admin":
                if u.status in ("pending", "revoked", "rejected"):
                    actions.append({"text": "✅ Approve", "callback_data": f"approve:{target_id}"})
                if u.status == "approved":
                    actions.append({"text": "🔒 Revoke", "callback_data": f"revoke:{target_id}"})

        nav_row = [
            {"text": "👥 All Users", "callback_data": "cmd:users"},
            {"text": "🏠 Main Menu", "callback_data": "cmd:menu"},
        ]
        markup = {"inline_keyboard": [actions, nav_row] if actions else [nav_row]}
    else:
        markup = {
            "inline_keyboard": [[
                {"text": "👥 All Users", "callback_data": "cmd:users"},
                {"text": "🏠 Main Menu", "callback_data": "cmd:menu"},
            ]]
        }

    await _send_msg(client, chat_id, profile, reply_markup=markup)


async def handle_approve(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str, target_id: str
) -> None:
    """Admin & Super Admin: Approve a user."""
    is_super = user_id == admin_id
    async with AsyncSessionLocal() as session:
        caller_res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == user_id))
        caller = caller_res.scalar_one_or_none()
        is_admin = is_super or (caller is not None and caller.role == "admin" and caller.status == "approved")

        if not is_admin:
            await _send_msg(client, chat_id, "⛔ Unauthorized: Administrator privilege required.")
            await _log_audit_event("UNAUTHORIZED_ADMIN_COMMAND", target_id, user_id, {"command": "/approve"})
            return

        target_id = target_id.strip()
        if not target_id or not target_id.isdigit():
            await _send_msg(client, chat_id, "⚠️ Usage: <code>/approve &lt;numeric_user_id&gt;</code>")
            return

        res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == target_id))
        user = res.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if not user:
            user = TelegramUser(
                id=uuid.uuid4(), telegram_id=target_id,
                role="user", status="approved", is_subscribed=True,
                registered_at=now, approved_by=user_id, approved_at=now,
            )
            session.add(user)
        else:
            user.status = "approved"
            user.is_subscribed = True
            user.approved_by = user_id
            user.approved_at = now
            user.revoked_at = None
            user.revoked_by = None
        await session.commit()

    await _log_audit_event("TELEGRAM_USER_APPROVED", target_id, user_id, {"target_id": target_id})
    action_nav = {
        "inline_keyboard": [
            [
                {"text": "🔍 View Profile", "callback_data": f"info:{target_id}"},
                {"text": "🔒 Revoke", "callback_data": f"revoke:{target_id}"},
            ],
            [
                {"text": "👥 All Users", "callback_data": "cmd:users"},
                {"text": "🏠 Main Menu", "callback_data": "cmd:menu"},
            ],
        ]
    }
    await _send_msg(
        client, chat_id,
        f"✅ User <code>{target_id}</code> has been <b>APPROVED</b>. Telemetry and alert delivery enabled.",
        reply_markup=action_nav,
    )
    await _send_msg(
        client, target_id,
        "🛡️ <b>ARGUS AUTHORIZATION APPROVED</b>\n\n"
        "Your access request has been approved by an Administrator.\n"
        "You now have access to /status, /stats, /events, and will receive live security alerts.",
        reply_markup=_analyst_reply_keyboard(),
    )


async def handle_reject(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str, target_id: str
) -> None:
    """Admin & Super Admin: Reject a pending user."""
    is_super = user_id == admin_id
    async with AsyncSessionLocal() as session:
        caller_res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == user_id))
        caller = caller_res.scalar_one_or_none()
        is_admin = is_super or (caller is not None and caller.role == "admin" and caller.status == "approved")

        if not is_admin:
            await _send_msg(client, chat_id, "⛔ Unauthorized: Administrator privilege required.")
            await _log_audit_event("UNAUTHORIZED_ADMIN_COMMAND", target_id, user_id, {"command": "/reject"})
            return

        target_id = target_id.strip()
        if not target_id or not target_id.isdigit():
            await _send_msg(client, chat_id, "⚠️ Usage: <code>/reject &lt;numeric_user_id&gt;</code>")
            return

        res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == target_id))
        user = res.scalar_one_or_none()
        if user:
            user.status = "rejected"
            user.is_subscribed = False
            await session.commit()

    await _log_audit_event("TELEGRAM_USER_REJECTED", target_id, user_id, {"target_id": target_id})
    await _send_msg(client, chat_id, f"❌ User <code>{target_id}</code> has been <b>REJECTED</b>.")
    await _send_msg(client, target_id, "⛔ <b>REGISTRATION REJECTED</b>\nYour ARGUS bot registration was declined by an Administrator.")


async def handle_revoke(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str, target_id: str
) -> None:
    """Admin & Super Admin: Revoke a user's access."""
    is_super = user_id == admin_id

    target_id = target_id.strip()
    if not target_id or not target_id.isdigit():
        await _send_msg(client, chat_id, "⚠️ Usage: <code>/revoke &lt;numeric_user_id&gt;</code>")
        return

    if target_id == admin_id:
        await _send_msg(client, chat_id, "⚠️ Action refused: Cannot revoke the Super Administrator.")
        return

    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        caller_res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == user_id))
        caller = caller_res.scalar_one_or_none()
        is_admin = is_super or (caller is not None and caller.role == "admin" and caller.status == "approved")

        if not is_admin:
            await _send_msg(client, chat_id, "⛔ Unauthorized: Administrator privilege required.")
            await _log_audit_event("UNAUTHORIZED_ADMIN_COMMAND", target_id, user_id, {"command": "/revoke"})
            return

        res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == target_id))
        user = res.scalar_one_or_none()

        # Secondary admin cannot revoke fellow admins
        if not is_super and user and user.role in ("admin", "super_admin"):
            await _send_msg(client, chat_id, "⛔ Action refused: Only the Super Administrator can revoke Administrator accounts.")
            return

        if not user:
            user = TelegramUser(
                id=uuid.uuid4(), telegram_id=target_id, role="user", status="revoked",
                is_subscribed=False, registered_at=now, revoked_by=user_id, revoked_at=now,
            )
            session.add(user)
        else:
            user.status = "revoked"
            user.is_subscribed = False
            user.revoked_by = user_id
            user.revoked_at = now
        await session.commit()

    await _log_audit_event("TELEGRAM_USER_REVOKED", target_id, user_id, {"target_id": target_id})
    action_nav = {
        "inline_keyboard": [
            [
                {"text": "✅ Re-Approve", "callback_data": f"approve:{target_id}"},
                {"text": "🗑 Delete User", "callback_data": f"delete:{target_id}"},
            ],
            [
                {"text": "👥 All Users", "callback_data": "cmd:users"},
                {"text": "🏠 Main Menu", "callback_data": "cmd:menu"},
            ],
        ]
    }
    await _send_msg(
        client, chat_id,
        f"🔒 User <code>{target_id}</code> has been <b>REVOKED</b>. Telemetry access and alerts terminated immediately.",
        reply_markup=action_nav,
    )
    await _send_msg(client, target_id, "⛔ <b>ACCESS REVOKED</b>\nYour ARGUS bot authorization has been revoked by an Administrator.")


async def handle_delete(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str, target_id: str
) -> None:
    """Super Admin only: Permanently delete a user record from the bot database."""
    if user_id != admin_id:
        await _send_msg(client, chat_id, "⛔ Unauthorized: Only the Super Administrator can permanently delete user records.")
        await _log_audit_event("UNAUTHORIZED_SUPER_ADMIN_COMMAND", target_id, user_id, {"command": "/delete"})
        return

    target_id = target_id.strip()
    if not target_id or not target_id.isdigit():
        await _send_msg(client, chat_id, "⚠️ Usage: <code>/delete &lt;numeric_user_id&gt;</code>")
        return

    if target_id == admin_id:
        await _send_msg(client, chat_id, "⚠️ Action refused: Cannot delete the administrator account (Super Administrator).")
        return

    async with AsyncSessionLocal() as session:
        res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == target_id))
        user = res.scalar_one_or_none()

        if not user:
            await _send_msg(client, chat_id, f"❓ No user found with ID <code>{target_id}</code>. Nothing to delete.")
            return

        saved_name = _display_name(user)
        await session.execute(delete(TelegramUser).where(TelegramUser.telegram_id == target_id))
        await session.commit()

    await _log_audit_event(
        "TELEGRAM_USER_DELETED", target_id, admin_id,
        {"target_id": target_id, "display_name": saved_name, "deleted_by": admin_id},
    )
    nav_markup = {
        "inline_keyboard": [
            [
                {"text": "👥 All Users", "callback_data": "cmd:users"},
                {"text": "🏠 Main Menu", "callback_data": "cmd:menu"},
            ]
        ]
    }
    await _send_msg(
        client, chat_id,
        f"🗑 User <code>{target_id}</code> (<b>{html.escape(saved_name)}</b>) has been <b>PERMANENTLY DELETED</b> from the bot.\n"
        "Audit logs are preserved. The user will be re-registered as <code>PENDING</code> if they send /start again.",
        reply_markup=nav_markup,
    )
    await _send_msg(
        client, target_id,
        "🗑 <b>ACCOUNT REMOVED</b>\n\n"
        "Your ARGUS bot account has been removed by the Super Administrator.\n"
        "Send /start to submit a new registration request.",
    )


# ---------------------------------------------------------------------------
# Button Text Translation Map
# ---------------------------------------------------------------------------

BUTTON_COMMAND_MAP: Dict[str, str] = {
    "🛡️ status": "/status",
    "🛡️ platform status": "/status",
    "status": "/status",
    "📊 stats": "/stats",
    "📊 threat stats": "/stats",
    "stats": "/stats",
    "🚨 events": "/events",
    "🚨 trapped events": "/events",
    "events": "/events",
    "🔔 toggle alerts": "/alerts",
    "🔔 alerts": "/alerts",
    "alerts": "/alerts",
    "👥 manage users": "/users",
    "👥 manage users & admins": "/users",
    "👥 manage analysts": "/users",
    "👥 users": "/users",
    "users": "/users",
    "🚨 emergency lockdown": "/lockdown_prompt",
    "🔒 lockdown": "/lockdown_prompt",
    "lockdown": "/lockdown_prompt",
    "🏠 main menu": "/start",
    "main menu": "/start",
    "menu": "/start",
    "/menu": "/start",
}


# ---------------------------------------------------------------------------
# Message Dispatcher & Update Processing
# ---------------------------------------------------------------------------

async def process_update(client: httpx.AsyncClient, update: Dict[str, Any]) -> None:
    """Process a single Telegram update with strict server-side validation."""
    admin_id = settings.telegram_admin_numeric_id
    if not admin_id:
        logger.error("Telegram bot update dropped: Administrator numeric ID is missing or invalid.")
        return

    # 1. Handle Callback Queries (inline button clicks)
    if "callback_query" in update:
        cb         = update["callback_query"]
        cb_id      = cb["id"]
        from_user  = cb.get("from", {})
        cb_user_id = str(from_user.get("id"))
        data       = cb.get("data", "")
        chat_id    = str(cb.get("message", {}).get("chat", {}).get("id", cb_user_id))

        is_super = cb_user_id == admin_id

        # Check caller admin role from database
        async with AsyncSessionLocal() as session:
            c_res = await session.execute(select(TelegramUser).where(TelegramUser.telegram_id == cb_user_id))
            caller_rec = c_res.scalar_one_or_none()
            is_admin = is_super or (caller_rec is not None and caller_rec.role == "admin" and caller_rec.status == "approved")

        # Super Admin only promotions / demotions
        if data.startswith("promote:"):
            if not is_super:
                await _answer_callback(client, cb_id, "⛔ Super Administrator only", alert=True)
                return
            target = data.split(":", 1)[1]
            await handle_promote(client, chat_id, cb_user_id, admin_id, target)
            await _answer_callback(client, cb_id, f"⭐ Promoted {target}")
            return
        elif data.startswith("demote:"):
            if not is_super:
                await _answer_callback(client, cb_id, "⛔ Super Administrator only", alert=True)
                return
            target = data.split(":", 1)[1]
            await handle_demote(client, chat_id, cb_user_id, admin_id, target)
            await _answer_callback(client, cb_id, f"🔻 Demoted {target}")
            return

        # General user management callbacks
        if data.startswith("approve:"):
            if not is_admin:
                await _answer_callback(client, cb_id, "⛔ Unauthorized: Admin only", alert=True)
                return
            target = data.split(":", 1)[1]
            await handle_approve(client, chat_id, cb_user_id, admin_id, target)
            await _answer_callback(client, cb_id, f"✅ Approved {target}")
            return
        elif data.startswith("reject:"):
            if not is_admin:
                await _answer_callback(client, cb_id, "⛔ Unauthorized: Admin only", alert=True)
                return
            target = data.split(":", 1)[1]
            await handle_reject(client, chat_id, cb_user_id, admin_id, target)
            await _answer_callback(client, cb_id, f"❌ Rejected {target}")
            return
        elif data.startswith("revoke:"):
            if not is_admin:
                await _answer_callback(client, cb_id, "⛔ Unauthorized: Admin only", alert=True)
                return
            target = data.split(":", 1)[1]
            await handle_revoke(client, chat_id, cb_user_id, admin_id, target)
            await _answer_callback(client, cb_id, f"🔒 Revoked {target}")
            return
        elif data.startswith("delete:"):
            if not is_super:
                await _answer_callback(client, cb_id, "⛔ Super Administrator only", alert=True)
                return
            target = data.split(":", 1)[1]
            await handle_delete(client, chat_id, cb_user_id, admin_id, target)
            await _answer_callback(client, cb_id, f"🗑 Deleted {target}")
            return
        elif data.startswith("info:"):
            if not is_admin:
                await _answer_callback(client, cb_id, "⛔ Unauthorized: Admin only", alert=True)
                return
            target = data.split(":", 1)[1]
            await handle_userinfo(client, chat_id, cb_user_id, admin_id, target)
            await _answer_callback(client, cb_id, f"🔍 Profile {target}")
            return

        # General operational command callbacks
        if data == "cmd:status":
            await _answer_callback(client, cb_id, "Loading Status...")
            await handle_status(client, chat_id, cb_user_id, admin_id)
            return
        elif data == "cmd:stats":
            await _answer_callback(client, cb_id, "Loading Stats...")
            await handle_stats(client, chat_id, cb_user_id, admin_id)
            return
        elif data == "cmd:events":
            await _answer_callback(client, cb_id, "Loading Events...")
            await handle_events(client, chat_id, cb_user_id, admin_id)
            return
        elif data == "cmd:alerts_toggle":
            await _answer_callback(client, cb_id, "Toggling Alerts...")
            await handle_alerts_toggle(client, chat_id, cb_user_id, admin_id, "toggle")
            return
        elif data == "cmd:users":
            if not is_admin:
                await _answer_callback(client, cb_id, "⛔ Unauthorized: Admin only", alert=True)
                return
            await _answer_callback(client, cb_id, "Auditing Users...")
            await handle_users(client, chat_id, cb_user_id, admin_id)
            return
        elif data == "cmd:lockdown_prompt":
            if not is_super:
                await _answer_callback(client, cb_id, "⛔ Super Administrator only", alert=True)
                return
            await _answer_callback(client, cb_id, "Lockdown confirmation")
            await handle_lockdown_prompt(client, chat_id, cb_user_id, admin_id)
            return
        elif data == "cmd:lockdown_confirm":
            if not is_super:
                await _answer_callback(client, cb_id, "⛔ Super Administrator only", alert=True)
                return
            await _answer_callback(client, cb_id, "Executing Emergency Lockdown...")
            await handle_lockdown(client, chat_id, cb_user_id, admin_id)
            return
        elif data == "cmd:lockdown_cancel":
            await _answer_callback(client, cb_id, "Lockdown cancelled")
            await _send_msg(client, chat_id, "✅ Emergency lockdown cancelled.", reply_markup=_quick_nav_inline(is_admin=is_super))
            return
        elif data in ("cmd:menu", "cmd:refresh_menu"):
            await _answer_callback(client, cb_id, "Refreshing Menu...")
            await handle_start(client, from_user, chat_id, cb_user_id, admin_id)
            return

        return

    # 2. Handle Standard Messages (commands or persistent keyboard button taps)
    msg = update.get("message")
    if not msg:
        return

    from_user = msg.get("from")
    if not from_user:
        return

    user_id = str(from_user.get("id"))
    chat_id = str(msg.get("chat", {}).get("id"))
    text    = (msg.get("text") or "").strip()

    # Intercept custom persistent reply keyboard button taps
    clean_lower = text.lower().strip()
    if clean_lower in BUTTON_COMMAND_MAP:
        text = BUTTON_COMMAND_MAP[clean_lower]

    if not text.startswith("/"):
        return

    parts = text.split()
    cmd   = parts[0].lower().split("@")[0]   # strip bot @handle if present
    arg   = parts[1] if len(parts) > 1 else ""

    # Record activity sequentially if command is not /start (which records activity internally)
    if cmd != "/start":
        await _record_activity(user_id, cmd)

    if cmd == "/start":
        await handle_start(client, from_user, chat_id, user_id, admin_id)
    elif cmd == "/status":
        await handle_status(client, chat_id, user_id, admin_id)
    elif cmd == "/stats":
        await handle_stats(client, chat_id, user_id, admin_id)
    elif cmd == "/events":
        await handle_events(client, chat_id, user_id, admin_id)
    elif cmd == "/alerts":
        await handle_alerts_toggle(client, chat_id, user_id, admin_id, arg)
    elif cmd == "/users":
        await handle_users(client, chat_id, user_id, admin_id)
    elif cmd == "/userinfo":
        await handle_userinfo(client, chat_id, user_id, admin_id, arg)
    elif cmd == "/promote":
        await handle_promote(client, chat_id, user_id, admin_id, arg)
    elif cmd == "/demote":
        await handle_demote(client, chat_id, user_id, admin_id, arg)
    elif cmd == "/approve":
        await handle_approve(client, chat_id, user_id, admin_id, arg)
    elif cmd == "/reject":
        await handle_reject(client, chat_id, user_id, admin_id, arg)
    elif cmd == "/revoke":
        await handle_revoke(client, chat_id, user_id, admin_id, arg)
    elif cmd == "/delete":
        await handle_delete(client, chat_id, user_id, admin_id, arg)
    elif cmd == "/lockdown":
        await handle_lockdown(client, chat_id, user_id, admin_id)
    elif cmd == "/lockdown_prompt":
        await handle_lockdown_prompt(client, chat_id, user_id, admin_id)
    elif cmd in ("/help", "/menu"):
        await handle_start(client, from_user, chat_id, user_id, admin_id)


# ---------------------------------------------------------------------------
# Polling runner
# ---------------------------------------------------------------------------

async def run_telegram_bot_poller() -> None:
    """Long-polling runner for the ARGUS Telegram bot."""
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.info("Telegram bot poller skipped: TELEGRAM_BOT_TOKEN not configured.")
        return

    admin_id = settings.telegram_admin_numeric_id
    if not admin_id:
        logger.error("FAIL CLOSED: Telegram bot poller will not start: TELEGRAM_ADMIN_ID is missing or invalid.")
        return

    logger.info(f"Starting ARGUS Telegram Incident Command Bot — Super Admin active (Super Admin ID: {admin_id})")

    offset = 0
    async with httpx.AsyncClient(timeout=35.0) as client:
        while not _shutdown_event.is_set():
            try:
                resp = await client.post(
                    f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getUpdates",
                    json={"offset": offset, "timeout": 20, "allowed_updates": ["message", "callback_query"]},
                )
                if resp.status_code == 200:
                    data    = resp.json()
                    updates = data.get("result", [])
                    for u in updates:
                        offset = max(offset, u["update_id"] + 1)
                        try:
                            await process_update(client, u)
                        except Exception as update_err:
                            logger.error(f"Error processing Telegram update {u.get('update_id')}: {update_err}")
                elif resp.status_code == 409:
                    logger.warning("Telegram bot conflict: another instance running getUpdates. Backing off...")
                    await asyncio.sleep(10)
                else:
                    logger.warning(f"Telegram getUpdates returned {resp.status_code}: {resp.text}")
                    await asyncio.sleep(5)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Telegram polling loop exception: {e}")
                await asyncio.sleep(5)

    logger.info("ARGUS Telegram Bot poller stopped.")


def start_telegram_bot_task() -> Optional[asyncio.Task]:
    """Start background Telegram bot poller task if not already running."""
    global _bot_task, _shutdown_event
    _shutdown_event.clear()
    if _bot_task is None or _bot_task.done():
        _bot_task = asyncio.create_task(run_telegram_bot_poller())
    return _bot_task


async def stop_telegram_bot_task() -> None:
    """Stop the background Telegram bot poller task."""
    global _bot_task, _shutdown_event
    _shutdown_event.set()
    if _bot_task and not _bot_task.done():
        _bot_task.cancel()
        try:
            await _bot_task
        except asyncio.CancelledError:
            pass
    _bot_task = None
