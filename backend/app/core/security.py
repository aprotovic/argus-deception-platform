"""Core cryptographic, JWT, and security utility functions."""

import hashlib
import hmac
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import bcrypt
import jwt
from fastapi import Request
from app.config import settings

# Sensitive headers to strip from telemetry collection
SENSITIVE_HEADERS = {
    "authorization",
    "cookie",
    "set-cookie",
    "x-auth-token",
    "x-api-key",
    "x-csrf-token",
    "proxy-authorization",
}


def hash_password(password: str) -> str:
    """Hashes a plain password using bcrypt (for authorized dashboard users)."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against an existing bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(
    user_id: str,
    username: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Creates a signed JWT access token for administrative dashboard access."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": int(expire.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp()),
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT token; returns payload or None."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except (jwt.PyJWTError, Exception):
        return None


def compute_password_fingerprint(password: str) -> str:
    """
    Computes a keyed HMAC-SHA256 fingerprint for attacker-submitted passwords.
    CRITICAL SECURITY GUARANTEE:
    - Never stores the plaintext password.
    - Allows analysts to detect repeated or distributed credential attacks.
    - Uses a server-side secret key so rainbow tables cannot be used.
    """
    secret = settings.ARGUS_PASSWORD_FINGERPRINT_SECRET.encode("utf-8")
    return hmac.new(secret, password.encode("utf-8"), hashlib.sha256).hexdigest()


def extract_client_ip(request: Request) -> str:
    """
    Extracts the genuine client IP address.
    Checks X-Forwarded-For if behind a proxy, or falls back to client.host.
    """
    # Check X-Forwarded-For (leftmost is client in standard reverse proxy setups)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",")]
        if parts and parts[0]:
            return parts[0]

    # Check X-Real-IP
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


def sanitize_headers(headers: Dict[str, str]) -> Dict[str, str]:
    """
    Sanitizes HTTP headers by stripping cookies, authorization, and personal tokens
    while preserving analytical telemetry (User-Agent, Accept, Referer, Sec-Ch-Ua).
    """
    sanitized: Dict[str, str] = {}
    for key, value in headers.items():
        k_lower = key.lower()
        if k_lower in SENSITIVE_HEADERS:
            continue
        # Truncate overly long headers to prevent DB bloat
        sanitized[key] = value[:512] if len(value) > 512 else value
    return sanitized
