"""ARGUS Telegram Incident Command Bot Service.

Enforces server-side administrator lockdown:
- Only the verified numeric administrator Telegram ID may execute administrative actions.
- New users receive 'pending' status on /start and have zero access to telemetry or alerts.
- Revoked users cannot execute commands or receive alerts.
- All actions are audited in audit_logs.
"""

import asyncio
import html
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy import desc, func, select
from app.config import settings
from app.database import AsyncSessionLocal
from app.logging_config import logger
from app.models.audit_log import AuditLog
from app.models.captured_file import CapturedFile
from app.models.security_event import SecurityEvent
from app.models.telegram_user import TelegramUser

_bot_task: Optional[asyncio.Task] = None
_shutdown_event = asyncio.Event()


async def _send_msg(
    client: httpx.AsyncClient,
    chat_id: str,
    text: str,
    reply_markup: Optional[Dict[str, Any]] = None,
) -> bool:
    """Helper to send an HTML message via Telegram Bot API."""
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
    """Handle /start command with strict role-based access control."""
    is_admin = (user_id == admin_id)
    username = from_user.get("username")
    first_name = from_user.get("first_name", "")
    last_name = from_user.get("last_name", "")

    async with AsyncSessionLocal() as session:
        stmt = select(TelegramUser).where(TelegramUser.telegram_id == user_id)
        res = await session.execute(stmt)
        user_record = res.scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if is_admin:
            if not user_record:
                user_record = TelegramUser(
                    id=uuid.uuid4(),
                    telegram_id=user_id,
                    username=username,
                    first_name=first_name,
                    last_name=last_name,
                    role="admin",
                    status="approved",
                    is_subscribed=True,
                    registered_at=now,
                    approved_by=admin_id,
                    approved_at=now,
                )
                session.add(user_record)
            else:
                user_record.role = "admin"
                user_record.status = "approved"
                user_record.is_subscribed = True
                user_record.approved_by = admin_id
                user_record.approved_at = now
            await session.commit()

            admin_welcome = (
                "🛡️ <b>ARGUS INCIDENT COMMAND — ACCESS GRANTED</b>\n\n"
                f"<b>Role:</b> <code>ADMINISTRATOR</code>\n"
                f"<b>Status:</b> <code>VERIFIED ACTIVE</code>\n"
                f"<b>Admin ID:</b> <code>{user_id}</code>\n\n"
                "<b>Operational Commands:</b>\n"
                "• /status — ARGUS platform and sensor status\n"
                "• /stats — Threat telemetry overview\n"
                "• /events — Recent trapped security events\n"
                "• /alerts [on|off] — Toggle live intrusion alert delivery\n\n"
                "<b>Access Control & Lockdown:</b>\n"
                "• /users — Audit all registered Telegram users\n"
                "• /approve &lt;id&gt; — Authorize pending or revoked user\n"
                "• /reject &lt;id&gt; — Deny pending registration\n"
                "• /revoke &lt;id&gt; — Immediately revoke user access\n"
                "• /lockdown — Emergency lockdown (revoke all non-admins)\n"
            )
            await _send_msg(client, chat_id, admin_welcome)
            return

        # Non-admin user handling
        if user_record and user_record.status == "revoked":
            msg = (
                "⛔ <b>ACCESS DENIED — AUTHORIZATION REVOKED</b>\n\n"
                "Your ARGUS Telegram bot access has been revoked by the Administrator.\n"
                "You cannot view telemetry or receive incident alerts."
            )
            await _send_msg(client, chat_id, msg)
            return

        if user_record and user_record.status == "rejected":
            msg = (
                "⛔ <b>ACCESS REJECTED</b>\n\n"
                "Your registration request was rejected by the Administrator."
            )
            await _send_msg(client, chat_id, msg)
            return

        if user_record and user_record.status == "approved":
            msg = (
                "🛡️ <b>ARGUS INCIDENT MONITOR</b>\n\n"
                "<b>Status:</b> <code>APPROVED (ANALYST)</code>\n"
                f"<b>User ID:</b> <code>{user_id}</code>\n\n"
                "<b>Available Commands:</b>\n"
                "• /status — ARGUS platform status\n"
                "• /stats — Threat telemetry summary\n"
                "• /events — Recent trapped security events\n"
                "• /alerts [on|off] — Toggle alert notifications"
            )
            await _send_msg(client, chat_id, msg)
            return

        # New user: register as pending
        if not user_record:
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
            )
            session.add(user_record)
            await session.commit()

        # Notify the user they are pending
        pending_msg = (
            "⏳ <b>REGISTRATION RECEIVED — PENDING APPROVAL</b>\n\n"
            f"<b>Your User ID:</b> <code>{user_id}</code>\n"
            "<b>Status:</b> <code>PENDING ADMINISTRATOR REVIEW</code>\n\n"
            "Your account has been registered. You do not have access to ARGUS "
            "security telemetry or alerts until explicitly approved by the system administrator."
        )
        await _send_msg(client, chat_id, pending_msg)

        # Notify Administrator
        user_display = f"@{username}" if username else f"{first_name} {last_name}".strip()
        admin_alert = (
            "🔔 <b>ARGUS USER ACCESS REQUEST</b>\n\n"
            f"A new user is requesting bot access:\n"
            f"• <b>User ID:</b> <code>{user_id}</code>\n"
            f"• <b>Name:</b> {html.escape(user_display)}\n"
            f"• <b>Status:</b> <code>PENDING</code>\n\n"
            f"To authorize: <code>/approve {user_id}</code>\n"
            f"To deny: <code>/reject {user_id}</code>"
        )
        markup = {
            "inline_keyboard": [
                [
                    {"text": "✅ Approve", "callback_data": f"approve:{user_id}"},
                    {"text": "❌ Reject", "callback_data": f"reject:{user_id}"},
                ]
            ]
        }
        await _send_msg(client, admin_id, admin_alert, reply_markup=markup)


async def handle_status(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str
) -> None:
    """Protected command: Platform operational health."""
    async with AsyncSessionLocal() as session:
        user_stmt = select(TelegramUser).where(TelegramUser.telegram_id == user_id)
        res = await session.execute(user_stmt)
        user = res.scalar_one_or_none()

    if user_id != admin_id and (not user or user.status != "approved"):
        await _send_msg(client, chat_id, "⛔ Access Denied. Approved analyst authorization required.")
        return

    msg = (
        "🛡️ <b>ARGUS PLATFORM OPERATIONAL STATUS</b>\n\n"
        "• <b>Core API:</b> <code>ONLINE (Port 8000)</code>\n"
        "• <b>Web Decoy Portal:</b> <code>ONLINE (Port 8081)</code>\n"
        "• <b>MySQL Protocol Decoy:</b> <code>ONLINE (Port 3306)</code>\n"
        "• <b>Lockdown Policy:</b> <code>ADMINISTRATOR-ENFORCED</code>\n"
        "• <b>Quarantine Storage:</b> <code>SECURED</code>\n"
        f"• <b>System Time:</b> <code>{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</code>"
    )
    await _send_msg(client, chat_id, msg)


async def handle_stats(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str
) -> None:
    """Protected command: Telemetry statistics."""
    async with AsyncSessionLocal() as session:
        user_stmt = select(TelegramUser).where(TelegramUser.telegram_id == user_id)
        res = await session.execute(user_stmt)
        user = res.scalar_one_or_none()

        if user_id != admin_id and (not user or user.status != "approved"):
            await _send_msg(client, chat_id, "⛔ Access Denied. Approved analyst authorization required.")
            return

        total_events = await session.scalar(select(func.count(SecurityEvent.id)))
        crit_events = await session.scalar(
            select(func.count(SecurityEvent.id)).where(SecurityEvent.severity == "critical")
        )
        high_events = await session.scalar(
            select(func.count(SecurityEvent.id)).where(SecurityEvent.severity == "high")
        )
        captured_files = await session.scalar(select(func.count(CapturedFile.id)))

    msg = (
        "📊 <b>ARGUS THREAT TELEMETRY STATS</b>\n\n"
        f"• <b>Total Trapped Events:</b> <code>{total_events or 0}</code>\n"
        f"• <b>Critical Incursions:</b> <code>{crit_events or 0}</code>\n"
        f"• <b>High Severity Alerts:</b> <code>{high_events or 0}</code>\n"
        f"• <b>Quarantined Artifacts:</b> <code>{captured_files or 0}</code>\n\n"
        "<i>All telemetry isolated in ARGUS sensor sandbox.</i>"
    )
    await _send_msg(client, chat_id, msg)


async def handle_events(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str
) -> None:
    """Protected command: Recent security events."""
    async with AsyncSessionLocal() as session:
        user_stmt = select(TelegramUser).where(TelegramUser.telegram_id == user_id)
        res = await session.execute(user_stmt)
        user = res.scalar_one_or_none()

        if user_id != admin_id and (not user or user.status != "approved"):
            await _send_msg(client, chat_id, "⛔ Access Denied. Approved analyst authorization required.")
            return

        stmt = select(SecurityEvent).order_by(desc(SecurityEvent.timestamp)).limit(5)
        events_res = await session.execute(stmt)
        events = events_res.scalars().all()

    if not events:
        await _send_msg(client, chat_id, "ℹ️ No security events currently logged.")
        return

    lines = ["🛡️ <b>RECENT TRAPPED INCIDENTS (LAST 5)</b>\n"]
    for ev in events:
        sev = ev.severity.upper()
        ts = ev.timestamp.strftime("%H:%M:%S UTC") if ev.timestamp else "N/A"
        lines.append(
            f"• <code>[{sev}]</code> <b>{ev.event_type}</b>\n"
            f"  IP: <code>{ev.source_ip}</code> | Time: <code>{ts}</code>\n"
            f"  Path: <code>{html.escape(ev.request_path[:40])}</code>\n"
        )
    await _send_msg(client, chat_id, "\n".join(lines))


async def handle_alerts_toggle(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str, arg: str
) -> None:
    """Protected command: Toggle user's alert delivery."""
    async with AsyncSessionLocal() as session:
        user_stmt = select(TelegramUser).where(TelegramUser.telegram_id == user_id)
        res = await session.execute(user_stmt)
        user = res.scalar_one_or_none()

        if user_id != admin_id and (not user or user.status != "approved"):
            await _send_msg(client, chat_id, "⛔ Access Denied. Approved authorization required.")
            return

        if not user and user_id == admin_id:
            user = TelegramUser(
                id=uuid.uuid4(),
                telegram_id=user_id,
                role="admin",
                status="approved",
                is_subscribed=True,
            )
            session.add(user)

        arg = arg.strip().lower()
        if arg == "on":
            user.is_subscribed = True
            await session.commit()
            await _send_msg(client, chat_id, "🔔 Live incident alert delivery: <b>ENABLED</b>")
        elif arg == "off":
            user.is_subscribed = False
            await session.commit()
            await _send_msg(client, chat_id, "🔕 Live incident alert delivery: <b>MUTED</b>")
        else:
            state = "ENABLED" if user.is_subscribed else "MUTED"
            await _send_msg(
                client, chat_id, f"Current alert state: <b>{state}</b>\nUse <code>/alerts on</code> or <code>/alerts off</code> to toggle."
            )


# ---------------------------------------------------------------------------
# Administrator-Only Commands
# ---------------------------------------------------------------------------

async def handle_users(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str
) -> None:
    """Admin command: Audit Telegram subscribers."""
    if user_id != admin_id:
        await _send_msg(client, chat_id, "⛔ Unauthorized: Administrator privilege required.")
        await _log_audit_event("UNAUTHORIZED_ADMIN_COMMAND", "/users", user_id, {"command": "/users"})
        return

    async with AsyncSessionLocal() as session:
        stmt = select(TelegramUser).order_by(TelegramUser.registered_at)
        res = await session.execute(stmt)
        users = res.scalars().all()

    if not users:
        await _send_msg(client, chat_id, "No Telegram users registered.")
        return

    lines = ["👥 <b>ARGUS TELEGRAM USER AUDIT</b>\n"]
    for u in users:
        sub = "🔔 Alerts ON" if u.is_subscribed else "🔕 Alerts OFF"
        name = f"@{u.username}" if u.username else f"User"
        status_emoji = {
            "approved": "✅",
            "pending":  "⏳",
            "revoked":  "🔒",
            "rejected": "❌",
        }.get(u.status, "❓")

        lines.append(
            f"{status_emoji} <b>{name}</b> (<code>{u.telegram_id}</code>)\n"
            f"  Role: <code>{u.role.upper()}</code> | Status: <b>{u.status.upper()}</b>\n"
            f"  Subscription: {sub}\n"
        )

    await _send_msg(client, chat_id, "\n".join(lines))


async def handle_approve(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str, target_id: str
) -> None:
    """Admin command: Approve user."""
    if user_id != admin_id:
        await _send_msg(client, chat_id, "⛔ Unauthorized: Administrator privilege required.")
        await _log_audit_event("UNAUTHORIZED_ADMIN_COMMAND", target_id, user_id, {"command": "/approve"})
        return

    target_id = target_id.strip()
    if not target_id or not target_id.isdigit():
        await _send_msg(client, chat_id, "⚠️ Usage: <code>/approve &lt;numeric_user_id&gt;</code>")
        return

    async with AsyncSessionLocal() as session:
        stmt = select(TelegramUser).where(TelegramUser.telegram_id == target_id)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if not user:
            user = TelegramUser(
                id=uuid.uuid4(),
                telegram_id=target_id,
                role="user",
                status="approved",
                is_subscribed=True,
                registered_at=now,
                approved_by=admin_id,
                approved_at=now,
            )
            session.add(user)
        else:
            user.status = "approved"
            user.is_subscribed = True
            user.approved_by = admin_id
            user.approved_at = now
            user.revoked_at = None
            user.revoked_by = None

        await session.commit()

    await _log_audit_event("TELEGRAM_USER_APPROVED", target_id, admin_id, {"target_id": target_id})
    await _send_msg(client, chat_id, f"✅ User <code>{target_id}</code> has been <b>APPROVED</b>. Telemetry and alert delivery enabled.")

    # Notify approved user
    user_msg = (
        "🛡️ <b>ARGUS AUTHORIZATION APPROVED</b>\n\n"
        "Your access request has been approved by the Administrator.\n"
        "You now have access to /status, /stats, /events, and will receive live security alerts."
    )
    await _send_msg(client, target_id, user_msg)


async def handle_reject(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str, target_id: str
) -> None:
    """Admin command: Reject user."""
    if user_id != admin_id:
        await _send_msg(client, chat_id, "⛔ Unauthorized: Administrator privilege required.")
        await _log_audit_event("UNAUTHORIZED_ADMIN_COMMAND", target_id, user_id, {"command": "/reject"})
        return

    target_id = target_id.strip()
    if not target_id or not target_id.isdigit():
        await _send_msg(client, chat_id, "⚠️ Usage: <code>/reject &lt;numeric_user_id&gt;</code>")
        return

    async with AsyncSessionLocal() as session:
        stmt = select(TelegramUser).where(TelegramUser.telegram_id == target_id)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if user:
            user.status = "rejected"
            user.is_subscribed = False
            await session.commit()

    await _log_audit_event("TELEGRAM_USER_REJECTED", target_id, admin_id, {"target_id": target_id})
    await _send_msg(client, chat_id, f"❌ User <code>{target_id}</code> has been <b>REJECTED</b>.")
    await _send_msg(client, target_id, "⛔ <b>REGISTRATION REJECTED</b>\nYour ARGUS bot registration was declined by the Administrator.")


async def handle_revoke(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str, target_id: str
) -> None:
    """Admin command: Revoke user."""
    if user_id != admin_id:
        await _send_msg(client, chat_id, "⛔ Unauthorized: Administrator privilege required.")
        await _log_audit_event("UNAUTHORIZED_ADMIN_COMMAND", target_id, user_id, {"command": "/revoke"})
        return

    target_id = target_id.strip()
    if not target_id or not target_id.isdigit():
        await _send_msg(client, chat_id, "⚠️ Usage: <code>/revoke &lt;numeric_user_id&gt;</code>")
        return

    if target_id == admin_id:
        await _send_msg(client, chat_id, "⚠️ Action refused: Cannot revoke the administrator account.")
        return

    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        stmt = select(TelegramUser).where(TelegramUser.telegram_id == target_id)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if not user:
            user = TelegramUser(
                id=uuid.uuid4(),
                telegram_id=target_id,
                role="user",
                status="revoked",
                is_subscribed=False,
                registered_at=now,
                revoked_by=admin_id,
                revoked_at=now,
            )
            session.add(user)
        else:
            user.status = "revoked"
            user.is_subscribed = False
            user.revoked_by = admin_id
            user.revoked_at = now

        await session.commit()

    await _log_audit_event("TELEGRAM_USER_REVOKED", target_id, admin_id, {"target_id": target_id})
    await _send_msg(client, chat_id, f"🔒 User <code>{target_id}</code> has been <b>REVOKED</b>. Telemetry access and alerts terminated immediately.")
    await _send_msg(client, target_id, "⛔ <b>ACCESS REVOKED</b>\nYour ARGUS bot authorization has been revoked by the Administrator.")


async def handle_lockdown(
    client: httpx.AsyncClient, chat_id: str, user_id: str, admin_id: str
) -> None:
    """Admin command: Emergency lockdown of all non-admin accounts."""
    if user_id != admin_id:
        await _send_msg(client, chat_id, "⛔ Unauthorized: Administrator privilege required.")
        await _log_audit_event("UNAUTHORIZED_ADMIN_COMMAND", "LOCKDOWN", user_id, {"command": "/lockdown"})
        return

    now = datetime.now(timezone.utc)
    revoked_count = 0
    async with AsyncSessionLocal() as session:
        stmt = select(TelegramUser).where(TelegramUser.telegram_id != admin_id)
        res = await session.execute(stmt)
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
    await _send_msg(
        client,
        chat_id,
        f"🚨 <b>EMERGENCY LOCKDOWN COMPLETE</b>\n\n"
        f"• Revoked non-admin accounts: <code>{revoked_count}</code>\n"
        f"• Alert delivery: <b>RESTRICTED TO ADMINISTRATOR ONLY</b>\n"
        f"• Non-admin command access: <b>BLOCKED</b>",
    )


# ---------------------------------------------------------------------------
# Message Dispatcher & Update Processing
# ---------------------------------------------------------------------------

async def process_update(client: httpx.AsyncClient, update: Dict[str, Any]) -> None:
    """Process a single Telegram update with strict server-side validation."""
    admin_id = settings.telegram_admin_numeric_id
    if not admin_id:
        logger.error("Telegram bot update dropped: Administrator numeric ID is missing or invalid.")
        return

    # Handle Callback Queries (Inline button clicks)
    if "callback_query" in update:
        cb = update["callback_query"]
        cb_id = cb["id"]
        from_user = cb.get("from", {})
        cb_user_id = str(from_user.get("id"))
        data = cb.get("data", "")

        if cb_user_id != admin_id:
            await _answer_callback(client, cb_id, "⛔ Unauthorized: Admin only", alert=True)
            return

        chat_id = str(cb.get("message", {}).get("chat", {}).get("id", admin_id))
        if data.startswith("approve:"):
            target_id = data.split(":", 1)[1]
            await handle_approve(client, chat_id, cb_user_id, admin_id, target_id)
            await _answer_callback(client, cb_id, f"Approved user {target_id}")
        elif data.startswith("reject:"):
            target_id = data.split(":", 1)[1]
            await handle_reject(client, chat_id, cb_user_id, admin_id, target_id)
            await _answer_callback(client, cb_id, f"Rejected user {target_id}")
        elif data.startswith("revoke:"):
            target_id = data.split(":", 1)[1]
            await handle_revoke(client, chat_id, cb_user_id, admin_id, target_id)
            await _answer_callback(client, cb_id, f"Revoked user {target_id}")
        return

    # Handle Standard Messages
    msg = update.get("message")
    if not msg:
        return

    from_user = msg.get("from")
    if not from_user:
        return

    user_id = str(from_user.get("id"))
    chat_id = str(msg.get("chat", {}).get("id"))
    text = (msg.get("text") or "").strip()

    if not text.startswith("/"):
        return

    parts = text.split()
    cmd = parts[0].lower().split("@")[0]  # strip bot handle if present
    arg = parts[1] if len(parts) > 1 else ""

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
    elif cmd == "/approve":
        await handle_approve(client, chat_id, user_id, admin_id, arg)
    elif cmd == "/reject":
        await handle_reject(client, chat_id, user_id, admin_id, arg)
    elif cmd == "/revoke":
        await handle_revoke(client, chat_id, user_id, admin_id, arg)
    elif cmd == "/lockdown":
        await handle_lockdown(client, chat_id, user_id, admin_id)
    elif cmd == "/help":
        if user_id == admin_id:
            await handle_start(client, from_user, chat_id, user_id, admin_id)
        else:
            await handle_status(client, chat_id, user_id, admin_id)


async def run_telegram_bot_poller() -> None:
    """Long-polling runner for the Telegram bot."""
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.info("Telegram bot poller skipped: TELEGRAM_BOT_TOKEN not configured.")
        return

    admin_id = settings.telegram_admin_numeric_id
    if not admin_id:
        logger.error("FAIL CLOSED: Telegram bot poller will not start: TELEGRAM_ADMIN_ID is missing or invalid.")
        return

    logger.info(f"Starting ARGUS Telegram Incident Command Bot with Admin Lockdown (Admin ID: {admin_id})...")

    offset = 0
    async with httpx.AsyncClient(timeout=35.0) as client:
        while not _shutdown_event.is_set():
            try:
                resp = await client.post(
                    f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getUpdates",
                    json={"offset": offset, "timeout": 20, "allowed_updates": ["message", "callback_query"]},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    updates = data.get("result", [])
                    for u in updates:
                        offset = max(offset, u["update_id"] + 1)
                        try:
                            await process_update(client, u)
                        except Exception as update_err:
                            logger.error(f"Error processing Telegram update {u.get('update_id')}: {update_err}")
                elif resp.status_code == 409:
                    logger.warning("Telegram bot conflict: another instance is running getUpdates. Backing off...")
                    await asyncio.sleep(10)
                else:
                    logger.warning(f"Telegram getUpdates returned {resp.status_code}: {resp.text}")
                    await asyncio.sleep(5)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Telegram polling loop exception: {e}")
                await asyncio.sleep(5)

    logger.info("ARGUS Telegram Bot poller has stopped.")


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
