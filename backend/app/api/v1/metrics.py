"""SOC Overview metrics endpoints computed directly from database telemetry."""

from datetime import datetime, timedelta, timezone
from typing import Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.database import get_db
from app.models.captured_file import CapturedFile
from app.models.login_attempt import LoginAttempt
from app.models.security_event import SecurityEvent
from app.models.user import User
from app.schemas.metrics import HourlyActivity, OverviewMetrics

router = APIRouter(prefix="/overview", tags=["SOC Overview"])


@router.get("/metrics", response_model=OverviewMetrics)
async def get_overview_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Computes real, genuine telemetry statistics from the database.
    NEVER returns fabricated or simulated counts.
    """
    now = datetime.now(timezone.utc)
    twenty_four_hours_ago = now - timedelta(hours=24)

    # 1. Total observed events
    total_events_res = await db.execute(select(func.count(SecurityEvent.id)))
    total_events = total_events_res.scalar_one()

    # 2. Events last 24h
    events_24h_res = await db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.timestamp >= twenty_four_hours_ago)
    )
    events_24h = events_24h_res.scalar_one()

    # 3. Unique source IP addresses
    unique_ips_res = await db.execute(select(func.count(distinct(SecurityEvent.source_ip))))
    unique_ips = unique_ips_res.scalar_one()

    # 4. Failed login attempts
    failed_logins_res = await db.execute(select(func.count(LoginAttempt.id)))
    failed_logins = failed_logins_res.scalar_one()

    # 5. Captured and rejected uploads
    captured_files_res = await db.execute(
        select(func.count(CapturedFile.id)).where(CapturedFile.quarantine_status == "quarantined")
    )
    captured_files = captured_files_res.scalar_one()

    rejected_uploads_res = await db.execute(
        select(func.count(CapturedFile.id)).where(CapturedFile.quarantine_status == "rejected")
    )
    rejected_uploads = rejected_uploads_res.scalar_one()

    # 6. Events by severity breakdown
    severity_res = await db.execute(
        select(SecurityEvent.severity, func.count(SecurityEvent.id)).group_by(SecurityEvent.severity)
    )
    events_by_severity: Dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for row in severity_res.all():
        sev_name, sev_count = row[0], row[1]
        if sev_name in events_by_severity:
            events_by_severity[sev_name] = sev_count

    # 7. Events by type breakdown
    type_res = await db.execute(
        select(SecurityEvent.event_type, func.count(SecurityEvent.id)).group_by(SecurityEvent.event_type)
    )
    events_by_type: Dict[str, int] = {
        "login_attempt": 0,
        "file_upload": 0,
        "recon_probe": 0,
        "unauthorized_access": 0,
        "malformed_request": 0,
    }
    for row in type_res.all():
        t_name, t_count = row[0], row[1]
        if t_name in events_by_type:
            events_by_type[t_name] = t_count

    # 8. Activity trend over last 6 intervals (4 hours each or 1 hour each)
    recent_activity: List[HourlyActivity] = []
    for i in range(5, -1, -1):
        window_start = now - timedelta(hours=(i + 1) * 4)
        window_end = now - timedelta(hours=i * 4)
        count_res = await db.execute(
            select(func.count(SecurityEvent.id))
            .where(SecurityEvent.timestamp >= window_start)
            .where(SecurityEvent.timestamp < window_end)
        )
        count = count_res.scalar_one()
        recent_activity.append(
            HourlyActivity(
                hour=f"-{i*4}h" if i > 0 else "Now",
                count=count,
            )
        )

    return OverviewMetrics(
        total_events=total_events,
        events_last_24h=events_24h,
        unique_ips=unique_ips,
        failed_logins=failed_logins,
        quarantined_files=captured_files,
        rejected_uploads=rejected_uploads,
        events_by_severity=events_by_severity,
        events_by_type=events_by_type,
        recent_activity=recent_activity,
    )
