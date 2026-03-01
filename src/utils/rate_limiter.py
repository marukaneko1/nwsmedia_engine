import asyncio
import time


class RateLimiter:
    """Token-bucket rate limiter for API calls."""

    def __init__(self, calls_per_second: float = 1.0):
        self._rate = calls_per_second
        self._last_call = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_call
            wait = (1.0 / self._rate) - elapsed
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_call = time.monotonic()
