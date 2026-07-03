"""Transactional email via Resend's HTTPS API.

Resend is API-only (POST https://api.resend.com/emails with a Bearer key), so
it works on hosts that block outbound SMTP — DigitalOcean droplets included.

With no RESEND_API_KEY configured, sends are logged and skipped so dev and
tests never depend on the network. Failures never raise: a broken email
provider must not break signup, password reset, or a lost-dog report.
"""
import html

import httpx
import structlog

from app.config import settings

logger = structlog.stdlib.get_logger()

RESEND_API_URL = "https://api.resend.com/emails"


async def send_email(
    to: str,
    subject: str,
    body_html: str,
    *,
    reply_to: str | None = None,
) -> bool:
    """Send one email. Returns True only when Resend accepted the message."""
    if not settings.RESEND_API_KEY:
        logger.info("email_skipped_no_provider", to=to, subject=subject)
        return False

    payload: dict = {
        "from": settings.EMAIL_FROM,
        "to": [to],
        "subject": subject,
        "html": body_html,
    }
    if reply_to:
        payload["reply_to"] = [reply_to]

    try:
        async with httpx.AsyncClient(timeout=settings.EMAIL_TIMEOUT_S) as client:
            resp = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json=payload,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("email_send_failed", to=to, subject=subject, error=str(exc))
        return False

    if resp.status_code >= 400:
        logger.warning(
            "email_send_rejected", to=to, subject=subject,
            status=resp.status_code, body=resp.text[:500],
        )
        return False

    logger.info("email_sent", to=to, subject=subject)
    return True


def _layout(heading: str, body: str, cta_url: str | None = None, cta_label: str | None = None) -> str:
    """Minimal inline-styled shell that renders acceptably in every client."""
    button = ""
    if cta_url and cta_label:
        button = (
            f'<p style="margin:28px 0;"><a href="{cta_url}" '
            'style="background:#ee7a10;color:#ffffff;text-decoration:none;'
            'padding:12px 24px;border-radius:12px;font-weight:600;display:inline-block;">'
            f"{html.escape(cta_label)}</a></p>"
            f'<p style="color:#9ca3af;font-size:12px;">Or paste this link into your '
            f"browser:<br>{cta_url}</p>"
        )
    return (
        '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
        'max-width:520px;margin:0 auto;padding:32px 24px;color:#111827;">'
        '<p style="font-size:20px;font-weight:800;color:#ee7a10;margin:0 0 24px;">🐾 Fetch</p>'
        f'<h1 style="font-size:20px;margin:0 0 16px;">{html.escape(heading)}</h1>'
        f"{body}"
        f"{button}"
        '<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;">'
        '<p style="color:#9ca3af;font-size:12px;margin:0;">Sent by Fetch. '
        "If you weren't expecting this email, you can ignore it.</p>"
        "</div>"
    )


async def send_password_reset_email(to: str, raw_token: str) -> bool:
    url = f"{settings.FRONTEND_BASE_URL}/reset-password?token={raw_token}"
    return await send_email(
        to,
        "Reset your Fetch password",
        _layout(
            "Reset your password",
            "<p>Someone (hopefully you) asked to reset the password for this "
            f"account. The link is valid for {settings.RESET_TOKEN_TTL_MIN} minutes "
            "and can be used once.</p>",
            cta_url=url,
            cta_label="Choose a new password",
        ),
    )


async def send_verification_email(to: str, raw_token: str) -> bool:
    url = f"{settings.FRONTEND_BASE_URL}/verify-email/{raw_token}"
    return await send_email(
        to,
        "Verify your email for Fetch",
        _layout(
            "Confirm your email",
            "<p>Verifying unlocks everything in Fetch — lost &amp; found reports, "
            "dog transfers, the works.</p>",
            cta_url=url,
            cta_label="Verify my email",
        ),
    )


async def send_contact_relay_email(
    to: str, *, sender_name: str, sender_email: str, report_title: str, message: str
) -> bool:
    """Relay a message about a lost-dog report to its reporter.

    The reporter's address is never shown to the sender; replies go straight
    to the sender via Reply-To.
    """
    return await send_email(
        to,
        "Someone reached out about your lost-dog report",
        _layout(
            "A message about your report",
            f"<p><strong>{html.escape(sender_name)}</strong> sent you a message "
            f"about “{html.escape(report_title)}” through Fetch:</p>"
            '<blockquote style="border-left:3px solid #ee7a10;margin:16px 0;'
            'padding:8px 16px;color:#374151;background:#fff7ed;border-radius:0 8px 8px 0;">'
            f"{html.escape(message)}</blockquote>"
            "<p>Reply to this email to answer them directly.</p>",
        ),
        reply_to=sender_email,
    )


async def send_lost_alert_email(
    to: str, *, report_id: str, description: str, area_hint: str | None
) -> bool:
    url = f"{settings.FRONTEND_BASE_URL}/app/lost/{report_id}"
    where = f" near {html.escape(area_hint)}" if area_hint else " in your area"
    return await send_email(
        to,
        "A dog was reported lost near you",
        _layout(
            f"Lost dog reported{where}",
            f"<p>{html.escape(description[:300])}</p>"
            "<p>If you spot them, add a sighting — it goes straight to the owner.</p>",
            cta_url=url,
            cta_label="View the report",
        ),
    )
