"""Decoy honeypot endpoints: Simulated login, file collection, and scanner probe traps."""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.core.quarantine import store_quarantined_upload
from app.core.rate_limiter import decoy_rate_limiter
from app.core.security import (
    compute_password_fingerprint,
    extract_client_ip,
    sanitize_headers,
)
from app.core.websocket_manager import ws_manager
from app.database import get_db
from app.logging_config import logger
from app.models.captured_file import CapturedFile
from app.models.decoy_service import DecoyService
from app.models.login_attempt import LoginAttempt
from app.models.security_event import SecurityEvent

router = APIRouter(prefix="/decoy", tags=["Decoy Portal"])


async def get_or_create_default_decoy(db: AsyncSession) -> DecoyService:
    """Retrieves or creates the primary decoy service descriptor."""
    stmt = select(DecoyService).where(DecoyService.is_active == True).limit(1)
    result = await db.execute(stmt)
    decoy = result.scalar_one_or_none()
    if not decoy:
        decoy = DecoyService(
            name="Nexis Defense Core Portal",
            portal_type="defense_contractor_portal",
            description="Operational access portal for simulated defense contractor",
            port=8080,
            banner_title="Nexis Cloud Infrastructure & Defense Systems",
            config_metadata={"theme": "dark_tactical", "version": "4.2.1-sec"},
        )
        db.add(decoy)
        await db.commit()
        await db.refresh(decoy)
    return decoy


def check_is_test(request: Request) -> bool:
    """Identifies whether the request is from an authorized test suite or real traffic."""
    test_header = request.headers.get("x-argus-test-token")
    test_query = request.query_params.get("test")
    return bool(test_header or test_query == "1" or test_query == "true")


@router.post("/auth/login")
async def decoy_login(
    request: Request,
    username: str = Form(default=""),
    password: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
):
    """
    Decoy authentication endpoint.
    NEVER authenticates or stores plaintext passwords.
    Calculates password length and HMAC-SHA256 fingerprint, emits security telemetry,
    and returns a realistic simulated 401 Unauthorized response.
    """
    client_ip = extract_client_ip(request)

    # Apply rate limiting to prevent resource exhaustion from massive brute-force attacks
    allowed, _ = decoy_rate_limiter.is_allowed(client_ip)
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"status": "error", "message": "Too many failed attempts. Temporary IP lockout."},
        )

    # Slight realistic timing delay (100-250ms) to simulate authentication verification
    await asyncio.sleep(0.15)

    is_test = check_is_test(request)
    decoy = await get_or_create_default_decoy(db)

    # Password telemetry computation - Zero Plaintext Storage Invariant
    pwd_len = len(password)
    pwd_fingerprint = compute_password_fingerprint(password) if password else "empty_password"

    # Determine severity based on targeted username
    severity = "medium"
    flagged = False
    high_value_targets = {"root", "admin", "administrator", "sysadmin", "secops", "supervisor", "ciso"}
    if username.strip().lower() in high_value_targets:
        severity = "high"
        flagged = True

    event_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    # 1. Create central security event
    sec_event = SecurityEvent(
        id=event_id,
        decoy_service_id=decoy.id,
        timestamp=now_utc,
        source_ip=client_ip,
        source_port=request.client.port if request.client else None,
        http_method=request.method,
        request_path=str(request.url.path),
        query_params=dict(request.query_params),
        headers_sanitized=sanitize_headers(dict(request.headers)),
        user_agent=request.headers.get("user-agent", "")[:500],
        event_type="login_attempt",
        severity=severity,
        is_test_event=is_test,
        correlation_id=request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8],
        metadata_payload={
            "submitted_username": username[:100],
            "password_length": pwd_len,
            "simulated_outcome": "DENIED",
        },
    )
    db.add(sec_event)

    # 2. Create associated login attempt record
    login_attempt = LoginAttempt(
        id=uuid.uuid4(),
        event_id=event_id,
        submitted_username=username[:255] if username else "(blank)",
        password_length=pwd_len,
        password_hmac_fingerprint=pwd_fingerprint,
        is_flagged_credential=flagged,
        success=False,  # Decoy NEVER grants access
        failure_reason="invalid_operator_credentials",
        client_ip=client_ip,
        user_agent=request.headers.get("user-agent", "")[:500],
    )
    db.add(login_attempt)

    await db.commit()

    # 3. Broadcast real-time event to connected SOC dashboards
    event_summary = {
        "id": str(event_id),
        "timestamp": now_utc.isoformat(),
        "source_ip": client_ip,
        "event_type": "login_attempt",
        "severity": severity,
        "request_path": str(request.url.path),
        "http_method": request.method,
        "user_agent": request.headers.get("user-agent", "")[:100],
        "is_test_event": is_test,
        "summary": f"Decoy login attempt targeting user '{username or 'blank'}' (pwd len: {pwd_len})",
    }
    await ws_manager.broadcast_event(event_summary)

    logger.info(
        f"Captured decoy login attempt from {client_ip} for username '{username}'",
        extra={"event_id": str(event_id), "source_ip": client_ip, "event_type": "login_attempt"},
    )

    # Simulated realistic corporate authentication failure response
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={
            "status": "error",
            "code": "AUTH_CREDENTIALS_INVALID",
            "message": "Access Denied: The specified operator credentials are not valid for this security enclave.",
            "request_id": f"REQ-{str(event_id)[:8].upper()}",
        },
    )


@router.post("/upload/diagnostics")
async def decoy_upload_diagnostics(
    request: Request,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
):
    """
    Decoy payload collection endpoint.
    Safely captures uploaded artifacts into a dedicated non-executable quarantine directory,
    calculates cryptographic SHA-256 hash, and logs security telemetry.
    """
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = await get_or_create_default_decoy(db)

    # Stream into quarantine storage safely
    success, result = await store_quarantined_upload(file)

    event_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)
    severity = "critical" if success else "high"

    # 1. Create security event
    sec_event = SecurityEvent(
        id=event_id,
        decoy_service_id=decoy.id,
        timestamp=now_utc,
        source_ip=client_ip,
        source_port=request.client.port if request.client else None,
        http_method=request.method,
        request_path=str(request.url.path),
        query_params=dict(request.query_params),
        headers_sanitized=sanitize_headers(dict(request.headers)),
        user_agent=request.headers.get("user-agent", "")[:500],
        event_type="file_upload",
        severity=severity,
        is_test_event=is_test,
        correlation_id=request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8],
        metadata_payload={
            "upload_success": success,
            "original_filename": result.get("sanitized_name"),
            "file_size": result.get("size"),
            "sha256": result.get("sha256"),
            "detected_mime": result.get("detected_mime"),
            "rejection_reason": result.get("rejection_reason"),
        },
    )
    db.add(sec_event)

    # 2. Create captured file record
    captured = CapturedFile(
        id=result.get("file_uuid") or uuid.uuid4(),
        event_id=event_id,
        original_filename_sanitized=result.get("sanitized_name", "unknown"),
        internal_storage_path=result.get("internal_path", ""),
        sha256_hash=result.get("sha256", "none"),
        file_size_bytes=result.get("size", 0),
        declared_mime_type=result.get("declared_mime", "application/octet-stream"),
        detected_mime_type=result.get("detected_mime", "unknown"),
        quarantine_status="quarantined" if success else "rejected",
        rejection_reason=result.get("rejection_reason"),
        source_ip=client_ip,
        upload_timestamp=now_utc,
    )
    db.add(captured)

    await db.commit()

    # 3. Broadcast to SOC dashboards
    event_summary = {
        "id": str(event_id),
        "timestamp": now_utc.isoformat(),
        "source_ip": client_ip,
        "event_type": "file_upload",
        "severity": severity,
        "request_path": str(request.url.path),
        "http_method": request.method,
        "user_agent": request.headers.get("user-agent", "")[:100],
        "is_test_event": is_test,
        "summary": f"{'Quarantined suspicious payload' if success else 'Rejected upload'} '{result.get('sanitized_name')}' (SHA-256: {result.get('sha256')[:12]}...)",
    }
    await ws_manager.broadcast_event(event_summary)

    if not success:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "status": "rejected",
                "message": result.get("rejection_reason", "Payload rejected by policy filter."),
            },
        )

    # Return realistic confirmation response to the uploader
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "success",
            "tracking_ticket": f"NX-DIAG-{str(event_id)[:8].upper()}",
            "message": "Diagnostic bundle received and queued for internal processing.",
            "artifact_hash": result.get("sha256"),
        },
    )


@router.api_route(
    "/probe/{probe_path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
)
async def decoy_scanner_trap(
    probe_path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Traps automated recon scanners probing for common vulnerable paths (.env, wp-login, etc.).
    Emits recon_probe telemetry and returns simulated error.
    """
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = await get_or_create_default_decoy(db)

    # Classify severity based on known exploit probe targets
    path_lower = probe_path.lower()
    severity = "medium"
    if any(k in path_lower for k in [".env", "git", "aws", "passwd", "shadow", "wp-config", "id_rsa"]):
        severity = "high"
    elif any(k in path_lower for k in ["actuator", "swagger", "api-docs", "phpinfo", "debug"]):
        severity = "medium"

    event_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    sec_event = SecurityEvent(
        id=event_id,
        decoy_service_id=decoy.id,
        timestamp=now_utc,
        source_ip=client_ip,
        source_port=request.client.port if request.client else None,
        http_method=request.method,
        request_path=f"/{probe_path}",
        query_params=dict(request.query_params),
        headers_sanitized=sanitize_headers(dict(request.headers)),
        user_agent=request.headers.get("user-agent", "")[:500],
        event_type="recon_probe",
        severity=severity,
        is_test_event=is_test,
        correlation_id=str(uuid.uuid4())[:8],
        metadata_payload={"probed_path": probe_path},
    )
    db.add(sec_event)
    await db.commit()

    # Broadcast to SOC dashboards
    event_summary = {
        "id": str(event_id),
        "timestamp": now_utc.isoformat(),
        "source_ip": client_ip,
        "event_type": "recon_probe",
        "severity": severity,
        "request_path": f"/{probe_path}",
        "http_method": request.method,
        "user_agent": request.headers.get("user-agent", "")[:100],
        "is_test_event": is_test,
        "summary": f"Scanner probe targeting '/{probe_path}'",
    }
    await ws_manager.broadcast_event(event_summary)

    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"status": "error", "message": f"Resource '/{probe_path}' not found on this host."},
    )


@router.get("/network/status")
async def decoy_network_status():
    """Returns enticing simulated tactical defense network topology and node telemetry."""
    return {
        "network_id": "NX-TACTICAL-SEC-NET-04",
        "classification": "TOP SECRET // DEFENSE CONTRACTOR ENCLAVE",
        "active_enclaves": [
            {
                "id": "ENCLAVE-VA-01",
                "name": "US-East Pentagon Gateway Relay",
                "status": "OPERATIONAL",
                "latency_ms": 14,
                "ip_range": "10.42.18.0/24",
                "active_tunnels": 8,
                "encryption": "AES-256-GCM / Kyber-1024",
            },
            {
                "id": "ENCLAVE-EU-02",
                "name": "EU-Central Frankfurt Defense Exchange",
                "status": "OPERATIONAL",
                "latency_ms": 86,
                "ip_range": "10.42.34.0/24",
                "active_tunnels": 5,
                "encryption": "AES-256-GCM / Post-Quantum Layer",
            },
            {
                "id": "ENCLAVE-PAC-03",
                "name": "Pacific-INDOPACOM Satellite Link",
                "status": "HIGH LOAD",
                "latency_ms": 142,
                "ip_range": "10.42.88.0/24",
                "active_tunnels": 12,
                "encryption": "SATCOM Suite B Military",
            },
        ],
        "system_load": {"cpu_utilization": "18.4%", "memory_used": "4.2 GB / 64 GB", "crypto_engine": "ONLINE"},
        "firewall_profile": "STIG-DEFENSE-HARDENED-V4",
    }


@router.post("/terminal/exec")
async def decoy_terminal_exec(
    request: Request,
    command: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
):
    """
    Deceptive Interactive Terminal honeypot sandbox.
    Captures raw attacker command execution attempts, logs them to security telemetry,
    and returns realistic simulated command output without EVER executing code on the host OS.
    """
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = await get_or_create_default_decoy(db)

    cmd_clean = command.strip()
    cmd_lower = cmd_clean.lower()
    event_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    # Classify severity based on malicious intent
    severity = "medium"
    malicious_indicators = ["cat /etc", "passwd", "shadow", "wget", "curl", "nc", "bash", "sh", "python", "rm", "sudo", "chmod", "iptables", "docker"]
    if any(ind in cmd_lower for ind in malicious_indicators):
        severity = "high"

    # Virtual Sandbox Response Generation (Zero Host Execution)
    output = ""
    if not cmd_clean:
        output = ""
    elif cmd_lower in ["help", "?"]:
        output = (
            "Nexis Tactical Defense Diagnostic Shell v4.2.1 [Restricted Guest Mode]\n"
            "Available diagnostics commands:\n"
            "  status         - Display operational node telemetry\n"
            "  nodes          - List enclave connection matrix\n"
            "  whoami         - Print current operator identity\n"
            "  id             - Show security UID/GID clearances\n"
            "  uname -a       - Display tactical kernel parameters\n"
            "  cat /etc/issue - View OS enclave distribution\n"
            "  env            - Display environment configuration parameters\n"
            "  netstat        - List local network sockets\n"
            "  clear          - Clear terminal display buffer\n"
        )
    elif cmd_lower == "whoami":
        output = "operator_guest@nx-defense-node-4"
    elif cmd_lower in ["id", "id -a"]:
        output = "uid=1042(operator_guest) gid=1042(contractors) groups=1042(contractors),100(users)"
    elif cmd_lower in ["uname -a", "uname"]:
        output = "Linux nx-defense-node4 6.8.0-31-generic #31-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux"
    elif cmd_lower in ["cat /etc/issue", "cat /etc/os-release"]:
        output = "Nexis Tactical Defense OS v4.2.1-SEC (DoD STIG Profile Enclave)\nKernel 6.8.0-31-generic on an x86_64"
    elif cmd_lower in ["status", "system_status"]:
        output = (
            "[SYSTEM DIAGNOSTIC TELEMETRY - NODE 04]\n"
            "Host: nx-tactical-east.defense.internal\n"
            "Status: OPERATIONAL (Enclave Isolation: ENGAGED)\n"
            "Crypto Engine: Suite B Kyber-1024 Hardware HSM Active\n"
            "Active Tunnels: 8 IPsec / 4 WireGuard Enclaves"
        )
    elif cmd_lower in ["nodes", "list_nodes"]:
        output = (
            "ENCLAVE ID    REGION             STATUS       LATENCY    ENCRYPTION\n"
            "VA-01         US-East Relay      ACTIVE       14ms       Kyber-1024\n"
            "EU-02         Frankfurt Node     ACTIVE       86ms       AES-256-GCM\n"
            "PAC-03        INDOPACOM Link     HIGH-LOAD    142ms      Suite B MIL\n"
        )
    elif cmd_lower in ["env", "printenv", "cat .env"]:
        output = (
            "ENCLAVE_ENVIRONMENT=tactical_production\n"
            "SECURITY_ZONE=RESTRICTED_CUI_TIER3\n"
            "INTERNAL_GATEWAY=10.42.18.1\n"
            "CANARY_TOKEN=NX-CANARY-TOKEN-784912-AWS-EXPLOIT-DETECT\n"
            "LOG_DESTINATION=syslog.defense.internal:514\n"
            "READ_ONLY_ACCESS=TRUE\n"
        )
    elif cmd_lower in ["netstat", "ss", "netstat -tuln"]:
        output = (
            "Active Internet connections (only servers)\n"
            "Proto Recv-Q Send-Q Local Address           Foreign Address         State\n"
            "tcp        0      0 0.0.0.0:8080            0.0.0.0:*               LISTEN\n"
            "tcp        0      0 127.0.0.1:5432          0.0.0.0:*               LISTEN\n"
            "tcp        0      0 10.42.18.4:2222         0.0.0.0:*               LISTEN\n"
        )
    elif "cat /etc/passwd" in cmd_lower:
        output = (
            "root:x:0:0:root:/root:/bin/bash\n"
            "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n"
            "satcom_sync:x:998:998:SATCOM Sync Service:/var/lib/satcom:/usr/sbin/nologin\n"
            "nx_admin:x:1000:1000:Nexis Admin:/home/nx_admin:/bin/bash\n"
            "secops:x:1001:1001:SecOps Lead:/home/secops:/bin/bash\n"
            "operator_guest:x:1042:1042:Guest Diagnostic Operator:/home/operator_guest:/bin/bash\n"
        )
    else:
        output = f"[RESTRICTED ACCESS VIOLATION]: Command '{cmd_clean}' intercepted by enclave policy engine. Incident logged."

    # Record security telemetry event in PostgreSQL
    sec_event = SecurityEvent(
        id=event_id,
        decoy_service_id=decoy.id,
        timestamp=now_utc,
        source_ip=client_ip,
        source_port=request.client.port if request.client else None,
        http_method="POST",
        request_path="/api/v1/decoy/terminal/exec",
        query_params=dict(request.query_params),
        headers_sanitized=sanitize_headers(dict(request.headers)),
        user_agent=request.headers.get("user-agent", "")[:500],
        event_type="recon_probe",
        severity=severity,
        is_test_event=is_test,
        correlation_id=str(uuid.uuid4())[:8],
        metadata_payload={
            "interactive_command": cmd_clean,
            "session_type": "decoy_diagnostic_terminal",
        },
    )
    db.add(sec_event)
    await db.commit()

    # Broadcast command execution live to SOC dashboard
    event_summary = {
        "id": str(event_id),
        "timestamp": now_utc.isoformat(),
        "source_ip": client_ip,
        "event_type": "recon_probe",
        "severity": severity,
        "request_path": "/api/v1/decoy/terminal/exec",
        "http_method": "POST",
        "user_agent": request.headers.get("user-agent", "")[:100],
        "is_test_event": is_test,
        "summary": f"Decoy Terminal command executed: '{cmd_clean[:50]}'",
    }
    await ws_manager.broadcast_event(event_summary)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "executed",
            "output": output,
            "prompt": "operator_guest@nx-sec-node-4:~$ ",
        },
    )


@router.get("/honeytoken/config")
async def decoy_honeytoken_config(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Deceptive configuration breadcrumb returning fake canary credentials."""
    client_ip = extract_client_ip(request)
    is_test = check_is_test(request)
    decoy = await get_or_create_default_decoy(db)

    event_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    sec_event = SecurityEvent(
        id=event_id,
        decoy_service_id=decoy.id,
        timestamp=now_utc,
        source_ip=client_ip,
        source_port=request.client.port if request.client else None,
        http_method="GET",
        request_path=str(request.url.path),
        query_params=dict(request.query_params),
        headers_sanitized=sanitize_headers(dict(request.headers)),
        user_agent=request.headers.get("user-agent", "")[:500],
        event_type="recon_probe",
        severity="high",
        is_test_event=is_test,
        correlation_id=str(uuid.uuid4())[:8],
        metadata_payload={"honeytoken_type": "simulated_aws_database_credentials"},
    )
    db.add(sec_event)
    await db.commit()

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "database_cluster": {
                "enclave_id": "NX-VA-SECRET-CLUSTER-01",
                "host": "10.42.18.5",
                "port": 5432,
                "read_user": "nx_contractor_readonly",
                "canary_token": "CANARY-NX-784912-AWS-EXPLOIT-DETECT",
            },
            "satcom_uplink": {
                "endpoint": "satcom-relay.defense.internal:8443",
                "public_key_fingerprint": "SHA256:7b91d24ef081a9...",
            },
        },
    )

