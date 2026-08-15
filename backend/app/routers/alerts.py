"""Receive Alertmanager notifications and turn them into email.

Alertmanager can only send mail over SMTP, which DigitalOcean droplets block
outbound — the same constraint that put the app on Resend's HTTPS API. Rather
than run a second, differently-broken mail path, Alertmanager POSTs here and
this reuses the sender that already works.

Not under /admin's session auth: Alertmanager has no session. It authenticates
with a shared bearer token, and the endpoint only ever sends a fixed-format
email to a fixed configured address, so a leaked token buys an attacker
nothing but noise in one inbox.
"""
import hmac

import structlog
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.config import settings
from app.limiter import limiter
from app.services.email import send_alert_email

logger = structlog.stdlib.get_logger()

router = APIRouter()


class AlertItem(BaseModel):
    status: str = "firing"
    labels: dict[str, str] = Field(default_factory=dict)
    annotations: dict[str, str] = Field(default_factory=dict)


class AlertPayload(BaseModel):
    """Subset of Alertmanager's webhook body that we actually use."""
    status: str = "firing"
    alerts: list[AlertItem] = Field(default_factory=list)


@router.post("/webhook", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("60/hour")
async def alert_webhook(
    request: Request,
    body: AlertPayload,
    background_tasks: BackgroundTasks,
    authorization: str = Header(default=""),
):
    if not settings.ALERT_WEBHOOK_TOKEN:
        raise HTTPException(status_code=401, detail="Alert webhook is not configured")

    presented = authorization.removeprefix("Bearer ").strip()
    # Constant-time: this is a shared secret compared on every delivery.
    if not hmac.compare_digest(presented, settings.ALERT_WEBHOOK_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid alert token")

    for alert in body.alerts:
        logger.warning(
            "prometheus_alert",
            status=alert.status,
            alertname=alert.labels.get("alertname", "unknown"),
            severity=alert.labels.get("severity", "unknown"),
            summary=alert.annotations.get("summary", ""),
        )

    # Always 202, even with no recipient: returning an error would make
    # Alertmanager retry forever over a config gap it cannot fix.
    if settings.ALERT_EMAIL_TO and body.alerts:
        background_tasks.add_task(
            send_alert_email, settings.ALERT_EMAIL_TO, payload=body.model_dump()
        )
    elif body.alerts:
        logger.warning("alert_email_skipped_no_recipient")

    return {"received": len(body.alerts)}
