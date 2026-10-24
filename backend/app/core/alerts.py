"""Telegram alert dispatcher for critical, high, and medium-severity security events with multi-recipient broadcast."""

import asyncio
import html
import httpx
from app.config import settings
from app.logging_config import logger

_SEVERITY_EMOJI = {
    "critical": "\U0001f534",   # 🔴
    "high":     "\U0001f7e0",   # 🟠
    "medium":   "\U0001f7e1",   # 🟡
    "low":      "\U0001f7e2",   # 🟢
}


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
    Send a Telegram notification for a security event.
    Broadcasts to all chat IDs configured in TELEGRAM_CHAT_ID (supports comma-separated IDs).
    """
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        return

    chat_ids = [cid.strip() for cid in settings.TELEGRAM_CHAT_ID.split(",") if cid.strip()]
    if not chat_ids:
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
