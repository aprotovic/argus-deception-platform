"""WebSocket router for real-time telemetry streaming to SOC dashboards."""

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from app.core.security import decode_access_token
from app.core.websocket_manager import ws_manager
from app.logging_config import logger

router = APIRouter(tags=["WebSocket Stream"])


@router.websocket("/ws/events")
async def websocket_events_endpoint(
    websocket: WebSocket,
    token: str = Query(None),
):
    """
    Real-time streaming endpoint for SOC operations dashboards.
    Requires valid JWT token query param to establish connection.
    """
    # Authenticate token
    if not token:
        await websocket.close(code=1008, reason="Authentication token required")
        return

    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=1008, reason="Invalid access token")
        return

    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; accept client ping / messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type": "PONG"}')
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error: {str(e)}")
        ws_manager.disconnect(websocket)
