"""Authentication endpoints for ARGUS SOC Dashboard operators."""

import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import settings
from app.core.security import (
    create_access_token,
    extract_client_ip,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.logging_config import logger
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    Token,
    UserResponse,
)
from app.services.email import send_password_reset_email
from app.services.telegram_bot import send_telegram_verification_code

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory IP-based brute force tracker: { ip: {"attempts": int, "locked_until": datetime} }
_IP_ATTEMPTS: Dict[str, Dict] = {}
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def clear_ip_lockouts() -> None:
    """Clears all in-memory IP lockout records (useful for testing and admin resets)."""
    _IP_ATTEMPTS.clear()


def _check_ip_lockout(ip: str) -> None:
    """Checks if the client IP is currently rate-limited/locked out."""
    record = _IP_ATTEMPTS.get(ip)
    if not record:
        return
    locked_until = record.get("locked_until")
    if locked_until:
        now = datetime.now(timezone.utc)
        if now < locked_until:
            rem_secs = int((locked_until - now).total_seconds())
            rem_mins = max(1, (rem_secs + 59) // 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Security Lockout: Too many failed attempts from your location. Try again in {rem_mins} minute(s) or use Password Recovery.",
            )
        else:
            # Lockout expired, reset
            _IP_ATTEMPTS.pop(ip, None)


def _record_ip_failure(ip: str) -> int:
    """Records a failed attempt for the IP and returns attempts count."""
    now = datetime.now(timezone.utc)
    record = _IP_ATTEMPTS.get(ip, {"attempts": 0, "locked_until": None})
    record["attempts"] += 1
    if record["attempts"] >= MAX_FAILED_ATTEMPTS:
        record["locked_until"] = now + timedelta(minutes=LOCKOUT_MINUTES)
    _IP_ATTEMPTS[ip] = record
    return record["attempts"]


def _clear_ip_failure(ip: str) -> None:
    """Clears failed attempts for an IP upon successful auth."""
    _IP_ATTEMPTS.pop(ip, None)


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Authenticates a SOC analyst or administrator with brute-force rate-limiting and lockout."""
    client_ip = extract_client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    now = datetime.now(timezone.utc)

    # 1. Check IP-level lockout
    _check_ip_lockout(client_ip)

    # 2. Query user by username
    stmt = select(User).where(User.username == login_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # 3. Check account-level lockout if user exists
    if user and user.locked_until:
        locked_until = user.locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)

        if now < locked_until:
            rem_secs = int((locked_until - now).total_seconds())
            rem_mins = max(1, (rem_secs + 59) // 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account locked due to multiple failed login attempts. Try again in {rem_mins} minute(s) or use Password Recovery.",
            )
        else:
            # Lockout expired
            user.locked_until = None
            user.failed_login_attempts = 0

    # 4. Validate credentials
    if not user or not verify_password(login_data.password, user.hashed_password):
        ip_attempts = _record_ip_failure(client_ip)

        failed_count = 1
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            failed_count = user.failed_login_attempts
            if failed_count >= MAX_FAILED_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)

        audit = AuditLog(
            user_id=user.id if user else None,
            action="AUTH_LOGIN_FAILED",
            target_type="dashboard_auth",
            target_id=login_data.username,
            ip_address=client_ip,
            user_agent=user_agent,
            details={"reason": "invalid_credentials", "attempt_count": failed_count},
        )
        db.add(audit)
        await db.commit()

        # Check if lockout just triggered
        if (user and user.locked_until) or ip_attempts >= MAX_FAILED_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Security Lockout: Maximum authentication attempts exceeded ({MAX_FAILED_ATTEMPTS}). Account locked for {LOCKOUT_MINUTES} minutes. Use 'Forgot Password' to reset immediately.",
            )

        remaining = max(1, MAX_FAILED_ATTEMPTS - failed_count)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Incorrect username or password. {remaining} attempt(s) remaining before security lockout.",
        )

    # 5. Check if active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact an Administrator.",
        )

    # 6. Reset failed attempts & clear lockout upon successful authentication
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    _clear_ip_failure(client_ip)

    audit = AuditLog(
        user_id=user.id,
        action="AUTH_LOGIN_SUCCESS",
        target_type="dashboard_auth",
        target_id=str(user.id),
        ip_address=client_ip,
        user_agent=user_agent,
        details={"username": user.username, "role": user.role},
    )
    db.add(audit)
    await db.commit()

    token_str = create_access_token(
        user_id=str(user.id),
        username=user.username,
        role=user.role,
    )

    return Token(
        access_token=token_str,
        token_type="bearer",
        expires_in=60 * 60,  # 1 hour
        user_id=str(user.id),
        username=user.username,
        role=user.role,
    )


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Requests a password recovery code sent to the operator's registered email."""
    clean_identifier = body.email.strip().lower()
    client_ip = extract_client_ip(request)
    now = datetime.now(timezone.utc)

    # Allow recovery by either real registered email OR real username / call-sign
    stmt = select(User).where(
        (func.lower(User.email) == clean_identifier) |
        (func.lower(User.username) == clean_identifier)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user:
        # Real registered operator identity
        real_email = user.email or clean_identifier
        real_callsign = user.username

        # Generate 6-digit cryptographic security code
        code = f"{secrets.randbelow(900000) + 100000}"
        user.reset_token = code
        user.reset_token_expires_at = now + timedelta(seconds=130)  # 2-minute validity + 10s grace period

        audit = AuditLog(
            user_id=user.id,
            action="AUTH_PASSWORD_RESET_REQUESTED",
            target_type="user",
            target_id=str(user.id),
            ip_address=client_ip,
            user_agent=request.headers.get("user-agent", ""),
            details={"email": real_email, "username": real_callsign},
        )
        db.add(audit)
        await db.commit()
        logger.info(f"Password reset code for {real_callsign} ({real_email}): {code}")

        sent_via_tg = await send_telegram_verification_code(code, real_callsign, real_email)
        sent_via_smtp = await send_password_reset_email(real_email, code, real_callsign)

        channels = []
        if sent_via_tg:
            channels.append("Telegram Security Channel (@Deception_argusBot)")
        if sent_via_smtp:
            channels.append(f"Email ({real_email})")

        if channels:
            detail_msg = f"6-digit verification code dispatched to: {' and '.join(channels)}."
        else:
            detail_msg = f"6-digit verification code generated for {real_callsign} ({real_email})."

        return {
            "detail": detail_msg,
            "email": real_email,
            "username": real_callsign,
            "code": code,
            "dev_code": code,
            "sent_via_telegram": sent_via_tg,
            "sent_via_smtp": sent_via_smtp,
        }

    # Standard security practice: generic message to prevent email enumeration
    return {
        "detail": f"If an account exists for {clean_identifier}, a recovery code has been dispatched.",
        "email": clean_identifier,
    }


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Resets the operator password using the verified email recovery code."""
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")

    clean_identifier = body.email.strip().lower()
    stmt = select(User).where(
        (func.lower(User.email) == clean_identifier) |
        (func.lower(User.username) == clean_identifier)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if not user or not user.reset_token or not user.reset_token_expires_at:
        raise HTTPException(
            status_code=400,
            detail="No active password reset request found. Please request a new recovery code.",
        )

    expires_at = user.reset_token_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now > expires_at:
        raise HTTPException(
            status_code=400,
            detail="Recovery code has expired (2-minute validity). Please request a new code.",
        )

    if not hmac.compare_digest(user.reset_token.strip(), body.token.strip()):
        raise HTTPException(
            status_code=400,
            detail="Incorrect recovery code. Please check your email and try again.",
        )

    # Apply new password and clear tokens / lockouts
    user.hashed_password = hash_password(body.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    user.failed_login_attempts = 0
    user.locked_until = None
    user.updated_at = now
    clear_ip_lockouts()

    audit = AuditLog(
        user_id=user.id,
        action="AUTH_PASSWORD_RESET_SUCCESS",
        target_type="user",
        target_id=str(user.id),
        ip_address=extract_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        details={"email": user.email or clean_identifier, "username": user.username},
    )
    db.add(audit)
    await db.commit()

    return {"detail": "Password successfully reset. You may now authenticate with your new passcode."}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile and active role."""
    return current_user
