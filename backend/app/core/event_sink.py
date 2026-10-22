"""Event sink abstraction for decoy security event persistence.

Task 3 of the decoy-split spec (R5.1).

EventSink          — abstract interface: async persist(objects)
DbEventSink        — default: opens an AsyncSessionLocal, adds objects, commits.
                     Preserves the exact behavior that record_root_trap had before.
get_event_sink()   — returns the active module-level sink (DbEventSink by default).
set_event_sink()   — replaces it (used by decoy_main.py to install ForwardingEventSink).
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List


class EventSink(ABC):
    """Abstract base class for event persistence backends."""

    @abstractmethod
    async def persist(
        self,
        objects: List[Any],
        broadcast_summary: Dict[str, Any] | None = None,
    ) -> None:
        """Persist a list of ORM-like objects and optionally broadcast a WS summary.

        objects        — one SecurityEvent, optionally followed by a LoginAttempt
                         or CapturedFile that references it via event_id.
        broadcast_summary — if provided, broadcast this dict to connected dashboards
                            after persisting.
        """


class DbEventSink(EventSink):
    """Persists events directly to the database via AsyncSessionLocal.

    This is the default sink used by app.main:app (all-in-one mode) and keeps
    the exact behavior of the original record_root_trap / decoy.py code:
    open a session, add objects, commit, then broadcast.
    """

    async def persist(
        self,
        objects: List[Any],
        broadcast_summary: Dict[str, Any] | None = None,
    ) -> None:
        from app.database import AsyncSessionLocal
        from app.core.websocket_manager import ws_manager

        async with AsyncSessionLocal() as session:
            for obj in objects:
                session.add(obj)
            await session.commit()

        if broadcast_summary:
            await ws_manager.broadcast_event(broadcast_summary)


# ---------------------------------------------------------------------------
# Module-level singleton — DbEventSink by default; replaced by decoy_main.py
# ---------------------------------------------------------------------------
_event_sink: EventSink = DbEventSink()


def get_event_sink() -> EventSink:
    """Returns the currently active event sink."""
    return _event_sink


def set_event_sink(sink: EventSink) -> None:
    """Replaces the active event sink (called once at application startup)."""
    global _event_sink
    _event_sink = sink
