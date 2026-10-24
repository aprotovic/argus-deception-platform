"""WebSocket Connection Manager for live SOC operations streaming with Telegram alert integration."""

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Set
from fastapi import WebSocket
from app.logging_config import logger


class WebSocketManager:
    """Manages active WebSocket connections from SOC monitoring dashboards."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        """Accepts and stores an authenticated WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(
            f"WebSocket client connected. Active clients: {len(self.active_connections)}"
        )
        # Send initial handshake message
        await websocket.send_text(
            json.dumps(
                {
                    "type": "CONNECTION_ESTABLISHED",
                    "server_time": datetime.now(timezone.utc).isoformat(),
                    "message": "Connected to ARGUS live attack stream",
                }
            )
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Removes a disconnected WebSocket client."""
        self.active_connections.discard(websocket)
        logger.info(
            f"WebSocket client disconnected. Remaining clients: {len(self.active_connections)}"
        )

    async def broadcast_event(self, event_data: Dict[str, Any]) -> None:
        """Broadcasts a newly ingested security event to all connected dashboards and fires alerts."""
        # 1. Trigger Telegram alert for critical, high, and medium severity events (non-test)
        severity = str(event_data.get("severity", "low")).lower()
        is_test = bool(event_data.get("is_test_event", False))
        if severity in ("critical", "high", "medium") and not is_test:
            try:
                from app.core.alerts import send_telegram_alert
                event_type = str(event_data.get("event_type", "unknown"))
                source_ip = str(event_data.get("source_ip", "unknown"))
                summary = str(event_data.get("summary", event_data.get("request_path", "Security event detected")))
                event_id = str(event_data.get("id", "alert"))
                asyncio.create_task(
                    send_telegram_alert(
                        event_type=event_type,
                        severity=severity,
                        source_ip=source_ip,
                        summary=summary,
                        event_id=event_id,
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to dispatch Telegram alert from WebSocketManager: {e}")

        # 2. Forward to connected dashboard WebSocket clients
        if not self.active_connections:
            return

        payload = json.dumps(
            {
                "type": "NEW_SECURITY_EVENT",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "event": event_data,
            }
        )

        dead_connections: List[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warning(f"Failed to send to WebSocket client: {str(e)}")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)


ws_manager = WebSocketManager()
