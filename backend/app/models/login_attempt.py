"""LoginAttempt model recording decoy credential submissions without plaintext passwords."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.user import GUID


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID, primary_key=True, default=uuid.uuid4, index=True
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("security_events.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    submitted_username: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    
    # Security constraint: NEVER store plaintext passwords
    password_length: Mapped[int] = mapped_column(Integer, nullable=False)
    password_hmac_fingerprint: Mapped[str] = mapped_column(
        String(64), index=True, nullable=False, comment="HMAC-SHA256 fingerprint using server secret key"
    )
    
    is_flagged_credential: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # Decoy always returns False
    failure_reason: Mapped[str] = mapped_column(String(100), default="invalid_credentials_simulated", nullable=False)
    client_ip: Mapped[str] = mapped_column(String(45), nullable=False)
    user_agent: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    security_event = relationship("SecurityEvent", back_populates="login_attempt")
