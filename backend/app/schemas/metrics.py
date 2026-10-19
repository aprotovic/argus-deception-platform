"""SOC Metrics and Overview Pydantic schemas."""

from typing import Dict, List
from pydantic import BaseModel


class SeverityCount(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class EventTypeCount(BaseModel):
    login_attempt: int = 0
    file_upload: int = 0
    recon_probe: int = 0
    unauthorized_access: int = 0
    malformed_request: int = 0


class HourlyActivity(BaseModel):
    hour: str
    count: int


class OverviewMetrics(BaseModel):
    total_events: int
    events_last_24h: int
    unique_ips: int
    failed_logins: int
    quarantined_files: int
    rejected_uploads: int
    events_by_severity: Dict[str, int]
    events_by_type: Dict[str, int]
    recent_activity: List[HourlyActivity]
