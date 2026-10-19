"""ARGUS Cyber Deception & Attack Monitoring Platform - Main FastAPI Entrypoint."""

import sys
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.api.v1 import api_v1_router
from app.config import settings
from app.database import Base, engine
from app.logging_config import logger, setup_logging
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager handling startup initialization and graceful shutdown."""
    # 1. Setup structured logging
    setup_logging(settings.LOG_LEVEL)
    logger.info(
        f"Starting ARGUS Platform in {settings.ENVIRONMENT} mode",
        extra={"event_type": "SYSTEM_STARTUP"},
    )

    # 2. Ensure quarantine directory exists with proper permissions
    q_dir = settings.quarantine_path
    logger.info(f"Quarantine storage initialized at: {q_dir}")

    # 3. Create tables if running in SQLite dev/test mode or initial verification
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema verification completed.")

    yield

    # Shutdown logic
    logger.info("Shutting down ARGUS Platform...", extra={"event_type": "SYSTEM_SHUTDOWN"})
    await engine.dispose()


app = FastAPI(
    title="ARGUS Cyber Deception Platform",
    description="Operational API for attack monitoring, cyber deception telemetry, and safe artifact quarantine.",
    version="1.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# Defensive Middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Correlation-ID", "Content-Disposition", "X-Evidence-SHA256"],
)

# Health Check Endpoints
@app.get("/health/live", tags=["Health"])
async def liveness_probe():
    """Liveness probe indicating application process is running."""
    return {"status": "alive", "service": "argus-core"}


@app.get("/health/ready", tags=["Health"])
async def readiness_probe():
    """Readiness probe verifying operational database connectivity."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        logger.error(f"Readiness probe failed database check: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "error": "Database unreachable"},
        )


# Serve Decoy Portal UI
@app.get("/", tags=["Decoy Interface"])
@app.get("/decoy", tags=["Decoy Interface"])
async def serve_decoy_portal():
    """Serves the authentic-looking decoy defense contractor portal."""
    template_path = Path(__file__).resolve().parent.parent.parent / "decoy" / "templates" / "index.html"
    if template_path.exists():
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=template_path.read_text(encoding="utf-8"))
    return {"message": "Nexis Defense Systems - Secure Portal"}


# Deceptive robots.txt breadcrumbs
@app.get("/robots.txt", tags=["Decoy Interface"])
async def serve_decoy_robots():
    """Serves deceptive robots.txt pointing to honeytoken endpoints."""
    from fastapi.responses import PlainTextResponse
    robots_content = (
        "# Nexis Tactical Defense Perimeter Gateway\n"
        "# Restricted System Notice: Automated indexing strictly forbidden.\n"
        "User-agent: *\n"
        "Disallow: /admin-console/\n"
        "Disallow: /internal/backups/\n"
        "Disallow: /api/v1/decoy/honeytoken/config\n"
        "Disallow: /firmware/releases/\n"
        "Disallow: /satcom/uplink-keys/\n"
    )
    return PlainTextResponse(content=robots_content)


# ============================================================================
# ROOT DOMAIN SCANNER TRAPS & HONEYTOKEN HONEYTRAPS
# ============================================================================
async def record_root_trap(request: Request, path: str, severity: str = "high", honeytoken_info: dict = None):
    """Captures direct scanner recon probes at the domain root into security telemetry."""
    try:
        from app.database import AsyncSessionLocal
        from app.models.security_event import SecurityEvent
        from app.core.security import extract_client_ip, sanitize_headers
        from app.core.websocket_manager import ws_manager
        import uuid
        from datetime import datetime, timezone

        client_ip = extract_client_ip(request)
        is_test = bool(request.headers.get("x-argus-test-token") or request.query_params.get("test") in ["1", "true"])
        event_id = uuid.uuid4()
        now_utc = datetime.now(timezone.utc)

        metadata = {"probed_path": path}
        if honeytoken_info:
            metadata.update(honeytoken_info)

        async with AsyncSessionLocal() as session:
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
                event_type="recon_probe",
                severity=severity,
                is_test_event=is_test,
                correlation_id=str(uuid.uuid4())[:8],
                metadata_payload=metadata,
            )
            session.add(sec_event)
            await session.commit()

        await ws_manager.broadcast_event({
            "id": str(event_id),
            "timestamp": now_utc.isoformat(),
            "source_ip": client_ip,
            "event_type": "recon_probe",
            "severity": severity,
            "request_path": path,
            "http_method": request.method,
            "user_agent": request.headers.get("user-agent", "")[:100],
            "is_test_event": is_test,
            "summary": f"Scanner reconnaissance probe on '{path}'",
        })
    except Exception as e:
        logger.error(f"Error recording root trap for {path}: {e}")


@app.get("/.env", tags=["Decoy Traps"])
async def trap_env(request: Request):
    from fastapi.responses import PlainTextResponse
    await record_root_trap(request, "/.env", severity="high", honeytoken_info={"canary_token": "CANARY-ENV-NX784912"})
    return PlainTextResponse(
        "DATABASE_URL=postgresql://nx_admin:CanaryP@ssword2026!@10.42.18.5:5432/defense_ops\n"
        "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE_NXCANARY\n"
        "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n"
        "JWT_SECRET=super_secret_defense_enclave_key_do_not_share\n"
    )


@app.get("/.git/HEAD", tags=["Decoy Traps"])
async def trap_git_head(request: Request):
    from fastapi.responses import PlainTextResponse
    await record_root_trap(request, "/.git/HEAD", severity="high")
    return PlainTextResponse("ref: refs/heads/main\n")


@app.get("/.git/config", tags=["Decoy Traps"])
async def trap_git_config(request: Request):
    from fastapi.responses import PlainTextResponse
    await record_root_trap(request, "/.git/config", severity="high")
    return PlainTextResponse(
        "[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n"
        "[remote \"origin\"]\n\turl = git@git.defense.internal:nexis/tactical-portal.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n"
    )


@app.get("/.aws/credentials", tags=["Decoy Traps"])
async def trap_aws_credentials(request: Request):
    from fastapi.responses import PlainTextResponse
    await record_root_trap(request, "/.aws/credentials", severity="high", honeytoken_info={"canary_token": "NX-CANARY-AWS-CRED-01"})
    return PlainTextResponse(
        "[default]\n"
        "aws_access_key_id = AKIA4DEFENSE7CANARY1\n"
        "aws_secret_access_key = 9aF81k2m3L4p5Q6r7S8t9U0v1W2x3Y4z\n"
    )


@app.api_route("/wp-login.php", methods=["GET", "POST"], tags=["Decoy Traps"])
async def trap_wp_login(request: Request):
    from fastapi.responses import PlainTextResponse
    await record_root_trap(request, "/wp-login.php", severity="medium")
    return PlainTextResponse("WordPress 6.4.2 maintenance mode: database connection unavailable.", status_code=503)


@app.api_route("/actuator/{path:path}", methods=["GET", "POST"], tags=["Decoy Traps"])
async def trap_actuator(request: Request, path: str):
    await record_root_trap(request, f"/actuator/{path}", severity="medium")
    return JSONResponse(content={"status": "UP", "enclave": "defense-node-4", "canary_build": "v4.2.1-NX-CANARY"})


# Include API v1 Router
app.include_router(api_v1_router)


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    logger.error(
        f"Unhandled global exception: {str(exc)}",
        extra={"correlation_id": correlation_id},
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred. Incident has been recorded.",
            "correlation_id": correlation_id,
        },
    )
