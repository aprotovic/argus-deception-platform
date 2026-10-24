"""Threat intelligence endpoints: GeoIP attack map and attacker threat scoring."""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import desc, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.geoip import resolve_ip
from app.database import get_db
from app.models.security_event import SecurityEvent
from app.models.user import User

router = APIRouter(prefix="/intel", tags=["Threat Intelligence"])

# Threat score weights per event type
_WEIGHTS: Dict[str, int] = {
    "recon_probe": 1,
    "login_attempt": 2,
    "file_upload": 3,
    "terminal_exec": 4,
    "sql_injection": 5,
    "honeytoken_access": 4,
    "contractor_credential_use": 5,
    "unauthorized_access": 2,
    "db_query": 1,
    "malformed_request": 1,
}


def _threat_level(score: int) -> str:
    if score >= 25:
        return "critical"
    if score >= 15:
        return "high"
    if score >= 6:
        return "medium"
    return "low"


@router.get("/geo-map", response_model=List[Dict[str, Any]])
async def get_geo_map(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns GeoIP-resolved attack origin data for the world map.
    Each entry includes IP, location, event count, top event type,
    and maximum severity observed in the last 7 days.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    # Aggregate per IP: count, top event_type, max severity
    stmt = (
        select(
            SecurityEvent.source_ip,
            func.count(SecurityEvent.id).label("event_count"),
        )
        .where(SecurityEvent.timestamp >= cutoff)
        .where(SecurityEvent.is_test_event == False)
        .group_by(SecurityEvent.source_ip)
        .order_by(desc("event_count"))
        .limit(200)
    )
    result = await db.execute(stmt)
    rows = result.all()

    if not rows:
        return []

    ip_list = [r.source_ip for r in rows]
    count_map = {r.source_ip: r.event_count for r in rows}

    # Get top event_type per IP
    type_stmt = (
        select(SecurityEvent.source_ip, SecurityEvent.event_type, func.count().label("cnt"))
        .where(SecurityEvent.source_ip.in_(ip_list))
        .where(SecurityEvent.timestamp >= cutoff)
        .where(SecurityEvent.is_test_event == False)
        .group_by(SecurityEvent.source_ip, SecurityEvent.event_type)
    )
    type_result = await db.execute(type_stmt)
    type_rows = type_result.all()

    top_type: Dict[str, str] = {}
    type_counts: Dict[str, Dict[str, int]] = {}
    for row in type_rows:
        ip, et, cnt = row.source_ip, row.event_type, row.cnt
        if ip not in type_counts:
            type_counts[ip] = {}
        type_counts[ip][et] = cnt
    for ip, counts in type_counts.items():
        top_type[ip] = max(counts, key=counts.get)

    # Get max severity per IP
    sev_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    sev_stmt = (
        select(SecurityEvent.source_ip, SecurityEvent.severity)
        .where(SecurityEvent.source_ip.in_(ip_list))
        .where(SecurityEvent.timestamp >= cutoff)
        .where(SecurityEvent.is_test_event == False)
    )
    sev_result = await db.execute(sev_stmt)
    max_sev: Dict[str, str] = {}
    for row in sev_result.all():
        ip, sev = row.source_ip, row.severity
        if sev_order.get(sev, 0) > sev_order.get(max_sev.get(ip, "low"), 0):
            max_sev[ip] = sev

    # Resolve GeoIP concurrently
    geo_tasks = [resolve_ip(ip) for ip in ip_list]
    geo_results = await asyncio.gather(*geo_tasks)
    geo_map = dict(zip(ip_list, geo_results))

    output = []
    for ip in ip_list:
        geo = geo_map.get(ip, {})
        output.append({
            "ip": ip,
            "country": geo.get("country", ""),
            "country_code": geo.get("country_code", ""),
            "city": geo.get("city", ""),
            "lat": geo.get("lat", 0.0),
            "lon": geo.get("lon", 0.0),
            "isp": geo.get("isp", ""),
            "event_count": count_map.get(ip, 0),
            "top_event_type": top_type.get(ip, "recon_probe"),
            "max_severity": max_sev.get(ip, "low"),
        })

    return output


@router.get("/threat-scores", response_model=List[Dict[str, Any]])
async def get_threat_scores(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Computes a threat score for each unique attacker IP seen in the last 7 days.
    Score is based on event type weights plus severity bonuses.
    Returns results sorted by score descending.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    stmt = (
        select(
            SecurityEvent.source_ip,
            SecurityEvent.event_type,
            SecurityEvent.severity,
            SecurityEvent.timestamp,
        )
        .where(SecurityEvent.timestamp >= cutoff)
        .where(SecurityEvent.is_test_event == False)
        .order_by(SecurityEvent.source_ip, SecurityEvent.timestamp)
    )
    result = await db.execute(stmt)
    rows = result.all()

    # Aggregate per IP
    ip_data: Dict[str, Dict] = {}
    for row in rows:
        ip = row.source_ip
        if ip not in ip_data:
            ip_data[ip] = {
                "event_types": set(),
                "severities": set(),
                "first_seen": row.timestamp,
                "last_seen": row.timestamp,
                "event_count": 0,
                "score": 0,
            }
        d = ip_data[ip]
        d["event_types"].add(row.event_type)
        d["severities"].add(row.severity)
        d["event_count"] += 1
        d["score"] += _WEIGHTS.get(row.event_type, 1)
        if row.timestamp > d["last_seen"]:
            d["last_seen"] = row.timestamp
        if row.timestamp < d["first_seen"]:
            d["first_seen"] = row.timestamp

    # Apply severity bonus
    for d in ip_data.values():
        if "critical" in d["severities"]:
            d["score"] += 5
        elif "high" in d["severities"]:
            d["score"] += 3

    if not ip_data:
        return []

    # Resolve GeoIP concurrently
    ip_list = list(ip_data.keys())
    geo_results = await asyncio.gather(*[resolve_ip(ip) for ip in ip_list])
    geo_map = dict(zip(ip_list, geo_results))

    output = []
    for ip, d in ip_data.items():
        geo = geo_map.get(ip, {})
        score = d["score"]
        output.append({
            "ip": ip,
            "score": score,
            "level": _threat_level(score),
            "event_count": d["event_count"],
            "event_types": sorted(d["event_types"]),
            "first_seen": d["first_seen"].isoformat(),
            "last_seen": d["last_seen"].isoformat(),
            "country": geo.get("country", ""),
            "country_code": geo.get("country_code", ""),
        })

    output.sort(key=lambda x: x["score"], reverse=True)
    return output
