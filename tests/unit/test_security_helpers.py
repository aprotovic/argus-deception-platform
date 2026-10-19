"""Unit tests for cryptographic helpers, password fingerprinting, and header sanitization."""

import pytest
from app.core.security import (
    compute_password_fingerprint,
    create_access_token,
    decode_access_token,
    hash_password,
    sanitize_headers,
    verify_password,
)


def test_password_hashing_and_verification():
    raw_pwd = "SuperSecurePassword987!"
    hashed = hash_password(raw_pwd)

    assert hashed != raw_pwd
    assert verify_password(raw_pwd, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_password_fingerprint_never_exposes_plaintext():
    pwd1 = "AttackerPassword123"
    pwd2 = "AttackerPassword123"
    pwd3 = "DifferentPassword456"

    fp1 = compute_password_fingerprint(pwd1)
    fp2 = compute_password_fingerprint(pwd2)
    fp3 = compute_password_fingerprint(pwd3)

    # Deterministic for identical passwords (allows correlation)
    assert fp1 == fp2
    # Distinct for different passwords
    assert fp1 != fp3
    # 64-character hex string (SHA-256 HMAC)
    assert len(fp1) == 64
    # NEVER contains original plaintext
    assert "AttackerPassword" not in fp1


def test_jwt_access_token_creation_and_decode():
    token = create_access_token(
        user_id="550e8400-e29b-41d4-a716-446655440000",
        username="secops_analyst",
        role="analyst",
    )
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "550e8400-e29b-41d4-a716-446655440000"
    assert payload["username"] == "secops_analyst"
    assert payload["role"] == "analyst"


def test_jwt_invalid_token_decode():
    assert decode_access_token("malformed.jwt.token") is None
    assert decode_access_token("") is None


def test_header_sanitization_removes_sensitive_tokens():
    raw_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Authorization": "Bearer sensitive_secret_token_never_log",
        "Cookie": "session_id=12345; auth=abcdef",
        "X-Auth-Token": "secret_api_key",
        "Accept": "text/html,application/xhtml+xml",
        "Referer": "http://evil-site.com",
    }

    sanitized = sanitize_headers(raw_headers)

    # Sensitive headers must be completely removed
    assert "Authorization" not in sanitized
    assert "Cookie" not in sanitized
    assert "X-Auth-Token" not in sanitized

    # Analytical headers must be preserved
    assert "User-Agent" in sanitized
    assert "Accept" in sanitized
    assert "Referer" in sanitized
