"""GeoIP resolution using ip-api.com free tier with in-memory caching and host-fallback."""

import ipaddress
import httpx
from app.logging_config import logger

_cache: dict = {}

# Default host location when testing locally (detected or fallback)
_HOST_FALLBACK = {
    "country": "Ethiopia",
    "country_code": "ET",
    "city": "Addis Ababa",
    "lat": 9.0245,
    "lon": 38.7485,
    "isp": "Localhost Host Gateway",
}

_host_resolved: dict | None = None


def _is_private(ip: str) -> bool:
    """Return True for loopback, private, or link-local addresses."""
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback or addr.is_link_local
    except ValueError:
        return True


async def _get_host_location() -> dict:
    """Resolve the host machine's public geolocation once for localhost demo mapping."""
    global _host_resolved
    if _host_resolved is not None:
        return _host_resolved.copy()

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                "http://ip-api.com/json",
                params={"fields": "country,countryCode,city,lat,lon,isp,status"},
            )
            data = resp.json()
            if data.get("status") == "success":
                _host_resolved = {
                    "country": data.get("country", _HOST_FALLBACK["country"]),
                    "country_code": data.get("countryCode", _HOST_FALLBACK["country_code"]),
                    "city": data.get("city", _HOST_FALLBACK["city"]),
                    "lat": float(data.get("lat", _HOST_FALLBACK["lat"])),
                    "lon": float(data.get("lon", _HOST_FALLBACK["lon"])),
                    "isp": f"Localhost Gateway ({data.get('isp', 'Host')})",
                }
                return _host_resolved.copy()
    except Exception as exc:
        logger.debug(f"Host public GeoIP resolution failed: {exc}")

    _host_resolved = _HOST_FALLBACK.copy()
    return _host_resolved.copy()


async def resolve_ip(ip: str) -> dict:
    """
    Resolve an IP to GeoIP metadata.
    Returns a dict with: country, country_code, city, lat, lon, isp.
    For local dev addresses (127.0.0.1, etc.), maps to the developer's host location
    so attacks are visible on the map during development and graduation demos.
    """
    if ip in _cache:
        return _cache[ip]

    if _is_private(ip):
        host_loc = await _get_host_location()
        _cache[ip] = host_loc
        return host_loc

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

    fallback = await _get_host_location()
    _cache[ip] = fallback
    return fallback
