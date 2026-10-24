"""MySQL native-password authentication helpers.


mysql_native_password scramble:
  expected = SHA1(password) XOR SHA1(salt + SHA1(SHA1(password)))

hashcat mode 11200:
  $mysqlna$<40-char salt hex>*<40-char response hex>

Uses only hashlib and hmac from the standard library.
"""

from __future__ import annotations

import hashlib
import hmac


def native_password_scramble(password: bytes, salt: bytes) -> bytes:
    """Compute the mysql_native_password auth response.

    Returns a 20-byte XOR of SHA1(password) with SHA1(salt + SHA1(SHA1(password))).
    """
    if not password:
        return b""

    sha1_password = hashlib.sha1(password).digest()
    sha1_sha1_password = hashlib.sha1(sha1_password).digest()
    sha1_salt_sha1 = hashlib.sha1(salt + sha1_sha1_password).digest()

    # XOR
    result = bytes(a ^ b for a, b in zip(sha1_password, sha1_salt_sha1))
    return result


def verify_native_password(
    client_response: bytes,
    salt: bytes,
    password: bytes,
) -> bool:
    """Verify a client auth response against a known password.

    Uses hmac.compare_digest for constant-time comparison.
    """
    expected = native_password_scramble(password, salt)
    if len(client_response) == 0 and len(expected) == 0:
        return True
    if len(client_response) != len(expected):
        return False
    return hmac.compare_digest(client_response, expected)


def build_hashcat_string(salt: bytes, client_response: bytes) -> str:
    """Build a hashcat mode 11200 string.

    Format: $mysqlna$<salt hex>*<response hex>
    Salt is 20 bytes -> 40 hex chars.
    Response is 20 bytes -> 40 hex chars.
    """
    return f"$mysqlna${salt.hex()}*{client_response.hex()}"
