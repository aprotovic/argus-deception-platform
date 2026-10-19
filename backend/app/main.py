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
