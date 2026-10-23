"""MySQL decoy event builders — STUB for task 3 only. Task 4 replaces this entirely.

This file exists solely to provide `_serialize_for_stub()` for the JSONL stub
sink used during local testing and task 3 integration tests.

Task 4 will replace this stub with the full event builder that creates
SecurityEvent, LoginAttempt, and related objects and wires them to
ForwardingEventSink with per-IP aggregation.
"""

from __future__ import annotations

from datetime import datetime, timezone


def _serialize_for_stub(obj) -> dict:
    """Serialize a SecurityEvent-like object for the JSONL stub sink."""
    result = {}
    for attr in ("id", "source_ip", "source_port", "http_method", "request_path",
                  "event_type", "severity", "is_test_event", "correlation_id"):
        val = getattr(obj, attr, None)
        if hasattr(val, "hex"):
            val = str(val)
        result[attr] = val
    # timestamp
    ts = getattr(obj, "timestamp", None)
    if isinstance(ts, datetime):
        result["timestamp"] = ts.isoformat()
    else:
        result["timestamp"] = str(ts) if ts else None
    # metadata
    result["metadata_payload"] = getattr(obj, "metadata_payload", {})
    return result
