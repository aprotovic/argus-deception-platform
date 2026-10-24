"""ARGUS Decoy-only FastAPI application.


This app is used by the decoy container only. It:
- Mounts ONLY root_traps_router + decoy_router + decoy_personnel_router
- Does NOT mount auth, events, evidence, export, audit, metrics, ws, internal
- Does NOT call create_all or connect to a database at startup
- Overrides get_db with EventForwarderSession (events forwarded to backend)
- Disables docs/redoc/openapi
- Starts/stops the ForwardingEventSink worker in lifespan
"""

from contextlib import asynccontextmanager
from types import SimpleNamespace

from fastapi import FastAPI, Request, status
from fastapi.responses import HTMLResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.root_traps import router as root_traps_router, DECOY_404_HTML
from app.api.v1.decoy import router as decoy_router
from app.api.v1.decoy_personnel import router as decoy_personnel_router
from app.api.v1 import bank_router
from app.config import settings
from app.core.event_sink import (
    EventForwarderSession,
    ForwardingEventSink,
    get_event_sink,
    set_event_sink,
    DbEventSink,
)
from app.database import get_db
from app.logging_config import logger, setup_logging
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan: install ForwardingEventSink, start worker, stop on shutdown."""
    setup_logging(settings.LOG_LEVEL)
    logger.info("Starting ARGUS Decoy (isolated mode)", extra={"event_type": "SYSTEM_STARTUP"})

    sink = ForwardingEventSink()
    sink.replay_spool_on_start()
    sink.start_worker()
    set_event_sink(sink)

    yield

    # Shutdown: flush queue to spool, stop worker
    logger.info("Shutting down ARGUS Decoy...", extra={"event_type": "SYSTEM_SHUTDOWN"})
    await sink.stop_worker()
    set_event_sink(DbEventSink())


app = FastAPI(
    title="ARGUS Decoy",
    description="Isolated decoy honeypot surface — no admin API, no database.",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)

# Middleware (same as main app)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# Override get_db with EventForwarderSession
async def _get_forwarder_db():
    """Yields an EventForwarderSession for each request."""
    session = EventForwarderSession()
    try:
        yield session
    finally:
        pass

app.dependency_overrides[get_db] = _get_forwarder_db

# Health check (no database connectivity needed, no service name leaked)
@app.get("/health/live", tags=["Health"])
async def liveness_probe():
    """Liveness probe — returns minimal JSON, no service name."""
    return {"status": "ok"}

# Root traps (/, /decoy, /robots.txt, honeytokens, scanner traps)
app.include_router(root_traps_router)

# Decoy API surface ONLY — no admin routes
decoy_api = app
from fastapi import APIRouter
_decoy_v1 = APIRouter(prefix="/api/v1")
_decoy_v1.include_router(decoy_router)
_decoy_v1.include_router(decoy_personnel_router)
_decoy_v1.include_router(bank_router.router)
app.include_router(_decoy_v1)

# Unified 404/405 handler — every unmatched path returns the same Apache-style
# HTML 404 body, regardless of whether it's an admin path, /docs, /openapi.json,
# or a genuinely unknown path. This prevents FastAPI's default JSON 404 from
# revealing the framework.
@app.exception_handler(StarletteHTTPException)
async def unified_http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code in (404, 405):
        return HTMLResponse(
            content=DECOY_404_HTML,
            status_code=status.HTTP_404_NOT_FOUND,
        )
    # Non-404/405 HTTP exceptions pass through as-is
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None),
    )

# Global Exception Handler (same as main app)
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
