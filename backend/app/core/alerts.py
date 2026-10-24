"""Telegram alert dispatcher for critical and high-severity security events."""

import httpx
from app.config import settings
from app.logging_config import logger

_SEVERITY_EMOJI = {
    "critical": "\U0001f534",   # 🔴
    "high":     "\U0001f7e0",   # 🟠
    "medium":   "\U0001f7e1",   # 🟡
    "low":      "\U0001f7e2",   # 🟢
}


async def send_telegram_alert(
    event_type: str,
    severity: str,
    source_ip: str,
    summary: str,
    event_id: str,
) -> None:
    """
    Send a Telegram notification for a critical or high-severity event.
    Silently no-ops when TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured.
    """
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        return

    emoji = _SEVERITY_EMOJI.get(severity, "\u26aa")
    message = (
        f"{emoji} *ARGUS SECURITY ALERT*\n\n"
        f"*Severity:* `{severity.upper()}`\n"
        f"*Event Type:* `{event_type}`\n"
        f"*Source IP:* `{source_ip}`\n"
        f"*Summary:* {summary[:200]}\n"
        f"*Event ID:* `{event_id}`\n\n"
        f"_Review in ARGUS SOC Dashboard_"
    )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": settings.TELEGRAM_CHAT_ID,
                    "text": message,
                    "parse_mode": "Markdown",
                },
            )
            logger.info(f"Telegram alert sent for event {event_id} ({severity})")
    except Exception as exc:
        logger.warning(f"Telegram alert dispatch failed for event {event_id}: {exc}")
