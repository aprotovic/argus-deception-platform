"""WebSocket Connection Manager for live SOC operations streaming."""

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
        """Broadcasts a newly ingested security event to all connected dashboards."""
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
