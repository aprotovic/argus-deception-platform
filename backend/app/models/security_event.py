"""SecurityEvent model - the central immutable telemetry log."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.user import GUID


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID, primary_key=True, default=uuid.uuid4, index=True
    )
    decoy_service_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("decoy_services.id", ondelete="SET NULL"), nullable=True, index=True
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False
    )
    source_ip: Mapped[str] = mapped_column(String(45), index=True, nullable=False)
    source_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    http_method: Mapped[str] = mapped_column(String(10), nullable=False)
    request_path: Mapped[str] = mapped_column(String(1024), index=True, nullable=False)
    query_params: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    headers_sanitized: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    user_agent: Mapped[str] = mapped_column(Text, default="", nullable=False)
    
    # Event Classification
    # event_type: login_attempt, file_upload, recon_probe, unauthorized_access, malformed_request
    event_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    # severity: low, medium, high, critical
    severity: Mapped[str] = mapped_column(String(20), index=True, default="low", nullable=False)
    
    # Distinguish test verification traffic from genuine internet interactions
    is_test_event: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    
    correlation_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    metadata_payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    decoy_service = relationship("DecoyService", back_populates="security_events")
    login_attempt = relationship("LoginAttempt", back_populates="security_event", uselist=False, cascade="all, delete-orphan")
    captured_file = relationship("CapturedFile", back_populates="security_event", uselist=False, cascade="all, delete-orphan")
