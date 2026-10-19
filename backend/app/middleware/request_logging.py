"""Request logging and correlation ID middleware."""

import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.security import extract_client_ip
from app.logging_config import logger


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Assigns correlation ID and logs execution telemetry in JSON format."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        correlation_id = request.headers.get("x-correlation-id") or str(uuid.uuid4())[:8]

        # Attach to request state
        request.state.correlation_id = correlation_id
        client_ip = extract_client_ip(request)

        try:
            response = await call_next(request)
            duration_ms = round((time.time() - start_time) * 1000, 2)

            response.headers["X-Correlation-ID"] = correlation_id

            # Skip noisy polling or static endpoints from detailed logs
            if not request.url.path.startswith(("/health", "/favicon")):
                logger.info(
                    f"{request.method} {request.url.path} {response.status_code} ({duration_ms}ms)",
                    extra={
                        "correlation_id": correlation_id,
                        "source_ip": client_ip,
                    },
                )
            return response

        except Exception as e:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            logger.error(
                f"Unhandled error in {request.method} {request.url.path} ({duration_ms}ms): {str(e)}",
                extra={
                    "correlation_id": correlation_id,
                    "source_ip": client_ip,
                },
                exc_info=True,
            )
            raise
