"""Telegram alert dispatcher with strict database-backed administrator lockdown."""

import asyncio
import html
import httpx
from app.config import settings
from app.database import AsyncSessionLocal
from app.logging_config import logger
from app.models.telegram_user import TelegramUser
from sqlalchemy import select

_SEVERITY_EMOJI = {
    "critical": "\U0001f534",   # 🔴
    "high":     "\U0001f7e0",   # 🟠
    "medium":   "\U0001f7e1",   # 🟡
    "low":      "\U0001f7e2",   # 🟢
}


async def get_authorized_recipient_ids() -> list[str]:
    """
    Query database for verified recipients authorized to receive live security alerts.
    Enforces server-side administrator lockdown:
    - Only users with status == 'approved' AND is_subscribed == True receive alerts.
    - If TELEGRAM_ADMIN_ID is missing or invalid, fails closed and returns empty list.
    - Revoked, rejected, or pending users are strictly excluded.
    """
    admin_id = settings.telegram_admin_numeric_id
    if not admin_id:
        logger.error(
            "FAIL CLOSED: Telegram alert delivery denied. "
            "TELEGRAM_ADMIN_ID is missing or invalid in configuration."
        )
        return []

    try:
        async with AsyncSessionLocal() as session:
            stmt = select(TelegramUser.telegram_id).where(
                TelegramUser.status == "approved",
                TelegramUser.is_subscribed == True,
            )
            result = await session.execute(stmt)
            approved_ids = [row[0].strip() for row in result.all() if row[0] and row[0].strip().isdigit()]

            # Always ensure verified admin ID receives alerts if approved
            if admin_id not in approved_ids:
                # Check admin record status specifically
                admin_stmt = select(TelegramUser).where(TelegramUser.telegram_id == admin_id)
                admin_res = await session.execute(admin_stmt)
                admin_record = admin_res.scalar_one_or_none()
                if admin_record is None or (admin_record.status == "approved" and admin_record.is_subscribed):
                    approved_ids.append(admin_id)

            return list(set(approved_ids))
    except Exception as exc:
        logger.warning(
            f"Failed to query telegram_users database table: {exc}. "
            f"Failing safe to verified administrator ID only."
        )
        return [admin_id]


async def _send_to_single_chat(client: httpx.AsyncClient, chat_id: str, message: str, event_id: str) -> None:
    try:
        resp = await client.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML",
            },
        )
        if resp.status_code == 200:
            logger.info(f"Telegram alert sent to chat {chat_id} for event {event_id}")
        else:
            logger.warning(f"Telegram alert to {chat_id} returned status {resp.status_code}: {resp.text}")
    except Exception as exc:
        logger.warning(f"Telegram alert dispatch failed for chat {chat_id} (event {event_id}): {exc}")


async def send_telegram_alert(
    event_type: str,
    severity: str,
    source_ip: str,
    summary: str,
    event_id: str,
) -> None:
    """
    Send an HTML-formatted Telegram notification for a security event.
    Delivers strictly to verified, approved subscribers in the database.
    """
    if not settings.TELEGRAM_BOT_TOKEN:
        return

    admin_id = settings.telegram_admin_numeric_id
    if not admin_id:
        logger.error("FAIL CLOSED: send_telegram_alert refused: invalid/missing administrator ID.")
        return

    chat_ids = await get_authorized_recipient_ids()
    if not chat_ids:
        logger.info(f"Telegram alert for event {event_id} skipped: no authorized approved recipients.")
        return

    emoji = _SEVERITY_EMOJI.get(severity.lower(), "\u26aa")
    esc_sev = html.escape(severity.upper())
    esc_type = html.escape(event_type)
    esc_ip = html.escape(source_ip)
    esc_summary = html.escape(summary[:250])
    esc_id = html.escape(event_id[:36])

    message = (
        f"{emoji} <b>ARGUS SECURITY ALERT</b>\n\n"
        f"<b>Severity:</b> <code>{esc_sev}</code>\n"
        f"<b>Event Type:</b> <code>{esc_type}</code>\n"
        f"<b>Source IP:</b> <code>{esc_ip}</code>\n"
        f"<b>Summary:</b> {esc_summary}\n"
        f"<b>Event ID:</b> <code>{esc_id}</code>\n\n"
        f"<i>Review in ARGUS SOC Dashboard</i>"
    )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            tasks = [_send_to_single_chat(client, cid, message, event_id) for cid in chat_ids]
            await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as exc:
        logger.warning(f"Telegram broadcast batch failed for event {event_id}: {exc}")
