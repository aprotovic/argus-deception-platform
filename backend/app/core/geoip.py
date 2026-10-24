"""GeoIP resolution using ip-api.com free tier with in-memory caching."""

import ipaddress
import httpx
from app.logging_config import logger

_cache: dict = {}

_PRIVATE_STUB = {
    "country": "Internal",
    "country_code": "XX",
    "city": "",
    "lat": 0.0,
    "lon": 0.0,
    "isp": "",
}


def _is_private(ip: str) -> bool:
    """Return True for loopback, private, or link-local addresses."""
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback or addr.is_link_local
    except ValueError:
        return True


async def resolve_ip(ip: str) -> dict:
    """
    Resolve a public IP to GeoIP metadata.
    Returns a dict with: country, country_code, city, lat, lon, isp.
    Private/loopback addresses return the Internal stub immediately.
    Results are cached for the lifetime of the process.
    """
    if _is_private(ip):
        return _PRIVATE_STUB.copy()

    if ip in _cache:
        return _cache[ip]

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "country,countryCode,city,lat,lon,isp,status"},
            )
            data = resp.json()
            if data.get("status") == "success":
                result = {
                    "country": data.get("country", ""),
                    "country_code": data.get("countryCode", ""),
                    "city": data.get("city", ""),
                    "lat": float(data.get("lat", 0)),
                    "lon": float(data.get("lon", 0)),
                    "isp": data.get("isp", ""),
                }
                _cache[ip] = result
                return result
    except Exception as exc:
        logger.debug(f"GeoIP lookup failed for {ip}: {exc}")

    fallback = _PRIVATE_STUB.copy()
    _cache[ip] = fallback
    return fallback
