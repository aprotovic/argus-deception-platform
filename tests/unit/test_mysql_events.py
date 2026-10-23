"""Unit tests for MySQL decoy event builders (task 4).

Tests: build_connection_event severity matrix, build_login_attempt_event
fingerprint / plaintext invariant, field truncation.
"""

import uuid

import pytest

from app.decoys.mysql.events import (
    build_connection_event,
    build_login_attempt_event,
    _serialize_for_stub,
)


def _conn_ev(*, username=None, authenticated=False, has_login=False):
    return build_connection_event(
        event_id=uuid.uuid4(),
        source_ip="1.2.3.4",
        source_port=12345,
        username=username,
        authenticated=authenticated,
        has_login_attempt=has_login,
        duration_seconds=1.5,
        bytes_in=200,
        bytes_out=100,
        correlation_id="abc12345",
    )


class TestConnectionEventSeverity:
    def test_probe_no_username_is_low(self):
        ev = _conn_ev(username=None, authenticated=False, has_login=False)
        assert ev.severity == "low"
        assert ev.event_type == "db_connection"

    def test_probe_with_username_failed_is_medium(self):
        ev = _conn_ev(username="root", authenticated=False, has_login=True)
        assert ev.severity == "medium"

    def test_authenticated_is_high(self):
        ev = _conn_ev(username="root", authenticated=True, has_login=True)
        assert ev.severity == "high"

    def test_fields_set_correctly(self):
        ev = _conn_ev(username="attacker")
        assert ev.http_method == "SQL"
        assert ev.request_path == "/mysql/connect"
        assert ev.event_type == "db_connection"
        assert ev.metadata_payload["bytes_in"] == 200
        assert ev.metadata_payload["bytes_out"] == 100
        assert ev.metadata_payload["duration_seconds"] == 1.5

    def test_source_ip_truncated(self):
        ev = build_connection_event(
            event_id=uuid.uuid4(),
            source_ip="x" * 100,
            source_port=0,
            username=None,
            authenticated=False,
            has_login_attempt=False,
            duration_seconds=0.0,
            bytes_in=0,
            bytes_out=0,
            correlation_id="a",
        )
        assert len(ev.source_ip) <= 45

    def test_correlation_id_truncated(self):
        ev = build_connection_event(
            event_id=uuid.uuid4(),
            source_ip="1.2.3.4",
            source_port=0,
            username=None,
            authenticated=False,
            has_login_attempt=False,
            duration_seconds=0.0,
            bytes_in=0,
            bytes_out=0,
            correlation_id="Z" * 200,
        )
        assert len(ev.correlation_id) <= 64


class TestLoginAttemptEvent:
    def test_failed_login_medium_severity(self):
        sec_ev, login_att = build_login_attempt_event(
            event_id=uuid.uuid4(),
            source_ip="1.2.3.4",
            source_port=12345,
            username="root",
            auth_response=b"\x00" * 20,
            authenticated=False,
            correlation_id="abc12345",
        )
        assert sec_ev.severity == "medium"
        assert sec_ev.event_type == "db_login_attempt"
        assert sec_ev.request_path == "/mysql/login"

    def test_successful_login_high_severity(self):
        sec_ev, login_att = build_login_attempt_event(
            event_id=uuid.uuid4(),
            source_ip="1.2.3.4",
            source_port=12345,
            username="root",
            auth_response=b"\xAA" * 20,
            authenticated=True,
            correlation_id="abc12345",
        )
        assert sec_ev.severity == "high"
        assert login_att.is_flagged_credential is True
        assert login_att.success is False  # decoy never grants real access

    def test_plaintext_never_stored(self):
        """The auth_response bytes must not appear in any field."""
        auth_resp = b"\xDE\xAD\xBE\xEF" * 5  # 20 bytes, distinctive pattern
        sec_ev, login_att = build_login_attempt_event(
            event_id=uuid.uuid4(),
            source_ip="1.2.3.4",
            source_port=12345,
            username="root",
            auth_response=auth_resp,
            authenticated=False,
            correlation_id="abc12345",
        )
        auth_hex = auth_resp.hex()
        # Fingerprint is HMAC of the hex, not the hex itself
        assert login_att.password_hmac_fingerprint != auth_hex
        assert auth_hex not in str(sec_ev.metadata_payload)
        # Length is stored (that's fine)
        assert login_att.password_length == len(auth_resp)

    def test_fingerprint_is_64_hex_chars(self):
        _, login_att = build_login_attempt_event(
            event_id=uuid.uuid4(),
            source_ip="1.2.3.4",
            source_port=None,
            username="user",
            auth_response=b"\x01" * 20,
            authenticated=False,
            correlation_id="x",
        )
        assert len(login_att.password_hmac_fingerprint) == 64
        int(login_att.password_hmac_fingerprint, 16)  # must be valid hex

    def test_ids_are_linked(self):
        eid = uuid.uuid4()
        sec_ev, login_att = build_login_attempt_event(
            event_id=eid,
            source_ip="1.2.3.4",
            source_port=None,
            username="root",
            auth_response=b"\x00" * 20,
            authenticated=False,
            correlation_id="x",
        )
        assert sec_ev.id == eid
        assert login_att.event_id == eid

    def test_username_truncated(self):
        _, login_att = build_login_attempt_event(
            event_id=uuid.uuid4(),
            source_ip="1.2.3.4",
            source_port=None,
            username="u" * 500,
            auth_response=b"\x00" * 20,
            authenticated=False,
            correlation_id="x",
        )
        assert len(login_att.submitted_username) <= 255
