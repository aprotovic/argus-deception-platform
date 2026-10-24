"""Unit tests for MySQL protocol helpers (task 1).

Tests: lenenc encode/decode, packet framing, handshake v10 builder,
handshake response 41 parser (valid, truncated, oversized, garbage, SSL),
OK/ERR/EOF packet builders.
"""

import struct

import pytest

from app.decoys.mysql.protocol import (
    build_eof_packet,
    build_err_packet,
    build_handshake_v10,
    build_ok_packet,
    build_packet,
    decode_lenenc,
    decode_lenenc_str,
    decode_nul_str,
    encode_lenenc,
    encode_lenenc_str,
    encode_nul_str,
    parse_handshake_response_41,
    SERVER_CAPABILITIES,
)


# ---------------------------------------------------------------------------
# Length-encoded integers
# ---------------------------------------------------------------------------
class TestLenenc:
    def test_small_values(self):
        for v in [0, 1, 127, 250]:
            assert decode_lenenc(encode_lenenc(v))[0] == v

    def test_two_byte(self):
        for v in [251, 255, 0xFFFF]:
            assert decode_lenenc(encode_lenenc(v))[0] == v

    def test_three_byte(self):
        for v in [0x10000, 0xFFFFFF]:
            assert decode_lenenc(encode_lenenc(v))[0] == v

    def test_eight_byte(self):
        for v in [0x1000000, 0xFFFFFFFFFFFFFFF]:
            assert decode_lenenc(encode_lenenc(v))[0] == v

    def test_truncated_raises(self):
        with pytest.raises(ValueError, match="truncated"):
            decode_lenenc(b"\xfc\x01")  # missing second byte

    def test_invalid_prefix_raises(self):
        with pytest.raises(ValueError, match="invalid prefix"):
            decode_lenenc(b"\xff")

    def test_encode_too_large_raises(self):
        with pytest.raises(ValueError, match="too large"):
            encode_lenenc(2**64 + 1)


# ---------------------------------------------------------------------------
# Length-encoded strings
# ---------------------------------------------------------------------------
class TestLenencStr:
    def test_roundtrip(self):
        val = b"hello world"
        encoded = encode_lenenc_str(val)
        decoded, consumed = decode_lenenc_str(encoded)
        assert decoded == val
        assert consumed == len(encoded)

    def test_empty(self):
        encoded = encode_lenenc_str(b"")
        decoded, consumed = decode_lenenc_str(encoded)
        assert decoded == b""
        assert consumed == 1

    def test_truncated(self):
        with pytest.raises(ValueError, match="truncated"):
            decode_lenenc_str(b"\x05ab")  # says 5 bytes, only 2


# ---------------------------------------------------------------------------
# NUL-terminated strings
# ---------------------------------------------------------------------------
class TestNulStr:
    def test_roundtrip(self):
        encoded = encode_nul_str(b"hello")
        assert encoded == b"hello\x00"
        decoded, consumed = decode_nul_str(encoded)
        assert decoded == b"hello"
        assert consumed == 6

    def test_nul_in_value_raises(self):
        with pytest.raises(ValueError, match="NUL"):
            encode_nul_str(b"ab\x00cd")

    def test_no_terminator_raises(self):
        with pytest.raises(ValueError, match="no NUL"):
            decode_nul_str(b"hello")


# ---------------------------------------------------------------------------
# Packet framing
# ---------------------------------------------------------------------------
class TestPacketFraming:
    def test_build_packet_basic(self):
        pkt = build_packet(b"hello", seq_id=0)
        assert pkt == b"\x05\x00\x00\x00hello"

    def test_build_packet_seq_id(self):
        pkt = build_packet(b"hi", seq_id=3)
        assert pkt[3] == 3

    def test_build_packet_oversized_raises(self):
        with pytest.raises(ValueError, match="too large"):
            build_packet(b"\x00" * 0x1000000)


# ---------------------------------------------------------------------------
# Handshake v10 builder
# ---------------------------------------------------------------------------
class TestHandshakeV10:
    def test_builder_produces_valid_packet(self):
        salt = b"\x01" * 20
        payload = build_handshake_v10(42, salt)
        assert payload[0] == 10  # protocol version
        assert b"8.0.36" in payload
        assert b"mysql_native_password" in payload
        assert salt[:8] in payload
        assert salt[8:] in payload

    def test_connection_id_encoded(self):
        salt = b"\x01" * 20
        payload = build_handshake_v10(0x12345678, salt)
        # Connection ID is after the version NUL terminator
        idx = payload.find(b"\x00")  # end of version string
        cid = struct.unpack_from("<I", payload, idx + 1)[0]
        assert cid == 0x12345678

    def test_wrong_salt_length_raises(self):
        with pytest.raises(ValueError, match="salt must be 20 bytes"):
            build_handshake_v10(1, b"\x00" * 19)

    def test_no_ssl_in_capabilities(self):
        salt = b"\x01" * 20
        payload = build_handshake_v10(1, salt)
        # Parse capabilities from the payload
        # Find the capability flags at a known offset relative to version
        # They're after: protocol(1) + version+NUL(?) + conn_id(4) + salt8(8) + filler(1)
        idx = payload.find(b"\x00")  # end of version
        cap_offset = idx + 1 + 4 + 8 + 1
        cap_lower = struct.unpack_from("<H", payload, cap_offset)[0]
        cap_upper = struct.unpack_from("<H", payload, cap_offset + 6 + 1)[0]
        caps = cap_lower | (cap_upper << 16)
        # SSL bit is 0x0800
        assert not (caps & 0x0800), "SSL bit must not be set"
        # Compression bit is 0x0020
        assert not (caps & 0x0020), "compression bit must not be set"
        # LOCAL INFILE bit is 0x0080
        assert not (caps & 0x0080), "LOCAL INFILE bit must not be set"


# ---------------------------------------------------------------------------
# Handshake Response 41 parser
# ---------------------------------------------------------------------------
class TestHandshakeResponseParser:
    def _build_valid_response(self, username="root", password=b"", database=None):
        caps = SERVER_CAPABILITIES & ~0x00000008  # clear CONNECT_WITH_DB by default
        if database:
            caps |= 0x00000008  # CLIENT_CONNECT_WITH_DB
        payload = bytearray()
        payload += struct.pack("<I", caps)
        payload += struct.pack("<I", 0x01000000)  # max packet
        payload.append(45)  # charset
        payload += b"\x00" * 23  # reserved
        payload += username.encode() + b"\x00"
        # Auth response (lenenc)
        payload += encode_lenenc_str(password)
        if database:
            payload += database.encode() + b"\x00"
        payload += b"mysql_native_password\x00"
        return bytes(payload)

    def test_valid_response(self):
        payload = self._build_valid_response("admin", b"resp123", "testdb")
        result = parse_handshake_response_41(payload)
        assert result["username"] == "admin"
        assert result["auth_response"] == b"resp123"
        assert result["database"] == "testdb"
        assert result["plugin_name"] == "mysql_native_password"
        assert result["charset"] == 45

    def test_response_without_database(self):
        payload = self._build_valid_response("root", b"\x20" * 20)
        result = parse_handshake_response_41(payload)
        assert result["username"] == "root"
        assert result["database"] is None

    def test_truncated_response_raises(self):
        with pytest.raises(ValueError, match="too short"):
            parse_handshake_response_41(b"\x00" * 10)

    def test_ssl_request_raises(self):
        # 32-byte SSL request packet
        ssl_payload = struct.pack("<I", 0x00008800) + b"\x00" * 28
        with pytest.raises(ValueError, match="ssl_request"):
            parse_handshake_response_41(ssl_payload)

    def test_garbage_input_raises(self):
        with pytest.raises((ValueError, struct.error)):
            parse_handshake_response_41(b"\xff" * 64)


# ---------------------------------------------------------------------------
# OK / ERR / EOF packets
# ---------------------------------------------------------------------------
class TestPackets:
    def test_ok_packet(self):
        pkt = build_ok_packet(affected_rows=5, last_insert_id=42)
        assert pkt[0] == 0x00
        assert pkt[1] == 5  # affected rows lenenc
        assert pkt[2] == 42  # last insert id lenenc

    def test_err_packet(self):
        pkt = build_err_packet(1045, "Access denied", sql_state="28000")
        assert pkt[0] == 0xFF
        code = struct.unpack_from("<H", pkt, 1)[0]
        assert code == 1045
        assert b"28000" in pkt
        assert b"Access denied" in pkt

    def test_eof_packet(self):
        pkt = build_eof_packet(warnings=3)
        assert pkt[0] == 0xFE
        warnings = struct.unpack_from("<H", pkt, 1)[0]
        assert warnings == 3
