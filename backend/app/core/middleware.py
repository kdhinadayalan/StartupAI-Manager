from datetime import datetime, timezone
import time
import uuid
from typing import Callable, Dict, Tuple
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

# In-memory sliding window rate limiter for local dev/fallback
# (Key: IP -> (count, window_start_timestamp))
_rate_limit_store: Dict[str, Tuple[int, float]] = {}


def reset_rate_limit_store() -> None:
    """Clear in-memory rate limit store (for testing and isolation)."""
    _rate_limit_store.clear()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Appends security headers compliant with OWASP recommendations.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Correlation ID tracking
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        # Rate Limiting check
        client_ip = request.client.host if request.client else "unknown"
        force_check = (
            settings.ENVIRONMENT == "test"
            and request.headers.get("X-Test-Enforce-Rate-Limit") == "true"
        )
        if not self._check_rate_limit(client_ip, force_check=force_check):
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": "Too many requests. Please slow down.",
                    },
                    "correlation_id": correlation_id,
                },
                headers={"Retry-After": "60"},
            )

        response = await call_next(request)

        # Standard OWASP recommended security headers
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: https:; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "frame-ancestors 'none';"
        )

        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        return response

    def _check_rate_limit(self, client_ip: str, force_check: bool = False) -> bool:
        if settings.ENVIRONMENT == "test" and not force_check:
            return True
        now = time.time()
        window = 60.0  # 1 minute window
        limit = settings.RATE_LIMIT_PER_MINUTE

        if client_ip not in _rate_limit_store:
            _rate_limit_store[client_ip] = (1, now)
            return True

        count, start_time = _rate_limit_store[client_ip]
        if now - start_time > window:
            _rate_limit_store[client_ip] = (1, now)
            return True
        elif count < limit:
            _rate_limit_store[client_ip] = (count + 1, start_time)
            return True
        else:
            return False
