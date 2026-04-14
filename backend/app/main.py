import structlog
import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiter import limiter
from app.logging import setup_logging
from app.middleware import RequestIDMiddleware, RequestLoggingMiddleware, SecurityHeadersMiddleware
from app.routers import auth, users, dogs, photos, feed, votes, rankings, reports, admin, lost, social, parks, playdates, posts, rescues, support, billing, notifications, feedback

logger = structlog.stdlib.get_logger()

# Initialize structured logging
setup_logging()

# Initialize Sentry (no-op if DSN not set)
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )

app = FastAPI(title="Fetch API", version="0.2.0")
app.state.limiter = limiter

# Middleware (order matters — outermost first)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting error handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(exc.errors())},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("unhandled_exception", path=request.url.path, exc=str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )

# Prometheus metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(dogs.router, prefix="/api/v1/dogs", tags=["dogs"])
app.include_router(photos.router, prefix="/api/v1", tags=["photos"])
app.include_router(feed.router, prefix="/api/v1/feed", tags=["feed"])
app.include_router(votes.router, prefix="/api/v1/votes", tags=["votes"])
app.include_router(rankings.router, prefix="/api/v1/rankings", tags=["rankings"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(lost.router, prefix="/api/v1/lost", tags=["lost"])
app.include_router(social.router, prefix="/api/v1/social", tags=["social"])
app.include_router(parks.router, prefix="/api/v1/parks", tags=["parks"])
app.include_router(playdates.router, prefix="/api/v1/playdates", tags=["playdates"])
app.include_router(posts.router, prefix="/api/v1/posts", tags=["posts"])
app.include_router(rescues.router, prefix="/api/v1/rescues", tags=["rescues"])
app.include_router(support.router, prefix="/api/v1/support", tags=["support"])
app.include_router(billing.router, prefix="/api/v1/billing", tags=["billing"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(feedback.router, prefix="/api/v1", tags=["feedback"])


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/readyz")
async def readyz():
    from sqlalchemy import text

    from app.db import engine

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ready"}
