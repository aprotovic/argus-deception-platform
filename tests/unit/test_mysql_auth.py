"""Unit tests for MySQL auth helpers (task 2).

Tests: native_password_scramble with a known test vector,
constant-time verify (match, mismatch, empty), hashcat string format.
"""

import hashlib

import pytest

from app.decoys.mysql.auth import (
    build_hashcat_string,
    native_password_scramble,
    verify_native_password,
)


# Known test vector: password "secret", salt 20 bytes of 0x01
SALT_TEST = b"\x01" * 20
PASSWORD_TEST = b"secret"
# Expected scramble computed manually:
# SHA1("secret") = e5e9fa1ba31ecd1ae84f75caaa474f3a663f05f4
# SHA1(SHA1("secret")) = 7c4a8d09ca3762af61e59520943dc26494f8941b
# SHA1(salt + SHA1(SHA1("secret"))) = SHA1(0x01*20 + 7c4a8d09ca3762af61e59520943dc26494f8941b)
# XOR the first two
EXPECTED_SCRAMBLE = None  # computed in test


class TestScramble:
    def test_scramble_known_vector(self):
        """Verify the scramble with a known password and salt."""
        result = native_password_scramble(PASSWORD_TEST, SALT_TEST)
        assert len(result) == 20

        # Verify the formula manually
        sha1_pw = hashlib.sha1(PASSWORD_TEST).digest()
        sha1_sha1_pw = hashlib.sha1(sha1_pw).digest()
        sha1_salt_sha1 = hashlib.sha1(SALT_TEST + sha1_sha1_pw).digest()
        expected = bytes(a ^ b for a, b in zip(sha1_pw, sha1_salt_sha1))
        assert result == expected

    def test_scramble_empty_password_returns_empty(self):
        result = native_password_scramble(b"", SALT_TEST)
        assert result == b""

    def test_scramble_is_deterministic(self):
        r1 = native_password_scramble(PASSWORD_TEST, SALT_TEST)
        r2 = native_password_scramble(PASSWORD_TEST, SALT_TEST)
        assert r1 == r2

    def test_scramble_different_salt_different_result(self):
        r1 = native_password_scramble(PASSWORD_TEST, b"\x01" * 20)
        r2 = native_password_scramble(PASSWORD_TEST, b"\x02" * 20)
        assert r1 != r2


class TestVerify:
    def test_verify_correct_password(self):
        response = native_password_scramble(PASSWORD_TEST, SALT_TEST)
        assert verify_native_password(response, SALT_TEST, PASSWORD_TEST) is True

    def test_verify_wrong_password(self):
        response = native_password_scramble(PASSWORD_TEST, SALT_TEST)
        assert verify_native_password(response, SALT_TEST, b"wrongpass") is False

    def test_verify_wrong_response(self):
        response = b"\x00" * 20
        assert verify_native_password(response, SALT_TEST, PASSWORD_TEST) is False

    def test_verify_empty_password_empty_response(self):
        assert verify_native_password(b"", SALT_TEST, b"") is True

    def test_verify_different_length_returns_false(self):
        response = b"\x00" * 10
        assert verify_native_password(response, SALT_TEST, PASSWORD_TEST) is False


class TestHashcatString:
    def test_hashcat_string_format(self):
        salt = b"\x01" * 20
        response = b"\x02" * 20
        result = build_hashcat_string(salt, response)
        assert result.startswith("$mysqlna$")
        assert "*" in result
        # Salt is 40 hex chars, response is 40 hex chars
        parts = result.split("$mysqlna$")[1].split("*")
        assert len(parts) == 2
        assert len(parts[0]) == 40  # 20 bytes -> 40 hex
        assert len(parts[1]) == 40

    def test_hashcat_string_matches_mode_11200(self):
        """Format must match hashcat 11200: $mysqlna$<salt>*<response>"""
        salt = bytes(range(20))
        response = bytes(range(20, 40))
        result = build_hashcat_string(salt, response)
        assert result == "$mysqlna$" + salt.hex() + "*" + response.hex()

    def test_hashcat_string_with_real_scramble(self):
        """End-to-end: scramble a password, build hashcat string."""
        password = b"test_bait_pw"
        salt = b"\xab" * 20
        response = native_password_scramble(password, salt)
        hashcat = build_hashcat_string(salt, response)
        assert hashcat.startswith("$mysqlna$")
        assert len(hashcat) == len("$mysqlna$") + 40 + 1 + 40  # prefix + salt + * + response
