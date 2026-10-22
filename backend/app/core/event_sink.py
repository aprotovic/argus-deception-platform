"""Event sink abstraction for decoy security event persistence.

Tasks 3 and 6 of the decoy-split spec (R5.1, R3.1, R4).

EventSink              — abstract interface: async persist(objects)
DbEventSink             — default: opens AsyncSessionLocal, adds, commits.
ForwardingEventSink    — serializes objects to wire format, queues for an
                         async worker that POSTs batches to the backend.
                         On failure: spool to JSONL, backoff, replay.
EventForwarderSession  — adapter used as get_db override in decoy_main.py.
                         add() buffers, commit() hands to the sink,
                         refresh()/rollback() are no-ops.

get_event_sink()/set_event_sink() — module-level accessors.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict, List, Optional

from app.logging_config import logger


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------
class EventSink(ABC):
    """Abstract base class for event persistence backends."""

    @abstractmethod
    async def persist(
        self,
        objects: List[Any],
        broadcast_summary: Dict[str, Any] | None = None,
    ) -> None:
        """Persist a list of ORM-like objects and optionally broadcast a WS summary."""


# ---------------------------------------------------------------------------
# DbEventSink (default — all-in-one mode)
# ---------------------------------------------------------------------------
class DbEventSink(EventSink):
    """Persists events directly to the database via AsyncSessionLocal."""

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
# Serialization helpers
# ---------------------------------------------------------------------------
def _serialize_event(obj: Any) -> Dict[str, Any]:
    """Serialize a SecurityEvent ORM-like object to wire format."""
    return {
        "id": str(obj.id) if obj.id else str(uuid.uuid4()),
        "decoy_service_id": str(obj.decoy_service_id) if obj.decoy_service_id else None,
        "timestamp": (obj.timestamp.isoformat() if isinstance(obj.timestamp, datetime)
                      else str(obj.timestamp)),
        "source_ip": str(obj.source_ip)[:45],
        "source_port": obj.source_port,
        "http_method": str(obj.http_method)[:10],
        "request_path": str(obj.request_path)[:1024],
        "query_params": obj.query_params if isinstance(obj.query_params, dict) else {},
        "headers_sanitized": obj.headers_sanitized if isinstance(obj.headers_sanitized, dict) else {},
        "user_agent": str(obj.user_agent or "")[:500],
        "event_type": str(obj.event_type)[:50],
        "severity": str(obj.severity)[:20],
        "is_test_event": bool(obj.is_test_event),
        "correlation_id": str(obj.correlation_id)[:64] if obj.correlation_id else None,
        "metadata_payload": obj.metadata_payload if isinstance(obj.metadata_payload, dict) else {},
    }


def _serialize_login_attempt(obj: Any) -> Dict[str, Any]:
    """Serialize a LoginAttempt ORM-like object to wire format."""
    return {
        "id": str(obj.id) if obj.id else str(uuid.uuid4()),
        "event_id": str(obj.event_id),
        "submitted_username": str(obj.submitted_username)[:255],
        "password_length": int(obj.password_length),
        "password_hmac_fingerprint": str(obj.password_hmac_fingerprint)[:64],
        "is_flagged_credential": bool(obj.is_flagged_credential),
        "success": bool(obj.success),
        "failure_reason": str(obj.failure_reason)[:100],
        "client_ip": str(obj.client_ip)[:45],
        "user_agent": str(obj.user_agent or "")[:500],
    }


def _serialize_captured_file(obj: Any) -> Dict[str, Any]:
    """Serialize a CapturedFile ORM-like object to wire format."""
    return {
        "id": str(obj.id) if obj.id else str(uuid.uuid4()),
        "event_id": str(obj.event_id),
        "original_filename_sanitized": str(obj.original_filename_sanitized)[:255],
        "internal_storage_path": str(obj.internal_storage_path)[:512],
        "sha256_hash": str(obj.sha256_hash)[:64],
        "file_size_bytes": int(obj.file_size_bytes),
        "declared_mime_type": str(obj.declared_mime_type)[:100],
        "detected_mime_type": str(obj.detected_mime_type)[:100],
        "quarantine_status": str(obj.quarantine_status)[:30],
        "rejection_reason": str(obj.rejection_reason)[:255] if obj.rejection_reason else None,
        "source_ip": str(obj.source_ip)[:45],
        "upload_timestamp": (obj.upload_timestamp.isoformat()
                             if isinstance(obj.upload_timestamp, datetime)
                             else str(obj.upload_timestamp)),
    }


def _serialize_batch(objects: List[Any]) -> List[Dict[str, Any]]:
    """Group objects into event items with optional child records.

    Returns a list of dicts, each matching IngestEventItem wire format:
    {"event": {...}, "login_attempt": {...}|null, "captured_file": {...}|null}

    Detection is by characteristic attributes, not class name, so it works
    with both real ORM objects and mock/namespace objects.
    """
    events: Dict[str, Dict[str, Any]] = {}
    children: Dict[str, Dict[str, Any]] = {}

    for obj in objects:
        if hasattr(obj, "event_type"):
            ev_id = str(obj.id) if obj.id else str(uuid.uuid4())
            events[ev_id] = _serialize_event(obj)
            children[ev_id] = {"event": events[ev_id], "login_attempt": None, "captured_file": None}
        elif hasattr(obj, "password_hmac_fingerprint"):
            ev_id = str(obj.event_id)
            if ev_id in children:
                children[ev_id]["login_attempt"] = _serialize_login_attempt(obj)
        elif hasattr(obj, "sha256_hash"):
            ev_id = str(obj.event_id)
            if ev_id in children:
                children[ev_id]["captured_file"] = _serialize_captured_file(obj)

    return list(children.values())


# ---------------------------------------------------------------------------
# ForwardingEventSink (decoy-only mode)
# ---------------------------------------------------------------------------
class ForwardingEventSink(EventSink):
    """Forwards events to the backend via HTTP POST.

    Serializes objects to wire format, puts them on an in-memory queue.
    A background worker (started/stopped by decoy_main lifespan) pulls from
    the queue, batches up to 100 events, and POSTs to
    BACKEND_INGEST_URL/api/v1/internal/ingest-batch.

    On failure (network error, 5xx, 403): append to JSONL spool, backoff.
    On 422: log and drop that batch (malformed, should not retry).
    Spool replayed on startup; new events queued behind spool events.
    Spool capped at DECOY_SPOOL_MAX_BYTES; overflow drops, counts, logs ≤1/min.
    """

    def __init__(self) -> None:
        from app.config import settings

        self._ingest_url = f"{settings.BACKEND_INGEST_URL}/api/v1/internal/ingest-batch"
        self._token = settings.INTERNAL_INGESTION_TOKEN
        self._spool_dir = Path(settings.DECOY_SPOOL_DIR)
        self._spool_file = self._spool_dir / "events.jsonl"
        self._spool_max_bytes = settings.DECOY_SPOOL_MAX_BYTES
        self._queue: asyncio.Queue[Optional[List[Dict[str, Any]]]] = asyncio.Queue(maxsize=10000)
        self._worker_task: Optional[asyncio.Task] = None
        self._dropped_count = 0
        self._last_drop_log = 0.0

        # Ensure spool dir exists
        self._spool_dir.mkdir(parents=True, exist_ok=True)

    # -- lifecycle (called by decoy_main lifespan) --------------------------
    def start_worker(self) -> None:
        """Start the background worker task."""
        if self._worker_task is None:
            self._worker_task = asyncio.create_task(self._worker_loop())

    async def stop_worker(self) -> None:
        """Flush remaining queue to spool and stop the worker."""
        # Signal worker to stop
        await self._queue.put(None)
        if self._worker_task is not None:
            await self._worker_task
            self._worker_task = None

    def replay_spool_on_start(self) -> None:
        """Read pending spool entries and push them to the queue before new events."""
        if not self._spool_file.exists():
            return
        try:
            with open(self._spool_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        items = json.loads(line)
                        self._queue.put_nowait(items)
                    except (json.JSONDecodeError, asyncio.QueueFull):
                        logger.warning("Skipping corrupt spool line during replay")
        except OSError as e:
            logger.error(f"Error reading spool file on startup: {e}")
        # Clear the spool after replay — it's now in the queue
        try:
            self._spool_file.unlink()
        except OSError:
            pass

    # -- persist (called by EventForwarderSession.commit) -------------------
    async def persist(
        self,
        objects: List[Any],
        broadcast_summary: Dict[str, Any] | None = None,
    ) -> None:
        """Serialize objects and enqueue. Never blocks or raises."""
        try:
            items = _serialize_batch(objects)
            for item in items:
                self._queue.put_nowait(item)
        except asyncio.QueueFull:
            self._dropped_count += 1
            now = time.time()
            if now - self._last_drop_log >= 60:
                logger.error(
                    f"Event queue full — dropped {self._dropped_count} events total"
                )
                self._last_drop_log = now
        except Exception as e:
            logger.error(f"Error serializing event for forwarding: {e}")

    # -- spool I/O ----------------------------------------------------------
    def _append_spool(self, batch: List[Dict[str, Any]]) -> bool:
        """Append a batch to the spool file. Returns True if written, False if full."""
        try:
            current_size = self._spool_file.stat().st_size if self._spool_file.exists() else 0
            line = json.dumps({"events": batch}) + "\n"
            line_bytes = len(line.encode("utf-8"))
            if current_size + line_bytes > self._spool_max_bytes:
                self._dropped_count += 1
                now = time.time()
                if now - self._last_drop_log >= 60:
                    logger.error(
                        f"Spool full ({current_size} bytes) — dropped {self._dropped_count} events total"
                    )
                    self._last_drop_log = now
                return False
            with open(self._spool_file, "a", encoding="utf-8") as f:
                f.write(line)
            return True
        except OSError as e:
            logger.error(f"Error appending to spool: {e}")
            return False

    def _rewrite_spool(self, remaining: List[str]) -> None:
        """Atomically rewrite the spool with remaining lines."""
        tmp = self._spool_file.with_suffix(".tmp")
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                for line in remaining:
                    f.write(line)
            tmp.replace(self._spool_file)
        except OSError as e:
            logger.error(f"Error rewriting spool: {e}")

    # -- worker loop --------------------------------------------------------
    async def _worker_loop(self) -> None:
        """Background worker: pull from queue, batch, POST to backend."""
        import httpx

        batch: List[Dict[str, Any]] = []
        backoff = 1.0

        while True:
            item = await self._queue.get()

            # None sentinel = shutdown
            if item is None:
                # Flush remaining batch to spool
                if batch:
                    self._append_spool(batch)
                # Drain any remaining items
                while not self._queue.empty():
                    try:
                        remaining = self._queue.get_nowait()
                        if remaining is not None:
                            self._append_spool([remaining])
                    except asyncio.QueueEmpty:
                        break
                return

            batch.append(item)

            # Send when batch is full (100) or queue is empty
            if len(batch) >= 100 or self._queue.empty():
                success = await self._send_batch(httpx, batch)
                if success:
                    batch.clear()
                    backoff = 1.0
                else:
                    # Spool the failed batch
                    self._append_spool(batch)
                    batch.clear()
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, 30.0)

                    # Try replaying spool
                    await self._replay_spool(httpx)

    async def _send_batch(self, httpx_mod, batch: List[Dict[str, Any]]) -> bool:
        """POST a batch to the backend. Returns True on success, False on retryable failure."""
        try:
            async with httpx_mod.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    self._ingest_url,
                    json={"events": batch},
                    headers={"X-Argus-Internal-Token": self._token},
                )
            if resp.status_code == 200:
                return True
            elif resp.status_code == 422:
                logger.error(f"Backend rejected batch (422) — dropping {len(batch)} events")
                return True  # Don't retry — malformed
            elif resp.status_code == 403:
                logger.error("Backend rejected token (403) — retrying with backoff")
                return False
            else:
                logger.error(f"Backend returned {resp.status_code} — retrying with backoff")
                return False
        except (httpx_mod.ConnectError, httpx_mod.TimeoutException, OSError) as e:
            logger.error(f"Network error forwarding to backend: {e}")
            return False

    async def _replay_spool(self, httpx_mod) -> None:
        """Read spool, send batches, rewrite with what remains."""
        if not self._spool_file.exists():
            return
        try:
            lines = self._spool_file.read_text(encoding="utf-8").splitlines()
        except OSError as e:
            logger.error(f"Error reading spool for replay: {e}")
            return

        remaining: List[str] = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                batch = data.get("events", [])
            except json.JSONDecodeError:
                logger.warning("Skipping corrupt spool line during replay")
                continue

            success = await self._send_batch(httpx_mod, batch)
            if not success:
                remaining.append(line + "\n")

        if remaining:
            self._rewrite_spool(remaining)
        else:
            try:
                self._spool_file.unlink()
            except OSError:
                pass


# ---------------------------------------------------------------------------
# EventForwarderSession (used as get_db override in decoy_main.py)
# ---------------------------------------------------------------------------
def make_default_decoy() -> SimpleNamespace:
    """Create a SimpleNamespace matching DecoyService attributes.

    Only .id is actually read by decoy routes, but all model attributes
    are included for safety.
    """
    from app.config import settings
    return SimpleNamespace(
        id=uuid.UUID(settings.DEFAULT_DECOY_ID),
        name="Nexis Defense Core Portal",
        portal_type="defense_contractor_portal",
        description="Operational access portal for simulated defense contractor",
        is_active=True,
        port=8080,
        banner_title="Nexis Cloud Infrastructure & Defense Systems",
        config_metadata={"theme": "dark_tactical", "version": "4.2.1-sec"},
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


class EventForwarderSession:
    """Adapter that buffers ORM objects and hands them to the ForwardingEventSink.

    Used as the get_db override in decoy_main.py. Every decoy route calls
    db.add(obj) and await db.commit() — this adapter makes those calls
    transparently forward events instead of touching a database.
    """

    def __init__(self) -> None:
        self._objects: List[Any] = []
        self.default_decoy = make_default_decoy()

    def add(self, obj: Any) -> None:
        """Buffer an ORM-like object for forwarding."""
        self._objects.append(obj)

    async def commit(self) -> None:
        """Hand buffered objects to the active event sink, then clear."""
        if self._objects:
            sink = get_event_sink()
            await sink.persist(self._objects)
        self._objects.clear()

    async def refresh(self, obj: Any) -> None:
        """No-op — nothing to refresh in a forwarder session."""
        pass

    async def rollback(self) -> None:
        """No-op — discard buffered objects."""
        self._objects.clear()

    async def execute(self, *args: Any, **kwargs: Any) -> Any:
        """No-op — the decoy should never execute DB queries."""
        pass

    def close(self) -> None:
        """No-op."""
        pass


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
