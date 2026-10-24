"""MySQL protocol packet helpers — pure functions, no sockets.

Task 1 of db-decoy spec (R1).

All functions work on bytes/bytearray. No imports from the app —
the protocol layer is self-contained and testable in isolation.
"""

from __future__ import annotations

import struct
from typing import Optional, Tuple

# Cap: any packet payload larger than this is rejected (R4.1).
MAX_PACKET_BYTES = 1_048_576  # 1 MB

# MySQL capability flags we advertise (never SSL, compression, LOCAL INFILE).
# We DO set CLIENT_PROTOCOL_41 | CLIENT_SECURE_CONNECTION | CLIENT_PLUGIN_AUTH
# | CLIENT_CONNECT_WITH_DB | CLIENT_CONNECT_WITH_DB (if client wants).
# We do NOT set CLIENT_SSL, CLIENT_COMPRESS, CLIENT_LOCAL_FILES.
CAP_LONG_PASSWORD = 0x00000001
CAP_PROTOCOL_41 = 0x00000200
CAP_SECURE_CONNECTION = 0x00008000
CAP_PLUGIN_AUTH = 0x00080000
CAP_CONNECT_WITH_DB = 0x00000008
CAP_CONNECT_DB = 0x00000008  # same bit

# Server capability flags we advertise (must match what we support).
SERVER_CAPABILITIES = (
    CAP_LONG_PASSWORD
    | CAP_PROTOCOL_41
    | CAP_SECURE_CONNECTION
    | CAP_PLUGIN_AUTH
    | CAP_CONNECT_WITH_DB
)

# Status flags
SERVER_STATUS_AUTOCOMMIT = 0x0002


# ============================================================================
# Length-encoded integer (lenenc)
# ============================================================================
def encode_lenenc(value: int) -> bytes:
    """Encode an integer as a MySQL length-encoded integer."""
    if value < 0xFB:
        return bytes([value])
    elif value <= 0xFFFF:
        return b"\xfc" + struct.pack("<H", value)
    elif value <= 0xFFFFFF:
        return b"\xfd" + value.to_bytes(3, "little")
    elif value <= 0xFFFFFFFFFFFFFFFF:
        return b"\xfe" + struct.pack("<Q", value)
    else:
        raise ValueError(f"lenenc value too large: {value}")


def decode_lenenc(data: bytes, offset: int = 0) -> Tuple[int, int]:
    """Decode a length-encoded integer.

    Returns (value, bytes_consumed).
    Raises ValueError on truncated or invalid data.
    """
    if offset >= len(data):
        raise ValueError("lenenc: no data at offset")
    first = data[offset]
    if first < 0xFB:
        return first, 1
    elif first == 0xFB:
        # 0xFB means NULL in row data context; we treat it as a special marker.
        return 0xFB, 1
    elif first == 0xFC:
        if offset + 3 > len(data):
            raise ValueError("lenenc: truncated 2-byte length")
        return struct.unpack_from("<H", data, offset + 1)[0], 3
    elif first == 0xFD:
        if offset + 4 > len(data):
            raise ValueError("lenenc: truncated 3-byte length")
        return int.from_bytes(data[offset + 1 : offset + 4], "little"), 4
    elif first == 0xFE:
        if offset + 9 > len(data):
            raise ValueError("lenenc: truncated 8-byte length")
        return struct.unpack_from("<Q", data, offset + 1)[0], 9
    else:
        # 0xFF is not a valid lenenc prefix
        raise ValueError(f"lenenc: invalid prefix byte 0x{first:02x}")


def encode_lenenc_str(value: bytes) -> bytes:
    """Encode a byte string as a length-encoded string."""
    return encode_lenenc(len(value)) + value


def decode_lenenc_str(data: bytes, offset: int = 0) -> Tuple[bytes, int]:
    """Decode a length-encoded string. Returns (value, total_bytes_consumed)."""
    length, n = decode_lenenc(data, offset)
    if length == 0xFB:
        # NULL marker
        return b"", n
    start = offset + n
    end = start + length
    if end > len(data):
        raise ValueError("lenenc_str: payload truncated")
    return data[start:end], n + length


# ============================================================================
# NUL-terminated string
# ============================================================================
def encode_nul_str(value: bytes) -> bytes:
    """Encode a NUL-terminated string."""
    if b"\x00" in value:
        raise ValueError("NUL-terminated string contains NUL byte")
    return value + b"\x00"


def decode_nul_str(data: bytes, offset: int = 0) -> Tuple[bytes, int]:
    """Decode a NUL-terminated string. Returns (value, total_bytes_consumed)."""
    idx = data.find(b"\x00", offset)
    if idx == -1:
        raise ValueError("NUL-terminated string: no NUL terminator found")
    return data[offset:idx], (idx - offset) + 1


# ============================================================================
# Packet framing
# ============================================================================
def build_packet(payload: bytes, seq_id: int = 0) -> bytes:
    """Build a full MySQL packet: 3-byte LE length + 1-byte seq + payload."""
    length = len(payload)
    if length > 0xFFFFFF:
        raise ValueError(f"payload too large for single packet: {length}")
    header = struct.pack("<I", length)[:3] + bytes([seq_id & 0xFF])
    return header + payload


async def read_packet(reader, max_bytes: int = MAX_PACKET_BYTES) -> Tuple[bytes, int]:
    """Read one MySQL packet from an asyncio StreamReader.

    Checks the 3-byte length BEFORE reading the payload.
    Returns (payload, seq_id).
    Raises ValueError if the packet exceeds max_bytes or is truncated.
    """
    header = await reader.readexactly(4)
    length = header[0] | (header[1] << 8) | (header[2] << 16)
    seq_id = header[3]
    if length > max_bytes:
        raise ValueError(f"packet length {length} exceeds cap {max_bytes}")
    if length == 0:
        return b"", seq_id
    payload = await reader.readexactly(length)
    return payload, seq_id


# ============================================================================
# Handshake v10 (server -> client)
# ============================================================================
def build_handshake_v10(
    connection_id: int,
    salt: bytes,
    version_string: str = "8.0.36-0ubuntu0.22.04.1",
    capabilities: int = SERVER_CAPABILITIES,
) -> bytes:
    """Build an Initial Handshake v10 packet payload.

    salt must be exactly 20 bytes.
    Returns the payload (without the 4-byte packet header).
    """
    if len(salt) != 20:
        raise ValueError(f"salt must be 20 bytes, got {len(salt)}")

    payload = bytearray()
    # Protocol version
    payload.append(10)
    # Server version string (NUL-terminated)
    payload += encode_nul_str(version_string.encode("utf-8"))
    # Connection ID (4 bytes LE)
    payload += struct.pack("<I", connection_id)
    # First 8 bytes of salt
    payload += salt[:8]
    # Filler (1 byte)
    payload.append(0x00)
    # Capability flags lower 2 bytes
    payload += struct.pack("<H", capabilities & 0xFFFF)
    # Character set (45 = utf8mb4)
    payload.append(45)
    # Status flags (2 bytes)
    payload += struct.pack("<H", SERVER_STATUS_AUTOCOMMIT)
    # Capability flags upper 2 bytes
    payload += struct.pack("<H", (capabilities >> 16) & 0xFFFF)
    # Auth data length (21 for 20-byte salt + NUL)
    payload.append(21)
    # 10 reserved bytes (all zero)
    payload += b"\x00" * 10
    # Remaining 12 bytes of salt + NUL
    payload += salt[8:20] + b"\x00"
    # Plugin name (NUL-terminated)
    payload += encode_nul_str(b"mysql_native_password")

    return bytes(payload)


# ============================================================================
# Handshake Response 41 (client -> server)
# ============================================================================
def parse_handshake_response_41(payload: bytes) -> dict:
    """Parse a Handshake Response 41 packet.

    Returns a dict with keys:
        capabilities (int), max_packet (int), charset (int),
        username (str), auth_response (bytes), database (str|None),
        plugin_name (str|None)

    Raises ValueError on truncated, oversized, or garbage input.
    A 32-byte payload is an SSL request — raises ValueError with
    "ssl_request" in the message so the caller can close the connection.
    """
    if len(payload) == 32:
        raise ValueError("ssl_request: 32-byte packet is an SSL request")

    if len(payload) < 32:
        raise ValueError(f"handshake response too short: {len(payload)} bytes")

    offset = 0
    # Capability flags (4 bytes LE)
    capabilities = struct.unpack_from("<I", payload, offset)[0]
    offset += 4
    # Max packet size (4 bytes LE)
    max_packet = struct.unpack_from("<I", payload, offset)[0]
    offset += 4
    # Character set (1 byte)
    charset = payload[offset]
    offset += 1
    # 23 reserved bytes
    offset += 23

    # Username (NUL-terminated)
    username_bytes, consumed = decode_nul_str(payload, offset)
    offset += consumed
    username = username_bytes.decode("utf-8", errors="replace")

    # Auth response
    if capabilities & CAP_SECURE_CONNECTION:
        auth_len, n = decode_lenenc(payload, offset)
        offset += n
        auth_response = payload[offset : offset + auth_len]
        if len(auth_response) != auth_len:
            raise ValueError("auth response truncated")
        offset += auth_len
    else:
        # Old-style: NUL-terminated auth response
        auth_response, consumed = decode_nul_str(payload, offset)
        offset += consumed

    # Database (optional, if CLIENT_CONNECT_WITH_DB)
    database = None
    if capabilities & CAP_CONNECT_WITH_DB and offset < len(payload):
        db_bytes, consumed = decode_nul_str(payload, offset)
        offset += consumed
        database = db_bytes.decode("utf-8", errors="replace")

    # Plugin name (optional, if CLIENT_PLUGIN_AUTH)
    plugin_name = None
    if capabilities & CAP_PLUGIN_AUTH and offset < len(payload):
        plugin_bytes, consumed = decode_nul_str(payload, offset)
        offset += consumed
        plugin_name = plugin_bytes.decode("utf-8", errors="replace")

    return {
        "capabilities": capabilities,
        "max_packet": max_packet,
        "charset": charset,
        "username": username,
        "auth_response": bytes(auth_response),
        "database": database,
        "plugin_name": plugin_name,
    }


# ============================================================================
# OK packet
# ============================================================================
def build_ok_packet(
    affected_rows: int = 0,
    last_insert_id: int = 0,
    status_flags: int = SERVER_STATUS_AUTOCOMMIT,
    warnings: int = 0,
) -> bytes:
    """Build an OK packet payload."""
    payload = bytearray()
    payload.append(0x00)
    payload += encode_lenenc(affected_rows)
    payload += encode_lenenc(last_insert_id)
    payload += struct.pack("<H", status_flags)
    payload += struct.pack("<H", warnings)
    return bytes(payload)


# ============================================================================
# ERR packet
# ============================================================================
def build_err_packet(
    error_code: int,
    message: str,
    sql_state: str = "HY000",
) -> bytes:
    """Build an ERR packet payload."""
    payload = bytearray()
    payload.append(0xFF)
    payload += struct.pack("<H", error_code)
    payload += b"#" + sql_state.encode("ascii")
    payload += message.encode("utf-8")
    return bytes(payload)


# ============================================================================
# EOF packet
# ============================================================================
def build_eof_packet(
    warnings: int = 0,
    status_flags: int = SERVER_STATUS_AUTOCOMMIT,
) -> bytes:
    """Build an EOF packet payload."""
    payload = bytearray()
    payload.append(0xFE)
    payload += struct.pack("<H", warnings)
    payload += struct.pack("<H", status_flags)
    return bytes(payload)


# ============================================================================
# Text result set (Protocol 41, no CLIENT_DEPRECATE_EOF)
# ============================================================================
# Column type constants (subset we use)
FIELD_TYPE_VAR_STRING = 0xFD   # 253 — VARCHAR / text columns
FIELD_TYPE_LONGLONG   = 0x08   # 8   — BIGINT columns


def build_column_definition(
    name: str,
    table: str = "",
    org_name: str = "",
    col_type: int = FIELD_TYPE_VAR_STRING,
    col_length: int = 1024,
    flags: int = 0,
    decimals: int = 0,
    charset: int = 45,        # utf8mb4
) -> bytes:
    """Build a Protocol 41 column definition packet payload.

    Format:
      catalog    lenenc "def"
      schema     lenenc ""
      table      lenenc <table>
      org_table  lenenc <table>
      name       lenenc <name>
      org_name   lenenc <org_name or name>
      0x0C       1-byte length of fixed block (always 12)
      charset    2-byte LE
      col_length 4-byte LE
      col_type   1-byte
      flags      2-byte LE
      decimals   1-byte
      filler     2-byte 0x00
    """
    payload = bytearray()
    payload += encode_lenenc_str(b"def")
    payload += encode_lenenc_str(b"")
    payload += encode_lenenc_str(table.encode("utf-8"))
    payload += encode_lenenc_str(table.encode("utf-8"))   # org_table same as table
    payload += encode_lenenc_str(name.encode("utf-8"))
    payload += encode_lenenc_str((org_name or name).encode("utf-8"))
    payload += b"\x0C"                                     # fixed-block length = 12
    payload += struct.pack("<H", charset)
    payload += struct.pack("<I", col_length)
    payload += bytes([col_type])
    payload += struct.pack("<H", flags)
    payload += bytes([decimals])
    payload += b"\x00\x00"                                 # filler
    return bytes(payload)


def build_text_result_row(values: list) -> bytes:
    """Build one text result-set row payload.

    Each value is encoded as a lenenc string. None → 0xFB (SQL NULL).
    All non-None values are converted to str then encoded as UTF-8.
    """
    payload = bytearray()
    for v in values:
        if v is None:
            payload += b"\xFB"
        else:
            s = str(v).encode("utf-8")
            payload += encode_lenenc_str(s)
    return bytes(payload)


def build_result_set(
    columns: list,
    rows: list,
    seq_start: int = 1,
    status_flags: int = SERVER_STATUS_AUTOCOMMIT,
) -> tuple:
    """Build a complete text result set as a list of (payload, seq_id) pairs.

    Classic EOF format (CLIENT_DEPRECATE_EOF NOT set):
      1 packet:  column count (lenenc)
      N packets: column definitions
      1 packet:  EOF (after column defs)
      M packets: text rows
      1 packet:  EOF (final)

    Parameters
    ----------
    columns : list of dicts with keys:
        name (str), table (str, default ""), type (int, default FIELD_TYPE_VAR_STRING),
        length (int, default 1024), charset (int, default 45)
    rows : list of lists of values (str | int | None per cell)
    seq_start : sequence ID for the first packet (usually ctx.seq_id + 1)
    status_flags : status flags for EOF packets

    Returns
    -------
    List of raw packet bytes (already framed with 4-byte header).
    """
    packets = []
    seq = seq_start

    # 1. Column count
    col_count_payload = encode_lenenc(len(columns))
    packets.append(build_packet(col_count_payload, seq_id=seq))
    seq += 1

    # 2. Column definitions
    for col in columns:
        col_def = build_column_definition(
            name=col["name"],
            table=col.get("table", ""),
            org_name=col.get("org_name", col["name"]),
            col_type=col.get("type", FIELD_TYPE_VAR_STRING),
            col_length=col.get("length", 1024),
            charset=col.get("charset", 45),
            flags=col.get("flags", 0),
        )
        packets.append(build_packet(col_def, seq_id=seq))
        seq += 1

    # 3. EOF after column defs
    packets.append(build_packet(build_eof_packet(status_flags=status_flags), seq_id=seq))
    seq += 1

    # 4. Rows
    for row in rows:
        packets.append(build_packet(build_text_result_row(row), seq_id=seq))
        seq += 1

    # 5. Final EOF
    packets.append(build_packet(build_eof_packet(status_flags=status_flags), seq_id=seq))

    return packets
