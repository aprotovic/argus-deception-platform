"""Byte-level unit tests for the MySQL text result-set builder (item 1).

Tests:
- Column count packet encodes correct lenenc
- Column definition: name, utf8mb4 charset (45), col_type, length, filler bytes
- EOF packet: 0xFE marker, warnings, AUTOCOMMIT status flag 0x0002
- Text row: lenenc strings, NULL as 0xFB
- build_result_set: packet sequence ids, correct number of packets, EOF positions
"""

import struct
import pytest

from app.decoys.mysql.protocol import (
    FIELD_TYPE_VAR_STRING,
    FIELD_TYPE_LONGLONG,
    SERVER_STATUS_AUTOCOMMIT,
    build_column_definition,
    build_eof_packet,
    build_packet,
    build_result_set,
    build_text_result_row,
    decode_lenenc,
    decode_lenenc_str,
    encode_lenenc,
)


def _unframe(pkt: bytes):
    """Strip the 4-byte packet header, return (payload, seq_id)."""
    length = pkt[0] | (pkt[1] << 8) | (pkt[2] << 16)
    seq_id = pkt[3]
    return pkt[4:4 + length], seq_id


class TestEofPacket:
    def test_marker(self):
        pkt = build_eof_packet()
        assert pkt[0] == 0xFE

    def test_autocommit_status(self):
        pkt = build_eof_packet()
        status = struct.unpack_from("<H", pkt, 3)[0]
        assert status == SERVER_STATUS_AUTOCOMMIT  # 0x0002

    def test_warnings_zero(self):
        pkt = build_eof_packet(warnings=0)
        warnings = struct.unpack_from("<H", pkt, 1)[0]
        assert warnings == 0

    def test_custom_warnings(self):
        pkt = build_eof_packet(warnings=5)
        assert struct.unpack_from("<H", pkt, 1)[0] == 5


class TestColumnDefinition:
    def _parse(self, payload: bytes) -> dict:
        """Parse a column definition payload back into its fields."""
        off = 0
        catalog, n = decode_lenenc_str(payload, off); off += n
        schema, n = decode_lenenc_str(payload, off); off += n
        table, n = decode_lenenc_str(payload, off); off += n
        org_table, n = decode_lenenc_str(payload, off); off += n
        name, n = decode_lenenc_str(payload, off); off += n
        org_name, n = decode_lenenc_str(payload, off); off += n
        fixed_len = payload[off]; off += 1
        charset = struct.unpack_from("<H", payload, off)[0]; off += 2
        col_len = struct.unpack_from("<I", payload, off)[0]; off += 4
        col_type = payload[off]; off += 1
        flags = struct.unpack_from("<H", payload, off)[0]; off += 2
        decimals = payload[off]; off += 1
        filler = payload[off:off + 2]
        return dict(catalog=catalog, name=name, charset=charset,
                    col_len=col_len, col_type=col_type,
                    flags=flags, fixed_len=fixed_len, filler=filler)

    def test_catalog_is_def(self):
        payload = build_column_definition("col1")
        parsed = self._parse(payload)
        assert parsed["catalog"] == b"def"

    def test_name_encoded(self):
        payload = build_column_definition("employee_id")
        parsed = self._parse(payload)
        assert parsed["name"] == b"employee_id"

    def test_charset_utf8mb4(self):
        """Column charset must be 45 (utf8mb4) by default."""
        payload = build_column_definition("col1")
        parsed = self._parse(payload)
        assert parsed["charset"] == 45

    def test_col_type_varstring(self):
        payload = build_column_definition("col1")
        parsed = self._parse(payload)
        assert parsed["col_type"] == FIELD_TYPE_VAR_STRING

    def test_col_type_longlong(self):
        payload = build_column_definition("id", col_type=FIELD_TYPE_LONGLONG)
        parsed = self._parse(payload)
        assert parsed["col_type"] == FIELD_TYPE_LONGLONG

    def test_fixed_block_length_is_12(self):
        payload = build_column_definition("col1")
        parsed = self._parse(payload)
        assert parsed["fixed_len"] == 12

    def test_filler_bytes_are_zero(self):
        payload = build_column_definition("col1")
        parsed = self._parse(payload)
        assert parsed["filler"] == b"\x00\x00"


class TestTextResultRow:
    def test_string_value(self):
        row = build_text_result_row(["hello"])
        # lenenc(5) + "hello"
        assert row == b"\x05hello"

    def test_null_value(self):
        row = build_text_result_row([None])
        assert row == b"\xFB"

    def test_mixed_values(self):
        row = build_text_result_row(["ab", None, "cd"])
        assert row[0] == 2        # lenenc 2
        assert row[1:3] == b"ab"
        assert row[3] == 0xFB     # NULL
        assert row[4] == 2        # lenenc 2
        assert row[5:7] == b"cd"

    def test_integer_converted_to_string(self):
        row = build_text_result_row([42])
        assert row == b"\x0242"   # lenenc(2) + "42"

    def test_empty_string(self):
        row = build_text_result_row([""])
        assert row == b"\x00"     # lenenc(0), no bytes

    def test_long_value(self):
        val = "x" * 300
        row = build_text_result_row([val])
        # lenenc for 300 = 0xFC 0x2C 0x01
        assert row[:3] == b"\xfc\x2c\x01"
        assert row[3:] == val.encode()


class TestBuildResultSet:
    def _columns(self):
        return [
            {"name": "id",   "type": FIELD_TYPE_LONGLONG, "length": 20},
            {"name": "name", "type": FIELD_TYPE_VAR_STRING, "length": 255},
        ]

    def _rows(self):
        return [[1, "Alice"], [2, None]]

    def test_packet_count(self):
        # 1 col_count + 2 col_defs + 1 eof + 2 rows + 1 eof = 7
        pkts = build_result_set(self._columns(), self._rows(), seq_start=1)
        assert len(pkts) == 7

    def test_sequence_ids_increment(self):
        pkts = build_result_set(self._columns(), self._rows(), seq_start=3)
        seq_ids = [_unframe(p)[1] for p in pkts]
        assert seq_ids == list(range(3, 3 + len(pkts)))

    def test_first_packet_is_column_count(self):
        pkts = build_result_set(self._columns(), self._rows(), seq_start=1)
        payload, _ = _unframe(pkts[0])
        count, _ = decode_lenenc(payload)
        assert count == 2

    def test_column_def_packets(self):
        pkts = build_result_set(self._columns(), self._rows(), seq_start=1)
        # pkts[1] and pkts[2] are column defs
        for i in [1, 2]:
            payload, _ = _unframe(pkts[i])
            # catalog is first lenenc string = "def"
            val, _ = decode_lenenc_str(payload)
            assert val == b"def"

    def test_first_eof_after_column_defs(self):
        pkts = build_result_set(self._columns(), self._rows(), seq_start=1)
        # pkts[3] is the first EOF (after 1 col_count + 2 col_defs)
        payload, _ = _unframe(pkts[3])
        assert payload[0] == 0xFE
        status = struct.unpack_from("<H", payload, 3)[0]
        assert status == SERVER_STATUS_AUTOCOMMIT

    def test_final_eof_last_packet(self):
        pkts = build_result_set(self._columns(), self._rows(), seq_start=1)
        payload, _ = _unframe(pkts[-1])
        assert payload[0] == 0xFE

    def test_null_in_row(self):
        pkts = build_result_set(self._columns(), [[1, None]], seq_start=1)
        # row packet is pkts[4] (1 count + 2 defs + 1 eof = index 4)
        payload, _ = _unframe(pkts[4])
        # first field: "1" → lenenc(1) + b"1"
        assert payload[0] == 1
        assert payload[1:2] == b"1"
        # second field: NULL
        assert payload[2] == 0xFB

    def test_empty_rows(self):
        # 1 col_count + 1 col_def + 1 eof + 0 rows + 1 eof = 4
        pkts = build_result_set([{"name": "x"}], [], seq_start=1)
        assert len(pkts) == 4

    def test_custom_seq_start(self):
        pkts = build_result_set([{"name": "x"}], [["v"]], seq_start=7)
        _, seq = _unframe(pkts[0])
        assert seq == 7
