"""Unit tests for the event sink abstraction (task 3, decoy-split spec).

Tests cover:
- DbEventSink persists objects and broadcasts summary
- get_event_sink / set_event_sink accessors return the right sink
- Default sink is DbEventSink (all-in-one mode unchanged)
- Custom sink can be installed and called
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.event_sink import (
    EventSink,
    DbEventSink,
    get_event_sink,
    set_event_sink,
)


def test_default_sink_is_db_event_sink():
    """The module-level sink must be DbEventSink by default."""
    sink = get_event_sink()
    assert isinstance(sink, DbEventSink)


def test_set_event_sink_replaces_active_sink():
    """set_event_sink must replace the active sink and get_event_sink returns it."""

    class FakeSink(EventSink):
        async def persist(self, objects, broadcast_summary=None):
            pass

    fake = FakeSink()
    original = get_event_sink()
    try:
        set_event_sink(fake)
        assert get_event_sink() is fake
    finally:
        set_event_sink(original)

    assert get_event_sink() is original


def test_event_sink_is_abstract():
    """EventSink cannot be instantiated directly."""
    with pytest.raises(TypeError):
        EventSink()


@pytest.mark.asyncio
async def test_db_event_sink_persists_objects_and_broadcasts():
    """DbEventSink opens a session, adds all objects, commits, and broadcasts."""
    fake_obj_1 = MagicMock()
    fake_obj_2 = MagicMock()
    broadcast = {"id": "test-1", "event_type": "recon_probe"}

    fake_session = AsyncMock()
    fake_session.add = MagicMock()  # session.add is synchronous
    fake_session.__aenter__ = AsyncMock(return_value=fake_session)
    fake_session.__aexit__ = AsyncMock(return_value=None)

    fake_ws_manager = AsyncMock()

    with patch("app.database.AsyncSessionLocal", return_value=fake_session), \
         patch("app.core.websocket_manager.ws_manager", fake_ws_manager):
        sink = DbEventSink()
        await sink.persist([fake_obj_1, fake_obj_2], broadcast_summary=broadcast)

    fake_session.add.assert_any_call(fake_obj_1)
    fake_session.add.assert_any_call(fake_obj_2)
    fake_session.commit.assert_awaited_once()
    fake_ws_manager.broadcast_event.assert_awaited_once_with(broadcast)


@pytest.mark.asyncio
async def test_db_event_sink_no_broadcast_when_summary_is_none():
    """When broadcast_summary is None, broadcast must not be called."""
    fake_obj = MagicMock()

    fake_session = AsyncMock()
    fake_session.add = MagicMock()  # session.add is synchronous
    fake_session.__aenter__ = AsyncMock(return_value=fake_session)
    fake_session.__aexit__ = AsyncMock(return_value=None)

    fake_ws_manager = AsyncMock()

    with patch("app.database.AsyncSessionLocal", return_value=fake_session), \
         patch("app.core.websocket_manager.ws_manager", fake_ws_manager):
        sink = DbEventSink()
        await sink.persist([fake_obj])

    fake_session.add.assert_called_once_with(fake_obj)
    fake_session.commit.assert_awaited_once()
    fake_ws_manager.broadcast_event.assert_not_awaited()
