"""Meridian Trust Bank decoy portal router.

Serves a convincing fake retail banking portal to attract and profile attackers.
Detects credential stuffing, SQL injection, XSS, and file upload threats, logging
security telemetry via the EventForwarderSession → ForwardingEventSink pipeline.

Key invariants:
- Never calls ws_manager.broadcast_event() directly (the ForwardingEventSink handles that).
- Never imports AsyncSessionLocal or any direct DB connection.
- All db.add() / await db.commit() target an EventForwarderSession instance.
- Plaintext passwords are NEVER stored; only length and HMAC-SHA256 fingerprint.
"""

import html
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limiter import SlidingWindowRateLimiter
from app.core.security import (
    compute_password_fingerprint,
    extract_client_ip,
    sanitize_headers,
)
from app.database import get_db
from app.logging_config import logger
from app.models.login_attempt import LoginAttempt
from app.models.security_event import SecurityEvent

# ============================================================================
# MODULE-LEVEL CONSTANTS
# ============================================================================

BANK_DECOY_UUID = uuid.UUID("00000000-0000-0000-0000-000000000002")
BANK_DECOY_ID = "00000000-0000-0000-0000-000000000002"

# Fake credential pairs for the decoy portal.
# These are entirely fictional — never associated with real accounts.
FAKE_ACCOUNTS: dict[str, str] = {
    "j.hartwell": "Hartwell2024!",
    "m.chen": "Chen@Banking1",
}

# Masked phone numbers shown post-login to trigger the OTP overlay.
BANK_DECOY_MASKED_PHONES: dict[str, str] = {
    "j.hartwell": "••••••••47",
    "m.chen": "••••••••91",
}

# ============================================================================
# RATE LIMITERS (module-level singletons)
# ============================================================================

bank_login_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=60)
bank_otp_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60)
bank_recover_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60)

# ============================================================================
# DETECTION CONSTANTS
# ============================================================================

# SQL injection indicators — mirrors the set used in decoy_personnel.py / decoy.py.
_SQLI_INDICATORS = [
    "'",
    '"',
    "--",
    "/*",
    "UNION",
    "SELECT",
    "OR 1=1",
    "OR '1'='1",
    "DROP",
    "SLEEP",
    "BENCHMARK",
    "INFORMATION_SCHEMA",
]

# Common XSS payload indicators.
_XSS_INDICATORS = [
    "<script>",
    "javascript:",
    "onerror=",
    "onload=",
    "<iframe>",
    "alert(",
]

# ============================================================================
# DETECTION HELPERS
# ============================================================================


def _is_sqli(value: str) -> bool:
    """Returns True if *value* contains any known SQL injection indicator (case-insensitive)."""
    upper = value.upper()
    return any(ind in upper for ind in _SQLI_INDICATORS)


def _is_xss(value: str) -> bool:
    """Returns True if *value* contains any known XSS indicator (case-insensitive)."""
    lower = value.lower()
    return any(ind.lower() in lower for ind in _XSS_INDICATORS)


def _safe_meta(value: str, limit: int = 2048) -> str:
    """HTML-escapes ``<>&"'`` in *value* and truncates the result to *limit* characters.

    Used before storing attacker-supplied input in metadata_payload so that
    any injected markup is neutralised at rest.
    """
    escaped = html.escape(value, quote=True)
    return escaped[:limit]


# ============================================================================
# DECOY SERVICE HELPER
# ============================================================================


def get_or_create_bank_decoy(db) -> SimpleNamespace:
    """Returns a lightweight namespace representing the Meridian bank decoy service.

    Mirrors the pattern of ``get_or_create_default_decoy`` in decoy.py.
    The decoy process has no live DB connection, so we return a SimpleNamespace
    rather than a real ORM object; ``db.bank_decoy`` may be set by the
    EventForwarderSession to inject a pre-resolved instance for testing.
    """
    if hasattr(db, "bank_decoy"):
        return db.bank_decoy
    return SimpleNamespace(
        id=BANK_DECOY_UUID,
        name="Meridian Trust Bank Portal",
        portal_type="online_banking_portal",
        banner_title="Meridian Trust Bank",
    )


# ============================================================================
# TEST-MODE DETECTION HELPER
# ============================================================================


def check_is_test(request: Request) -> bool:
    """Returns True if the request originates from an authorised test suite.

    Checks for the ``x-argus-test-token`` header or ``test=1`` / ``test=true``
    query param — identical logic to ``check_is_test`` in decoy.py.
    """
    test_header = request.headers.get("x-argus-test-token")
    test_query = request.query_params.get("test")
    return bool(test_header or test_query in ("1", "true"))


# ============================================================================
# TEMPLATE PATH HELPERS
# ============================================================================

# Resolve from: backend/app/api/v1/bank_router.py
#   → .parent  backend/app/api/v1/
#   → .parent  backend/app/api/
#   → .parent  backend/app/
#   → .parent  backend/
#   → .parent  <repo root>
#   / "decoy" / "templates" / "bank"
BANK_TEMPLATES_DIR: Path = (
    Path(__file__).resolve().parent.parent.parent.parent.parent
    / "decoy"
    / "templates"
    / "bank"
)


def _read_template(name: str) -> str:
    """Reads and returns the content of *name* from BANK_TEMPLATES_DIR.

    Raises ``FileNotFoundError`` if the template does not exist so that
    the caller's exception handler can surface a clean 500 response.
    """
    path = BANK_TEMPLATES_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Bank template not found: {path}")
    return path.read_text(encoding="utf-8")


# React app static dir — built output committed to decoy/static/bank-app/
BANK_APP_DIR: Path = (
    Path(__file__).resolve().parent.parent.parent.parent.parent
    / "decoy" / "static" / "bank-app"
)

_BANK_APP_INDEX: Path = BANK_APP_DIR / "index.html"


def _read_index_html() -> str:
    """Returns the compiled React app index.html shell.

    Falls back to the old static template if the React build does not exist
    yet, preserving safe-order behaviour.
    """
    if _BANK_APP_INDEX.exists():
        return _BANK_APP_INDEX.read_text(encoding="utf-8")
    raise FileNotFoundError(f"React app not built: {_BANK_APP_INDEX}")


# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(tags=["Bank Portal"])


# ----------------------------------------------------------------------------
# Static assets
# ----------------------------------------------------------------------------


@router.get("/bank/static/bank.css")
@router.get("/static/bank.css")
async def bank_css() -> FileResponse:
    """Serves the shared Meridian Trust Bank stylesheet."""
    css_path = BANK_TEMPLATES_DIR / "bank.css"
    return FileResponse(str(css_path), media_type="text/css")


# ----------------------------------------------------------------------------
# Page routes (GET)
# ----------------------------------------------------------------------------


@router.get("/bank/login")
@router.get("/login")
async def bank_login_page() -> HTMLResponse:
    """Renders the Meridian Trust Bank login page with OTP overlay."""
    return HTMLResponse(content=_read_index_html())


# ----------------------------------------------------------------------------
# Task 2.4 — POST /bank/auth/login
# ----------------------------------------------------------------------------


@router.post("/api/v1/bank/auth/login")
async def bank_login(
    request: Request,
    username: str = Form(default=""),
    password: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Decoy bank login endpoint.

    Logs credential submission telemetry (SQLi, XSS, credential-stuffing).
    Never stores plaintext passwords; only length and HMAC-SHA256 fingerprint.
    Always returns a failure response to the attacker — except for fake-account
    matches, which return an OTP challenge to deepen engagement.
    """
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = get_or_create_bank_decoy(db)

    # Rate-limit — per IP, 10 req / 60 s
    allowed, _ = bank_login_limiter.is_allowed(client_ip)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "message": (
                    "Your account access has been temporarily restricted. "
                    "Please try again later."
                )
            },
        )

    event_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    try:
        # ------------------------------------------------------------------
        # Threat detection
        # ------------------------------------------------------------------
        sqli_detected = _is_sqli(username) or _is_sqli(password)
        xss_detected = _is_xss(username) or _is_xss(password)

        # ------------------------------------------------------------------
        # Metadata assembly
        # ------------------------------------------------------------------
        metadata: dict = {
            "decoy_brand": "meridian_trust_bank",
            "submitted_username": _safe_meta(username[:100]),
            "password_length": len(password),
        }
        if xss_detected:
            metadata["xss_detected"] = True

        # ------------------------------------------------------------------
        # Classification
        # ------------------------------------------------------------------
        if sqli_detected:
            event_type = "sql_injection"
            severity = "critical"
        elif xss_detected:
            event_type = "login_attempt"
            severity = "high"
        else:
            event_type = "login_attempt"
            severity = "medium"

        # ------------------------------------------------------------------
        # Fake-account credential check
        # ------------------------------------------------------------------
        is_fake_match = username in FAKE_ACCOUNTS and FAKE_ACCOUNTS.get(username) == password

        # ------------------------------------------------------------------
        # Password fingerprint (never store plaintext)
        # ------------------------------------------------------------------
        pwd_fingerprint = (
            compute_password_fingerprint(password) if password else "empty_password"
        )

        # ------------------------------------------------------------------
        # ORM objects
        # ------------------------------------------------------------------
        sec_event = SecurityEvent(
            id=event_id,
            decoy_service_id=decoy.id,
            timestamp=now_utc,
            source_ip=client_ip,
            source_port=request.client.port if request.client else None,
            http_method=request.method,
            request_path=str(request.url.path),
            query_params=dict(request.query_params),
            headers_sanitized=sanitize_headers(dict(request.headers)),
            user_agent=request.headers.get("user-agent", "")[:500],
            event_type=event_type,
            severity=severity,
            is_test_event=is_test,
            correlation_id=(
                request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8]
            )[:64],
            metadata_payload=metadata,
        )

        login_attempt = LoginAttempt(
            id=uuid.uuid4(),
            event_id=event_id,
            submitted_username=username[:255] if username else "(blank)",
            password_length=len(password),
            password_hmac_fingerprint=pwd_fingerprint,
            is_flagged_credential=severity in ("high", "critical"),
            success=is_fake_match,
            failure_reason=(
                "fake_account_matched" if is_fake_match else "simulated_bank_login_failure"
            ),
            client_ip=client_ip,
            user_agent=request.headers.get("user-agent", "")[:500],
        )

        db.add(sec_event)
        db.add(login_attempt)
        await db.commit()

        # ------------------------------------------------------------------
        # Response — SQLi → plain 401 (don't hint at OTP flow)
        # ------------------------------------------------------------------
        if sqli_detected:
            return JSONResponse(
                status_code=401,
                content={
                    "message": (
                        "The information you entered does not match our records. "
                        "Please try again."
                    )
                },
            )

        if is_fake_match:
            return JSONResponse(
                status_code=200,
                content={
                    "otp_required": True,
                    "username": username,
                    "masked_phone": BANK_DECOY_MASKED_PHONES.get(username, "••••••••"),
                },
            )

        return JSONResponse(
            status_code=401,
            content={
                "message": (
                    "The information you entered does not match our records. "
                    "Please try again."
                )
            },
        )

    except Exception as e:  # noqa: BLE001
        logger.error(
            f"bank_login error for {client_ip}: {e}",
            extra={"event_id": str(event_id), "source_ip": client_ip, "event_type": "login_attempt"},
        )
        return JSONResponse(
            status_code=401,
            content={
                "message": (
                    "The information you entered does not match our records. "
                    "Please try again."
                )
            },
        )


# ----------------------------------------------------------------------------
# Task 2.5 — POST /bank/auth/otp
# ----------------------------------------------------------------------------


@router.post("/api/v1/bank/auth/otp")
async def bank_otp(
    request: Request,
    username: str = Form(default=""),
    otp_code: str = Form(default=""),
    action: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Decoy bank OTP verification endpoint.

    Always rejects the submitted code (returns 403 verification_failed) to
    keep the attacker engaged while logging the attempt.  A resend action is
    handled as a distinct high-severity telemetry event.
    """
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = get_or_create_bank_decoy(db)

    # Rate-limit — per IP, 5 req / 60 s
    allowed, _ = bank_otp_limiter.is_allowed(client_ip)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "message": (
                    "Your account has been temporarily locked. "
                    "Please try again in 60 seconds."
                )
            },
        )

    try:
        # ------------------------------------------------------------------
        # Resend action — log and acknowledge without verifying a code
        # ------------------------------------------------------------------
        if action == "resend_requested":
            now_utc = datetime.now(timezone.utc)
            resend_event = SecurityEvent(
                id=uuid.uuid4(),
                decoy_service_id=decoy.id,
                timestamp=now_utc,
                source_ip=client_ip,
                source_port=request.client.port if request.client else None,
                http_method=request.method,
                request_path=str(request.url.path),
                query_params=dict(request.query_params),
                headers_sanitized=sanitize_headers(dict(request.headers)),
                user_agent=request.headers.get("user-agent", "")[:500],
                event_type="otp_attempt",
                severity="high",
                is_test_event=is_test,
                correlation_id=(
                    request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8]
                )[:64],
                metadata_payload={
                    "action": "resend_requested",
                    "decoy_brand": "meridian_trust_bank",
                    "username": _safe_meta(username[:255]),
                },
            )
            db.add(resend_event)
            await db.commit()
            return JSONResponse(
                status_code=200,
                content={"message": "A new code has been sent."},
            )

        # ------------------------------------------------------------------
        # Validate code length — do NOT record an event for malformed inputs
        # ------------------------------------------------------------------
        if len(otp_code) != 6:
            return JSONResponse(
                status_code=422,
                content={"error": "Code must be exactly 6 digits."},
            )

        # ------------------------------------------------------------------
        # Record OTP attempt telemetry
        # ------------------------------------------------------------------
        now_utc = datetime.now(timezone.utc)
        event_id = uuid.uuid4()
        sec_event = SecurityEvent(
            id=event_id,
            decoy_service_id=decoy.id,
            timestamp=now_utc,
            source_ip=client_ip,
            source_port=request.client.port if request.client else None,
            http_method=request.method,
            request_path=str(request.url.path),
            query_params=dict(request.query_params),
            headers_sanitized=sanitize_headers(dict(request.headers)),
            user_agent=request.headers.get("user-agent", "")[:500],
            event_type="otp_attempt",
            severity="high",
            is_test_event=is_test,
            correlation_id=(
                request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8]
            )[:64],
            metadata_payload={
                "code_length": len(otp_code),
                "decoy_brand": "meridian_trust_bank",
                "username": _safe_meta(username[:255]),
            },
        )
        db.add(sec_event)
        await db.commit()

        # ------------------------------------------------------------------
        # Always reject — the decoy never grants access
        # ------------------------------------------------------------------
        return JSONResponse(
            status_code=403,
            content={
                "error": "verification_failed",
                "message": "That code has expired. Please request a new one.",
            },
        )

    except Exception as e:  # noqa: BLE001
        logger.error(
            f"bank_otp error for {client_ip}: {e}",
            extra={"source_ip": client_ip, "event_type": "otp_attempt"},
        )
        return JSONResponse(
            status_code=403,
            content={
                "error": "verification_failed",
                "message": "That code has expired. Please request a new one.",
            },
        )


# ----------------------------------------------------------------------------
# Task 4.2 — GET /bank/dashboard
# ----------------------------------------------------------------------------


@router.get("/bank/dashboard")
async def bank_dashboard_page(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    """Renders the authenticated bank dashboard with fake account data.

    Fires a recon_probe/medium SecurityEvent on every load so the SOC
    can track how long attackers spend exploring the fake dashboard.
    """
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = get_or_create_bank_decoy(db)

    try:
        now_utc = datetime.now(timezone.utc)
        sec_event = SecurityEvent(
            id=uuid.uuid4(),
            decoy_service_id=decoy.id,
            timestamp=now_utc,
            source_ip=client_ip,
            source_port=request.client.port if request.client else None,
            http_method=request.method,
            request_path=str(request.url.path),
            query_params=dict(request.query_params),
            headers_sanitized=sanitize_headers(dict(request.headers)),
            user_agent=request.headers.get("user-agent", "")[:500],
            event_type="recon_probe",
            severity="medium",
            is_test_event=is_test,
            correlation_id=(
                request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8]
            )[:64],
            metadata_payload={
                "page": "bank_dashboard",
                "decoy_brand": "meridian_trust_bank",
            },
        )
        db.add(sec_event)
        await db.commit()
    except Exception as e:
        logger.error(
            f"bank_dashboard telemetry error: {e}",
            extra={"source_ip": client_ip},
        )

    return HTMLResponse(content=_read_index_html())


# ----------------------------------------------------------------------------
# Task 5.2 — GET /bank
# ----------------------------------------------------------------------------


@router.get("/bank")
async def bank_landing_page(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    """Renders the Meridian Trust Bank public landing page.

    Fires a recon_probe/low SecurityEvent — scanning tools and direct
    visitors are captured here as the first breadcrumb in the attack path.
    """
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = get_or_create_bank_decoy(db)

    try:
        now_utc = datetime.now(timezone.utc)
        sec_event = SecurityEvent(
            id=uuid.uuid4(),
            decoy_service_id=decoy.id,
            timestamp=now_utc,
            source_ip=client_ip,
            source_port=request.client.port if request.client else None,
            http_method=request.method,
            request_path=str(request.url.path),
            query_params=dict(request.query_params),
            headers_sanitized=sanitize_headers(dict(request.headers)),
            user_agent=request.headers.get("user-agent", "")[:500],
            event_type="recon_probe",
            severity="low",
            is_test_event=is_test,
            correlation_id=(
                request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8]
            )[:64],
            metadata_payload={"decoy_brand": "meridian_trust_bank"},
        )
        db.add(sec_event)
        await db.commit()
    except Exception as e:
        logger.error(
            f"bank_landing telemetry error: {e}",
            extra={"source_ip": client_ip},
        )

    return HTMLResponse(content=_read_index_html())


# ----------------------------------------------------------------------------
# Task 7.1 — GET /bank/recover
# ----------------------------------------------------------------------------


@router.get("/bank/recover")
async def bank_recover_page() -> HTMLResponse:
    """Renders the password recovery page."""
    return HTMLResponse(content=_read_index_html())


# ----------------------------------------------------------------------------
# Task 7.1 — POST /bank/auth/recover
# ----------------------------------------------------------------------------


@router.post("/api/v1/bank/auth/recover")
async def bank_recover(
    request: Request,
    identifier: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Decoy password recovery endpoint.

    Captures account enumeration probes. Always returns the same neutral
    confirmation message regardless of whether the identifier matches a
    known fake account, to prevent enumeration.
    """
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = get_or_create_bank_decoy(db)

    allowed, _ = bank_recover_limiter.is_allowed(client_ip)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"message": "If an account matching that information exists, you will receive an email shortly."},
        )

    # Detect injection in the identifier field
    sqli_in_id = _is_sqli(identifier)
    xss_in_id = _is_xss(identifier)
    injection_detected = sqli_in_id or xss_in_id

    metadata: dict = {
        "decoy_brand": "meridian_trust_bank",
        "source_ip": client_ip,
        "identifier_length": len(identifier),
    }
    if injection_detected:
        metadata["injection_detected"] = True

    severity = "critical" if injection_detected else "medium"

    try:
        now_utc = datetime.now(timezone.utc)
        sec_event = SecurityEvent(
            id=uuid.uuid4(),
            decoy_service_id=decoy.id,
            timestamp=now_utc,
            source_ip=client_ip,
            source_port=request.client.port if request.client else None,
            http_method=request.method,
            request_path=str(request.url.path),
            query_params=dict(request.query_params),
            headers_sanitized=sanitize_headers(dict(request.headers)),
            user_agent=request.headers.get("user-agent", "")[:500],
            event_type="password_recovery_attempt",
            severity=severity,
            is_test_event=is_test,
            correlation_id=(
                request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8]
            )[:64],
            metadata_payload=metadata,
        )
        db.add(sec_event)
        await db.commit()
    except Exception as e:  # noqa: BLE001
        logger.error(
            f"bank_recover telemetry error: {e}",
            extra={"source_ip": client_ip},
        )

    return JSONResponse(
        status_code=200,
        content={"message": "If an account matching that information exists, you will receive an email shortly."},
    )


# ----------------------------------------------------------------------------
# Task 7.2 — GET /bank/transfer
# ----------------------------------------------------------------------------


@router.get("/bank/transfer")
async def bank_transfer_page() -> HTMLResponse:
    """Renders the fund transfer page."""
    return HTMLResponse(content=_read_index_html())


# ----------------------------------------------------------------------------
# Task 7.2 — POST /api/v1/bank/transfer
# ----------------------------------------------------------------------------


@router.post("/api/v1/bank/transfer")
async def bank_transfer(
    request: Request,
    from_acct: str = Form(default=""),
    routing: str = Form(default=""),
    recipient: str = Form(default=""),
    amount: str = Form(default=""),
    memo: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Decoy fund transfer endpoint.

    Captures attacker-submitted transfer targets, suspicious amounts,
    and injection payloads. Never executes any real financial operation.
    Always returns a 'pending security review' response.
    """
    import re as _re  # noqa: F401 — kept for future pattern use
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = get_or_create_bank_decoy(db)

    # Detect injection in any field
    all_fields = [routing, recipient, amount, memo, from_acct]
    sqli_detected = any(_is_sqli(f) for f in all_fields)

    # Detect suspicious amount
    suspicious_amount = False
    try:
        amt_float = float(amount.replace(",", "").strip())
        if amt_float < 0.01 or amt_float > 1_000_000:
            suspicious_amount = True
    except (ValueError, AttributeError):
        suspicious_amount = True  # non-numeric

    event_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    base_metadata = {
        "decoy_brand": "meridian_trust_bank",
        "submitted_amount": _safe_meta(amount[:50]),
        "routing_number_length": len(routing),
        "recipient_name": _safe_meta(recipient[:60]),
    }

    objects_to_add = []

    # Base recon_probe (or sql_injection) event
    sec_event = SecurityEvent(
        id=event_id,
        decoy_service_id=decoy.id,
        timestamp=now_utc,
        source_ip=client_ip,
        source_port=request.client.port if request.client else None,
        http_method=request.method,
        request_path=str(request.url.path),
        query_params=dict(request.query_params),
        headers_sanitized=sanitize_headers(dict(request.headers)),
        user_agent=request.headers.get("user-agent", "")[:500],
        event_type="sql_injection" if sqli_detected else "recon_probe",
        severity="critical" if sqli_detected else "medium",
        is_test_event=is_test,
        correlation_id=(
            request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8]
        )[:64],
        metadata_payload=base_metadata,
    )
    objects_to_add.append(sec_event)

    # Additional suspicious_transfer event (only when no SQLi)
    if suspicious_amount and not sqli_detected:
        sus_meta = dict(base_metadata)
        sus_meta["suspicious_amount"] = True
        sus_event = SecurityEvent(
            id=uuid.uuid4(),
            decoy_service_id=decoy.id,
            timestamp=now_utc,
            source_ip=client_ip,
            source_port=request.client.port if request.client else None,
            http_method=request.method,
            request_path=str(request.url.path),
            query_params=dict(request.query_params),
            headers_sanitized=sanitize_headers(dict(request.headers)),
            user_agent=request.headers.get("user-agent", "")[:500],
            event_type="suspicious_transfer",
            severity="high",
            is_test_event=is_test,
            correlation_id=(
                request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8]
            )[:64],
            metadata_payload=sus_meta,
        )
        objects_to_add.append(sus_event)

    try:
        for obj in objects_to_add:
            db.add(obj)
        await db.commit()
    except Exception as e:  # noqa: BLE001
        logger.error(
            f"bank_transfer telemetry error: {e}",
            extra={"source_ip": client_ip},
        )

    ref = str(event_id)[:8].upper()
    return JSONResponse(
        status_code=200,
        content={"message": f"Transaction pending security review. Reference: MTB-{ref}"},
    )


# ----------------------------------------------------------------------------
# Task 7.4 — GET /bank/support
# ----------------------------------------------------------------------------


@router.get("/bank/support")
async def bank_support_page() -> HTMLResponse:
    """Renders the customer support and contact form page."""
    return HTMLResponse(content=_read_index_html())


# ----------------------------------------------------------------------------
# Task 7.4 — POST /api/v1/bank/support/contact
# ----------------------------------------------------------------------------


@router.post("/api/v1/bank/support/contact")
async def bank_support_contact(
    request: Request,
    full_name: str = Form(default=""),
    email: str = Form(default=""),
    subject: str = Form(default=""),
    message: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Decoy customer support contact endpoint.

    Captures social engineering and reconnaissance queries. Only logs
    message length (never message content) unless injection is detected.
    Always returns the same neutral confirmation.
    """
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = get_or_create_bank_decoy(db)

    injection_detected = _is_sqli(message) or _is_xss(message)
    severity = "high" if injection_detected else "low"

    metadata = {
        "decoy_brand": "meridian_trust_bank",
        "subject": _safe_meta(subject[:100]),
        "message_length": len(message),
    }
    if injection_detected:
        metadata["injection_detected"] = True

    try:
        now_utc = datetime.now(timezone.utc)
        sec_event = SecurityEvent(
            id=uuid.uuid4(),
            decoy_service_id=decoy.id,
            timestamp=now_utc,
            source_ip=client_ip,
            source_port=request.client.port if request.client else None,
            http_method=request.method,
            request_path=str(request.url.path),
            query_params=dict(request.query_params),
            headers_sanitized=sanitize_headers(dict(request.headers)),
            user_agent=request.headers.get("user-agent", "")[:500],
            event_type="recon_probe",
            severity=severity,
            is_test_event=is_test,
            correlation_id=(
                request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8]
            )[:64],
            metadata_payload=metadata,
        )
        db.add(sec_event)
        await db.commit()
    except Exception as e:  # noqa: BLE001
        logger.error(
            f"bank_support_contact telemetry error: {e}",
            extra={"source_ip": client_ip},
        )

    return JSONResponse(
        status_code=200,
        content={
            "message": (
                "Thank you for contacting us. "
                "A representative will respond within 2 business days."
            )
        },
    )


# ----------------------------------------------------------------------------
# Task 7.3a — GET /bank/statements page
# ----------------------------------------------------------------------------

@router.get("/bank/statements")
async def bank_statements_page() -> HTMLResponse:
    """Renders the statements and KYC document upload page."""
    return HTMLResponse(content=_read_index_html())


# ----------------------------------------------------------------------------
# Task 7.3b — GET /api/v1/bank/statements/{filename} (honeytoken PDF)
# ----------------------------------------------------------------------------

# Fixed honeytoken UUIDs per filename so canary tracking works across downloads.
_HONEYTOKEN_IDS: dict[str, str] = {
    "statement-2024-10.pdf": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "statement-2024-09.pdf": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "statement-2024-08.pdf": "c3d4e5f6-a7b8-9012-cdef-123456789012",
}


@router.get("/api/v1/bank/statements/{filename}")
async def bank_statement_download(
    filename: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Serves a fake PDF statement containing an embedded honeytoken.

    The honeytoken string ARGUS-HT-{uuid} in the body can be used to detect
    exfiltration — if the token appears on paste-sites or in threat intel feeds,
    it means an attacker downloaded and shared the file.
    """
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = get_or_create_bank_decoy(db)

    # Only serve known statement files
    allowed_files = set(_HONEYTOKEN_IDS.keys())
    if filename not in allowed_files:
        return HTMLResponse(content="Not found", status_code=404)

    token_id = _HONEYTOKEN_IDS[filename]
    honeytoken = f"ARGUS-HT-{token_id}"

    # Fake PDF body — plain text served as application/pdf
    pdf_body = f"""%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
/Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>
endobj
4 0 obj << /Length 420 >>
stream
BT /F1 12 Tf 72 720 Td (Meridian Trust Bank) Tj
0 -24 Td (Account Statement) Tj
0 -24 Td ({filename.replace('.pdf','').replace('-',' ').title()}) Tj
0 -24 Td (Account Holder: J. Hartwell) Tj
0 -24 Td (Account: ****7823) Tj
0 -60 Td (This document is confidential and intended solely for the named account holder.) Tj
0 -24 Td (Reference: {honeytoken}) Tj
ET
endstream
endobj
xref
0 5
trailer << /Size 5 /Root 1 0 R >>
startxref 0
%%EOF"""

    # Log honeytoken access
    try:
        now_utc = datetime.now(timezone.utc)
        sec_event = SecurityEvent(
            id=uuid.uuid4(),
            decoy_service_id=decoy.id,
            timestamp=now_utc,
            source_ip=client_ip,
            source_port=request.client.port if request.client else None,
            http_method=request.method,
            request_path=str(request.url.path),
            query_params=dict(request.query_params),
            headers_sanitized=sanitize_headers(dict(request.headers)),
            user_agent=request.headers.get("user-agent", "")[:500],
            event_type="honeytoken_accessed",
            severity="critical",
            is_test_event=is_test,
            correlation_id=(request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8])[:64],
            metadata_payload={
                "decoy_brand": "meridian_trust_bank",
                "honeytoken_id": honeytoken,
                "filename": filename,
            },
        )
        db.add(sec_event)
        await db.commit()
    except Exception as e:
        logger.error(f"bank_statement honeytoken log error: {e}", extra={"source_ip": client_ip})

    return Response(
        content=pdf_body.encode("utf-8"),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ----------------------------------------------------------------------------
# Task 7.3c — POST /api/v1/bank/kyc/upload
# ----------------------------------------------------------------------------

@router.post("/api/v1/bank/kyc/upload")
async def bank_kyc_upload(
    request: Request,
    file: UploadFile = File(default=None),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Safely quarantines uploaded KYC documents and logs file upload telemetry.

    Uses the existing quarantine pipeline — UUID filename, SHA-256, chmod 0600.
    Never executes or parses the uploaded file.
    """
    import os

    from app.core.quarantine import store_quarantined_upload
    from app.models.captured_file import CapturedFile

    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = get_or_create_bank_decoy(db)

    if file is None:
        return JSONResponse(status_code=400, content={"message": "No file was uploaded."})

    # Validate extension
    allowed_exts = {".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx"}
    _, ext = os.path.splitext((file.filename or "").lower())
    if ext not in allowed_exts:
        return JSONResponse(
            status_code=400,
            content={"message": "Unsupported file type. Please upload JPG, PNG, PDF, DOC, or DOCX files only."},
        )

    # Quarantine the file
    success, result = await store_quarantined_upload(file)

    # Determine event type based on result
    event_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    # Check for executable MIME types
    detected_mime = result.get("detected_mime", result.get("detected_mime_type", "unknown"))
    executable_mimes = {
        "application/x-executable-elf",
        "application/x-dosexec-pe",
        "text/x-shellscript",
        "text/x-php",
    }
    is_executable = detected_mime in executable_mimes

    if not success or is_executable:
        rejection_reason = result.get("rejection_reason", "executable_content_detected" if is_executable else "upload_failed")
        event_type = "file_upload_rejected"
        event_severity = "high"
        metadata = {
            "decoy_brand": "meridian_trust_bank",
            "sanitized_filename": result.get("sanitized_name", "unknown")[:255],
            "file_size_bytes": result.get("size", 0),
            "detected_mime_type": detected_mime,
            "rejection_reason": _safe_meta(rejection_reason[:255]),
        }
    else:
        event_type = "file_upload"
        event_severity = "critical"
        metadata = {
            "decoy_brand": "meridian_trust_bank",
            "sanitized_filename": result.get("sanitized_name", "unknown")[:255],
            "sha256_hash": result.get("sha256", ""),
            "file_size_bytes": result.get("size", 0),
            "detected_mime_type": detected_mime,
        }

    try:
        sec_event = SecurityEvent(
            id=event_id,
            decoy_service_id=decoy.id,
            timestamp=now_utc,
            source_ip=client_ip,
            source_port=request.client.port if request.client else None,
            http_method=request.method,
            request_path=str(request.url.path),
            query_params=dict(request.query_params),
            headers_sanitized=sanitize_headers(dict(request.headers)),
            user_agent=request.headers.get("user-agent", "")[:500],
            event_type=event_type,
            severity=event_severity,
            is_test_event=is_test,
            correlation_id=(request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8])[:64],
            metadata_payload=metadata,
        )
        db.add(sec_event)

        if success and not is_executable:
            captured = CapturedFile(
                id=uuid.uuid4(),
                event_id=event_id,
                original_filename_sanitized=result.get("sanitized_name", "unknown")[:255],
                internal_storage_path=result.get("internal_path", "")[:512],
                sha256_hash=result.get("sha256", ""),
                file_size_bytes=result.get("size", 0),
                declared_mime_type=(file.content_type or "application/octet-stream")[:100],
                detected_mime_type=detected_mime[:100],
                quarantine_status="quarantined",
                rejection_reason=None,
                source_ip=client_ip,
                upload_timestamp=now_utc,
            )
            db.add(captured)

        await db.commit()
    except Exception as e:
        logger.error(f"bank_kyc_upload telemetry error: {e}", extra={"source_ip": client_ip})

    if not success or is_executable:
        return JSONResponse(
            status_code=400,
            content={"message": "The submitted file is not supported for document verification. Please upload a JPG, PNG, or PDF."},
        )

    return JSONResponse(
        status_code=200,
        content={"message": "Your document has been received and is under review. We will notify you within 2 business days."},
    )




# ----------------------------------------------------------------------------
# React app SPA pages — serve index.html for client-side routes
# ----------------------------------------------------------------------------

@router.get("/bank/about")
@router.get("/bank/products")
@router.get("/bank/branches")
@router.get("/bank/news")
@router.get("/bank/investor")
@router.get("/bank/security")
@router.get("/bank/cards")
async def bank_spa_page() -> HTMLResponse:
    """Renders the React SPA shell for client-side routed pages."""
    return HTMLResponse(content=_read_index_html())

# ----------------------------------------------------------------------------
# React app static assets — GET /bank-app/{path:path}
# MUST be registered before the /bank/{path:path} catch-all
# ----------------------------------------------------------------------------
import mimetypes as _mimetypes
from urllib.parse import unquote as _url_unquote


@router.get("/bank-app/{path:path}")
async def bank_app_static(path: str) -> Response:
    """Serves compiled React app assets from decoy/static/bank-app/.

    Path-traversal guard: resolves the full path and verifies it is a
    strict descendant of BANK_APP_DIR before returning any content.
    Returns HTTP 404 for any path that escapes the directory or does not exist.
    """
    safe_path = _url_unquote(path)

    try:
        target = (BANK_APP_DIR / safe_path).resolve()
    except Exception:
        return Response(status_code=404)

    # Strict containment check
    try:
        target.relative_to(BANK_APP_DIR.resolve())
    except ValueError:
        return Response(status_code=404)

    if not target.is_file():
        return Response(status_code=404)

    media_type, _ = _mimetypes.guess_type(str(target))
    return FileResponse(str(target), media_type=media_type or "application/octet-stream")


# ----------------------------------------------------------------------------
# Task 5.3 — GET /bank/{path:path}  (catch-all — MUST remain last)
# ----------------------------------------------------------------------------


@router.get("/bank/{path:path}")
async def bank_not_found(path: str) -> HTMLResponse:
    """Catch-all: any unmatched /bank/* path returns a branded 404.

    The unified 404 handler in decoy_main.py would catch this anyway,
    but registering it explicitly ensures bank-branded HTML is returned
    rather than the generic Apache 404.
    """
    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Found — Meridian Trust Bank</title>
  <link rel="stylesheet" href="/bank/static/bank.css">
</head>
<body>
  <nav class="nav">
    <a href="/bank" class="nav-brand">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M16 2L4 7V16C4 22.6 9.4 28.6 16 30C22.6 28.6 28 22.6 28 16V7L16 2Z" fill="#0d9488"/>
        <path d="M10 22V10L16 17.5L22 10V22H20V14.5L16 20.5L12 14.5V22H10Z" fill="#ffffff"/>
      </svg>
      Meridian Trust Bank
    </a>
  </nav>
  <div class="nav-spacer"></div>
  <div class="auth-wrap">
    <div class="auth-card" style="text-align:center;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="1.5" style="margin:0 auto var(--s2);" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <h1 class="auth-title" style="font-size:1.375rem;">Page Not Found</h1>
      <p class="auth-subtitle" style="margin-top:var(--s1);">The page you requested could not be found.</p>
      <a href="/bank" class="btn-primary" style="margin-top:var(--s4);display:inline-flex;">Return to Home</a>
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html_body, status_code=404)
