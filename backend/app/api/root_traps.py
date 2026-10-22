"""Root-level scanner traps, honeytoken breadcrumbs, and decoy portal routes.

Extracted from app/main.py (task 2 of the decoy-split spec) so that
app/decoy_main.py can include this router without pulling in the full
admin API or the database engine.

No behavior changes — every path, response body, status code, header,
and logging call is identical to the original main.py implementation.
"""

from pathlib import Path

from fastapi import APIRouter, Request, status
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse

from app.core.event_sink import get_event_sink
from app.logging_config import logger

router = APIRouter()


# ============================================================================
# HELPER: record a security event for a root-level probe
# ============================================================================
async def record_root_trap(
    request: Request,
    path: str,
    severity: str = "high",
    event_type: str = "recon_probe",
    summary: str = None,
    honeytoken_info: dict = None,
):
    """Captures direct scanner recon probes at the domain root into security telemetry."""
    try:
        from app.models.security_event import SecurityEvent
        from app.core.security import extract_client_ip, sanitize_headers
        import uuid
        from datetime import datetime, timezone

        client_ip = extract_client_ip(request)
        is_test = bool(request.headers.get("x-argus-test-token") or request.query_params.get("test") in ["1", "true"])
        event_id = uuid.uuid4()
        now_utc = datetime.now(timezone.utc)

        metadata = {"probed_path": path}
        if honeytoken_info:
            metadata.update(honeytoken_info)

        msg = summary or f"Scanner reconnaissance probe on '{path}'"

        sec_event = SecurityEvent(
            id=event_id,
            timestamp=now_utc,
            source_ip=client_ip,
            source_port=request.client.port if request.client else None,
            http_method=request.method,
            request_path=path,
            query_params=dict(request.query_params),
            headers_sanitized=sanitize_headers(dict(request.headers)),
            user_agent=request.headers.get("user-agent", "")[:500],
            event_type=event_type,
            severity=severity,
            is_test_event=is_test,
            correlation_id=str(uuid.uuid4())[:8],
            metadata_payload=metadata,
        )

        broadcast_summary = {
            "id": str(event_id),
            "timestamp": now_utc.isoformat(),
            "source_ip": client_ip,
            "event_type": event_type,
            "severity": severity,
            "request_path": path,
            "http_method": request.method,
            "user_agent": request.headers.get("user-agent", "")[:100],
            "is_test_event": is_test,
            "summary": msg,
        }

        await get_event_sink().persist([sec_event], broadcast_summary=broadcast_summary)
    except Exception as e:
        logger.error(f"Error recording root trap for {path}: {e}")


# ============================================================================
# DECOY PORTAL UI
# ============================================================================
@router.get("/", tags=["Decoy Interface"])
@router.get("/decoy", tags=["Decoy Interface"])
async def serve_decoy_portal():
    """Serves the authentic-looking decoy defense contractor portal."""
    # __file__ is backend/app/api/root_traps.py
    # .parent      -> backend/app/api/
    # .parent      -> backend/app/
    # .parent      -> backend/
    # .parent      -> repo root
    # / "decoy" / "templates" / "index.html"
    template_path = (
        Path(__file__).resolve().parent.parent.parent.parent
        / "decoy"
        / "templates"
        / "index.html"
    )
    if template_path.exists():
        return HTMLResponse(content=template_path.read_text(encoding="utf-8"))
    return {"message": "Nexis Defense Systems - Secure Portal"}


@router.get("/robots.txt", tags=["Decoy Interface"])
async def serve_decoy_robots():
    """Serves deceptive robots.txt pointing to honeytoken endpoints."""
    robots_content = (
        "User-agent: *\n"
        "Disallow: /admin-console/\n"
        "Disallow: /internal/backups/\n"
        "Disallow: /api/v1/decoy/honeytoken/config\n"
        "Disallow: /firmware/releases/\n"
        "Disallow: /satcom/uplink-keys/\n"
    )
    return PlainTextResponse(content=robots_content)


# ============================================================================
# HONEYTOKENS — direct file/secret probes
# ============================================================================
@router.get("/.env", tags=["Decoy Traps"])
async def trap_env(request: Request):
    await record_root_trap(request, "/.env", severity="high", honeytoken_info={"canary_token": "CANARY-ENV-NX784912"})
    return PlainTextResponse(
        "DATABASE_URL=postgresql://nx_admin:CanaryP@ssword2026!@10.42.18.5:5432/defense_ops\n"
        "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE_NXCANARY\n"
        "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n"
        "JWT_SECRET=super_secret_defense_enclave_key_do_not_share\n"
    )


@router.get("/.git/HEAD", tags=["Decoy Traps"])
async def trap_git_head(request: Request):
    await record_root_trap(request, "/.git/HEAD", severity="high")
    return PlainTextResponse("ref: refs/heads/main\n")


@router.get("/.git/config", tags=["Decoy Traps"])
async def trap_git_config(request: Request):
    await record_root_trap(request, "/.git/config", severity="high")
    return PlainTextResponse(
        "[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n"
        "[remote \"origin\"]\n\turl = git@git.defense.internal:nexis/tactical-portal.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n"
    )


@router.get("/.aws/credentials", tags=["Decoy Traps"])
async def trap_aws_credentials(request: Request):
    await record_root_trap(request, "/.aws/credentials", severity="high", honeytoken_info={"canary_token": "NX-CANARY-AWS-CRED-01"})
    return PlainTextResponse(
        "[default]\n"
        "aws_access_key_id = AKIA4DEFENSE7CANARY1\n"
        "aws_secret_access_key = 9aF81k2m3L4p5Q6r7S8t9U0v1W2x3Y4z\n"
    )


@router.api_route("/wp-login.php", methods=["GET", "POST"], tags=["Decoy Traps"])
async def trap_wp_login(request: Request):
    await record_root_trap(request, "/wp-login.php", severity="medium")
    return PlainTextResponse("WordPress 6.4.2 maintenance mode: database connection unavailable.", status_code=503)


@router.api_route("/actuator/{path:path}", methods=["GET", "POST"], tags=["Decoy Traps"])
async def trap_actuator(request: Request, path: str):
    await record_root_trap(request, f"/actuator/{path}", severity="medium")
    return JSONResponse(content={"status": "UP", "enclave": "defense-node-4", "canary_build": "v4.2.1-NX-CANARY"})


# ============================================================================
# ROBOTS.TXT DECEPTION HONEYTRAPS — 404 traps for disallowed paths
# ============================================================================

DECOY_404_HTML = """<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>404 Not Found</title>
</head><body>
<h1>Not Found</h1>
<p>The requested URL was not found on this server.</p>
<hr>
<address>Apache/2.4.52 (Ubuntu) Server at 127.0.0.1 Port 80</address>
</body></html>
"""


def return_decoy_404(request: Request, path: str):
    """Returns a completely generic 404 response giving zero clues to the attacker."""
    accept = request.headers.get("accept", "")
    if "application/json" in accept and "text/html" not in accept:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Not Found"},
        )
    return HTMLResponse(content=DECOY_404_HTML, status_code=status.HTTP_404_NOT_FOUND)


# 1. /admin-console/
@router.get("/admin-console", tags=["Decoy Traps"])
@router.get("/admin-console/", tags=["Decoy Traps"])
@router.post("/admin-console", tags=["Decoy Traps"])
@router.post("/admin-console/", tags=["Decoy Traps"])
@router.post("/admin-console/auth", tags=["Decoy Traps"])
@router.post("/admin-console/auth/", tags=["Decoy Traps"])
async def trap_admin_console(request: Request):
    await record_root_trap(
        request,
        "/admin-console/",
        severity="high",
        event_type="recon_probe",
        summary="Attacker probed disallowed path '/admin-console/' from robots.txt (404 returned - isolated from real system)",
        honeytoken_info={"recon_source": "robots.txt", "honeypot_target": "admin_console"},
    )
    return return_decoy_404(request, "/admin-console/")


# 2. /internal/backups/
@router.get("/internal/backups", tags=["Decoy Traps"])
@router.get("/internal/backups/", tags=["Decoy Traps"])
@router.get("/internal/backups/{path:path}", tags=["Decoy Traps"])
async def trap_internal_backups(request: Request, path: str = ""):
    probed = f"/internal/backups/{path}" if path else "/internal/backups/"
    await record_root_trap(
        request,
        probed,
        severity="high",
        event_type="recon_probe",
        summary=f"Attacker probed disallowed directory '{probed}' from robots.txt (404 returned)",
        honeytoken_info={"recon_source": "robots.txt", "honeypot_target": "internal_backups"},
    )
    return return_decoy_404(request, probed)


# 3. /satcom/uplink-keys/
@router.get("/satcom/uplink-keys", tags=["Decoy Traps"])
@router.get("/satcom/uplink-keys/", tags=["Decoy Traps"])
@router.get("/satcom/uplink-keys/{path:path}", tags=["Decoy Traps"])
async def trap_satcom_uplink_keys(request: Request, path: str = ""):
    probed = f"/satcom/uplink-keys/{path}" if path else "/satcom/uplink-keys/"
    await record_root_trap(
        request,
        probed,
        severity="high",
        event_type="recon_probe",
        summary=f"Attacker probed disallowed path '{probed}' from robots.txt (404 returned)",
        honeytoken_info={"recon_source": "robots.txt", "honeypot_target": "satcom_uplink_keys"},
    )
    return return_decoy_404(request, probed)


# 4. /firmware/releases/
@router.get("/firmware/releases", tags=["Decoy Traps"])
@router.get("/firmware/releases/", tags=["Decoy Traps"])
@router.get("/firmware/releases/{path:path}", tags=["Decoy Traps"])
async def trap_firmware_releases(request: Request, path: str = ""):
    probed = f"/firmware/releases/{path}" if path else "/firmware/releases/"
    await record_root_trap(
        request,
        probed,
        severity="high",
        event_type="recon_probe",
        summary=f"Attacker probed disallowed path '{probed}' from robots.txt (404 returned)",
        honeytoken_info={"recon_source": "robots.txt", "honeypot_target": "firmware_releases"},
    )
    return return_decoy_404(request, probed)
