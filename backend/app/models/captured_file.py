"""CapturedFile model representing safe quarantined uploads."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.user import GUID


class CapturedFile(Base):
    __tablename__ = "captured_files"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID, primary_key=True, default=uuid.uuid4, index=True
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("security_events.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    original_filename_sanitized: Mapped[str] = mapped_column(String(255), nullable=False)
    internal_storage_path: Mapped[str] = mapped_column(
        String(512), nullable=False, comment="Isolated UUID path in quarantine directory"
    )
    sha256_hash: Mapped[str] = mapped_column(
        String(64), index=True, nullable=False, comment="SHA-256 cryptographic checksum"
    )
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    declared_mime_type: Mapped[str] = mapped_column(String(100), default="application/octet-stream", nullable=False)
    detected_mime_type: Mapped[str] = mapped_column(String(100), default="unknown", nullable=False)
    quarantine_status: Mapped[str] = mapped_column(
        String(30), default="quarantined", index=True, nullable=False
    )  # quarantined, analyzed, archived, rejected
    rejection_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_ip: Mapped[str] = mapped_column(String(45), index=True, nullable=False)
    upload_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    security_event = relationship("SecurityEvent", back_populates="captured_file")
