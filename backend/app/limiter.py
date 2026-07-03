from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# Counters live in Redis so limits hold across the multi-worker prod server
# and survive restarts; the in-memory fallback keeps requests flowing (at
# per-process granularity) if Redis is briefly unavailable.
limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.RATE_LIMIT_ENABLED,
    storage_uri=settings.REDIS_URL,
    in_memory_fallback_enabled=True,
)
