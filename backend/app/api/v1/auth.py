"""Authentication endpoints for ARGUS SOC Dashboard operators."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.core.security import (
    create_access_token,
    extract_client_ip,
    verify_password,
)
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.auth import LoginRequest, Token, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Authenticates a SOC analyst or administrator and returns a JWT access token."""
    stmt = select(User).where(User.username == login_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    client_ip = extract_client_ip(request)
    user_agent = request.headers.get("user-agent", "")

    if not user or not verify_password(login_data.password, user.hashed_password):
        # Log failed dashboard auth attempt
        audit = AuditLog(
            user_id=user.id if user else None,
            action="AUTH_LOGIN_FAILED",
            target_type="dashboard_auth",
            target_id=login_data.username,
            ip_address=client_ip,
            user_agent=user_agent,
            details={"reason": "invalid_credentials"},
        )
        db.add(audit)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    # Update last login time
    user.last_login_at = datetime.now(timezone.utc)

    # Record successful login in audit log
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


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile and active role."""
    return current_user
