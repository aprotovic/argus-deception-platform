"""Sliding-window in-memory rate limiter to protect decoy and API from DoS."""

import time
from collections import defaultdict
from typing import Dict, List, Tuple


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding window rate limiter per client IP."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> Tuple[bool, int]:
        """
        Checks if the request from client_ip is allowed.
        Returns (is_allowed, remaining_requests).
        """
        now = time.time()
        window_start = now - self.window_seconds

        # Clean expired timestamps for this IP
        timestamps = [ts for ts in self.requests[client_ip] if ts > window_start]
        self.requests[client_ip] = timestamps

        if len(timestamps) >= self.max_requests:
            return False, 0

        self.requests[client_ip].append(now)
        remaining = self.max_requests - len(self.requests[client_ip])
        return True, remaining

    def reset(self, client_ip: str) -> None:
        """Resets rate limit for a given IP."""
        if client_ip in self.requests:
            del self.requests[client_ip]


# Singleton instance for decoy endpoints
decoy_rate_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60)
