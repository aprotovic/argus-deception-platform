"""DecoyService model representing deployed deception portals."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.user import GUID


class DecoyService(Base):
    __tablename__ = "decoy_services"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID, primary_key=True, default=uuid.uuid4, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    portal_type: Mapped[str] = mapped_column(String(50), nullable=False, default="defense_contractor")
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=8080, nullable=False)
    banner_title: Mapped[str] = mapped_column(String(255), default="Nexis Defense Core Portal", nullable=False)
    config_metadata: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    security_events = relationship("SecurityEvent", back_populates="decoy_service")
