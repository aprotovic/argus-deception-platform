"""Telegram user access control, subscription, and activity tracking model for ARGUS."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.user import GUID


class TelegramUser(Base):
    """
    Persistent access-control record for Telegram bot users.
    Enforces server-side authorization: only 'approved' users can access features,
    and only 'admin' can approve, reject, revoke, or delete other accounts.
    Tracks per-user activity: last command, command count, and a rolling command history.
    """
    __tablename__ = "telegram_users"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID, primary_key=True, default=uuid.uuid4, index=True
    )
    telegram_id: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    username: Mapped[str | None] = mapped_column(String(128), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="user", nullable=False)   # "admin" | "user"
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)  # "approved" | "pending" | "revoked" | "rejected"
    is_subscribed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    approved_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    promoted_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    promoted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Activity tracking
    last_command: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    command_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # JSON-encoded list of last 10 commands: [{"cmd": "/status", "ts": "..."}, ...]
    command_history: Mapped[str | None] = mapped_column(Text, nullable=True)
