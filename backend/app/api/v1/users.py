"""User management and profile endpoints for ARGUS SOC Dashboard."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.security import extract_client_ip, hash_password, verify_password
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.auth import UserCreate, UserResponse

router = APIRouter(prefix="/users", tags=["User Management"])


# ─── Request/Response Schemas ────────────────────────────────────────────────

class ProfileUpdateRequest(BaseModel):
    """Update own username and/or email."""
    username: str | None = Field(None, min_length=3, max_length=64)
    email: str | None = Field(None, min_length=3, max_length=255)


class PasswordChangeRequest(BaseModel):
    """Change own password — requires current password for verification."""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class RoleUpdateRequest(BaseModel):
    """Change a user's role (admin only)."""
    role: str = Field(..., pattern="^(admin|analyst|auditor)$")


class StatusUpdateRequest(BaseModel):
    """Activate or deactivate a user (admin only)."""
    is_active: bool


# ─── Own-Profile Endpoints ────────────────────────────────────────────────────

@router.put("/me", response_model=UserResponse)
async def update_my_profile(
    body: ProfileUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's own username and/or email."""
    if body.username and body.username != current_user.username:
        existing = await db.execute(select(User).where(User.username == body.username))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Username already taken")
        current_user.username = body.username

    if body.email and body.email != current_user.email:
        existing = await db.execute(select(User).where(User.email == body.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already in use")
        current_user.email = body.email

    current_user.updated_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        user_id=current_user.id,
        action="USER_PROFILE_UPDATED",
        target_type="user",
        target_id=str(current_user.id),
        ip_address=extract_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        details={"fields_changed": [k for k, v in body.model_dump(exclude_none=True).items()]},
    ))
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.put("/me/password", response_model=dict)
async def change_my_password(
    body: PasswordChangeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the authenticated user's own password."""
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match")

    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password")

    current_user.hashed_password = hash_password(body.new_password)
    current_user.updated_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        user_id=current_user.id,
        action="USER_PASSWORD_CHANGED",
        target_type="user",
        target_id=str(current_user.id),
        ip_address=extract_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        details={},
    ))
    await db.commit()
    return {"detail": "Password updated successfully"}


# ─── Admin: User Management Endpoints ────────────────────────────────────────

@router.get("", response_model=list[UserResponse])
async def list_users(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all registered dashboard users (admin only)."""
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new dashboard user account (admin only)."""
    # Uniqueness checks
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken")

    existing_email = await db.execute(select(User).where(User.email == body.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already in use")

    new_user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=body.is_active,
    )
    db.add(new_user)
    db.add(AuditLog(
        user_id=current_user.id,
        action="USER_CREATED",
        target_type="user",
        target_id=body.username,
        ip_address=extract_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        details={"role": body.role, "created_by": current_user.username},
    ))
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.put("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: UUID,
    body: RoleUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Change a user's role (admin only). Admins cannot change their own role."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = target.role
    target.role = body.role
    target.updated_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        user_id=current_user.id,
        action="USER_ROLE_CHANGED",
        target_type="user",
        target_id=str(user_id),
        ip_address=extract_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        details={"old_role": old_role, "new_role": body.role, "changed_by": current_user.username},
    ))
    await db.commit()
    await db.refresh(target)
    return target


@router.put("/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: UUID,
    body: StatusUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Activate or deactivate a user account (admin only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own account status")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.is_active = body.is_active
    target.updated_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        user_id=current_user.id,
        action="USER_STATUS_CHANGED",
        target_type="user",
        target_id=str(user_id),
        ip_address=extract_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        details={"is_active": body.is_active, "changed_by": current_user.username},
    ))
    await db.commit()
    await db.refresh(target)
    return target


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a user account (admin only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    username_snapshot = target.username
    db.add(AuditLog(
        user_id=current_user.id,
        action="USER_DELETED",
        target_type="user",
        target_id=str(user_id),
        ip_address=extract_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        details={"deleted_username": username_snapshot, "deleted_by": current_user.username},
    ))
    await db.delete(target)
    await db.commit()
