"""Transactional email via Resend's HTTPS API.

Resend is API-only (POST https://api.resend.com/emails with a Bearer key), so
it works on hosts that block outbound SMTP — DigitalOcean droplets included.

With no RESEND_API_KEY configured, sends are logged and skipped so dev and
tests never depend on the network. Failures never raise: a broken email
provider must not break signup, password reset, or a lost-pet report.
"""
import html

import httpx
import structlog

from app.config import settings

logger = structlog.stdlib.get_logger()

RESEND_API_URL = "https://api.resend.com/emails"


def _resend_error(resp: httpx.Response) -> str:
    """Pull the human-readable reason out of a Resend error response."""
    try:
        data = resp.json()
    except ValueError:
        data = None
    if isinstance(data, dict):
        message = data.get("message") or (data.get("error") or {}).get("message")
        if isinstance(message, str) and message:
            return message
    return resp.text[:200].strip() or "no response body"


async def _deliver(
    to: str,
    subject: str,
    body_html: str,
    *,
    reply_to: str | None = None,
) -> tuple[bool, str]:
    """POST one message to Resend. Returns (accepted, human-readable reason).

    Never raises. Callers that only care whether it worked use send_email();
    the reason exists for the admin deliverability probe, which is useless
    without it — "failed" alone doesn't distinguish a missing API key from an
    unverified sender domain.
    """
    if not settings.RESEND_API_KEY:
        logger.info("email_skipped_no_provider", to=to, subject=subject)
        return False, "RESEND_API_KEY is not set — email delivery is disabled."

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
        return False, f"Could not reach Resend: {exc}"

    if resp.status_code >= 400:
        logger.warning(
            "email_send_rejected", to=to, subject=subject,
            status=resp.status_code, body=resp.text[:500],
        )
        return False, f"Resend rejected it (HTTP {resp.status_code}): {_resend_error(resp)}"

    logger.info("email_sent", to=to, subject=subject)
    return True, "Resend accepted the message."


async def send_email(
    to: str,
    subject: str,
    body_html: str,
    *,
    reply_to: str | None = None,
) -> bool:
    """Send one email. Returns True only when Resend accepted the message."""
    accepted, _ = await _deliver(to, subject, body_html, reply_to=reply_to)
    return accepted


BRAND = "#ee7a10"
FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

# Progressive enhancement only — every load-bearing style is also inlined below,
# because Outlook drops most of this and Gmail's clipping is unforgiving.
_HEAD_STYLES = """
    body { margin:0 !important; padding:0 !important; width:100% !important; background:#f4f5f7; }
    table { border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    .content p { margin:0 0 16px; }
    .content p:last-child { margin:0; }
    .content ul { margin:0 0 16px; padding-left:20px; }
    .content a { color:#ee7a10; }
    @media only screen and (max-width:620px) {
      .pad { padding-left:24px !important; padding-right:24px !important; }
    }
"""


def _layout(
    heading: str,
    body: str,
    cta_url: str | None = None,
    cta_label: str | None = None,
    preheader: str | None = None,
) -> str:
    """Wrap body HTML in the branded email shell.

    Table-based and inline-styled on purpose: Outlook ignores most modern CSS
    and collapses ``<div>`` layouts. The wordmark stays live text beside the
    logo image, so a client with remote images blocked still shows "Fetchpawz"
    rather than an empty box — which is also why the logo's alt is empty.

    ``preheader`` is the grey snippet mail apps show after the subject in the
    inbox list. Left unset, they scrape the opening body text instead.
    """
    base = settings.FRONTEND_BASE_URL.rstrip("/")

    preheader_block = ""
    if preheader:
        preheader_block = (
            '<div style="display:none;font-size:0;line-height:0;max-height:0;'
            'mso-hide:all;overflow:hidden;opacity:0;">'
            f"{html.escape(preheader)}"
            # Zero-width spaces stop the client padding the snippet with body text.
            + "&#8203;" * 60
            + "</div>"
        )

    button = ""
    if cta_url and cta_label:
        button = (
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
            'style="margin:26px 0 0;"><tr>'
            f'<td align="center" bgcolor="{BRAND}" style="border-radius:12px;">'
            f'<a href="{cta_url}" style="display:inline-block;padding:13px 30px;'
            f"font-family:{FONT};font-size:15px;font-weight:600;color:#ffffff;"
            'text-decoration:none;border-radius:12px;">'
            f"{html.escape(cta_label)}</a></td></tr></table>"
            '<p style="margin:14px 0 0;font-family:' + FONT + ';font-size:12px;'
            'line-height:18px;color:#9ca3af;">Or paste this link into your browser:<br>'
            f'<span style="color:#6b7280;word-break:break-all;">{cta_url}</span></p>'
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{html.escape(heading)}</title>
<style>{_HEAD_STYLES}</style>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;">
{preheader_block}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;">
<tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e8eaed;border-radius:16px;">

<tr><td class="pad" style="padding:30px 40px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="padding-right:11px;vertical-align:middle;line-height:0;">
      <img src="{base}/email-logo.png" width="36" height="36" alt="" style="display:block;width:36px;height:36px;">
    </td>
    <td style="vertical-align:middle;font-family:{FONT};font-size:19px;font-weight:800;color:{BRAND};letter-spacing:-0.4px;">Fetchpawz</td>
  </tr></table>
</td></tr>

<tr><td class="pad" style="padding:22px 40px 0;line-height:0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="44"><tr>
    <td height="3" bgcolor="{BRAND}" style="height:3px;border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
  </tr></table>
</td></tr>

<tr><td class="pad content" style="padding:18px 40px 34px;font-family:{FONT};font-size:15px;line-height:23px;color:#374151;">
  <h1 style="margin:0 0 14px;font-family:{FONT};font-size:22px;line-height:29px;font-weight:800;color:#111827;letter-spacing:-0.5px;">{html.escape(heading)}</h1>
  {body}
  {button}
</td></tr>

<tr><td class="pad" style="padding:20px 40px 24px;border-top:1px solid #eef0f2;background:#fafbfc;border-radius:0 0 16px 16px;">
  <p style="margin:0 0 5px;font-family:{FONT};font-size:12px;line-height:18px;color:#9ca3af;">Sent by <a href="{base}" style="color:#6b7280;text-decoration:none;font-weight:600;">Fetchpawz</a> — the pet app with a rescue mission.</p>
  <p style="margin:0;font-family:{FONT};font-size:12px;line-height:18px;color:#9ca3af;">If you weren't expecting this email, you can safely ignore it.</p>
</td></tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>"""


async def send_password_reset_email(to: str, raw_token: str) -> bool:
    url = f"{settings.FRONTEND_BASE_URL}/reset-password?token={raw_token}"
    return await send_email(
        to,
        "Reset your Fetchpawz password",
        _layout(
            "Reset your password",
            "<p>Someone (hopefully you) asked to reset the password for this "
            f"account. The link is valid for {settings.RESET_TOKEN_TTL_MIN} minutes "
            "and can be used once.</p>",
            cta_url=url,
            cta_label="Choose a new password",
            preheader="Your reset link is valid for one use.",
        ),
    )


async def send_verification_email(to: str, raw_token: str) -> bool:
    url = f"{settings.FRONTEND_BASE_URL}/verify-email/{raw_token}"
    return await send_email(
        to,
        "Verify your email for Fetchpawz",
        _layout(
            "Confirm your email",
            "<p>Verifying unlocks everything in Fetchpawz — lost &amp; found reports, "
            "pet transfers, the works.</p>",
            cta_url=url,
            cta_label="Verify my email",
            preheader="One tap to confirm your address and unlock everything.",
        ),
    )


async def send_email_change_email(to: str, raw_token: str) -> bool:
    url = f"{settings.FRONTEND_BASE_URL}/confirm-email-change?token={raw_token}"
    return await send_email(
        to,
        "Confirm your new email for Fetchpawz",
        _layout(
            "Confirm this address",
            "<p>Someone asked to move their Fetchpawz account to this email "
            "address. Confirm to complete the switch; if this wasn't you, "
            "ignore this email and nothing changes.</p>",
            cta_url=url,
            cta_label="Use this address",
            preheader="Confirm the switch, or ignore this and nothing changes.",
        ),
    )


async def send_waitlist_confirmation_email(to: str) -> bool:
    return await send_email(
        to,
        "You're on the Fetchpawz waitlist",
        _layout(
            "You're on the list 🐾",
            "<p>Fetchpawz is invite-only while we get it ready. You're in line "
            "now — when a spot opens, your invite lands in this inbox. "
            "Nothing else to do.</p>",
            cta_url=settings.FRONTEND_BASE_URL,
            cta_label="Sniff around the site",
            preheader="You are in line — your invite lands in this inbox.",
        ),
    )


async def send_invite_email(to: str, code: str) -> bool:
    """A spot opened up: send the waitlisted person their signup link with the
    invite code baked in (only the code travels in the URL)."""
    url = f"{settings.FRONTEND_BASE_URL}/signup?invite={code}"
    return await send_email(
        to,
        "Your Fetchpawz invite is here 🐾",
        _layout(
            "You're in! 🐾",
            "<p>A spot opened up and we saved it for you. Tap below to create your "
            "account — your invite code is already applied.</p>"
            f'<p style="color:#6b7280;font-size:13px;">Invite code: '
            f"<strong>{html.escape(code)}</strong></p>",
            cta_url=url,
            cta_label="Accept your invite",
            preheader="A spot opened up and your code is already applied.",
        ),
    )


async def send_contact_relay_email(
    to: str, *, sender_name: str, sender_email: str, report_title: str, message: str
) -> bool:
    """Relay a message about a lost-pet report to its reporter.

    The reporter's address is never shown to the sender; replies go straight
    to the sender via Reply-To.
    """
    return await send_email(
        to,
        "Someone reached out about your lost-pet report",
        _layout(
            "A message about your report",
            f"<p><strong>{html.escape(sender_name)}</strong> sent you a message "
            f"about “{html.escape(report_title)}” through Fetchpawz:</p>"
            '<blockquote style="border-left:3px solid #ee7a10;margin:16px 0;'
            'padding:8px 16px;color:#374151;background:#fff7ed;border-radius:0 8px 8px 0;">'
            f"{html.escape(message)}</blockquote>"
            "<p>Reply to this email to answer them directly.</p>",
            preheader="Reply to this email to answer them directly.",
        ),
        reply_to=sender_email,
    )


async def send_test_email(to: str) -> tuple[bool, str]:
    """Admin deliverability probe. Returns (accepted, human-readable reason).

    Unlike every other sender here it reports *why* a send failed — checking
    that the Resend key, sender domain, and DNS actually work is the point.
    """
    return await _deliver(
        to,
        "Fetchpawz test email",
        _layout(
            "Email is working 🐾",
            "<p>An admin sent this from Admin → System to confirm that "
            "transactional email is configured correctly. Nothing to do.</p>"
            f'<p style="color:#6b7280;font-size:13px;">Sender: '
            f"<strong>{html.escape(settings.EMAIL_FROM)}</strong><br>"
            f"Environment: <strong>{html.escape(settings.ENVIRONMENT)}</strong></p>",
            preheader="If this arrived, transactional email is working.",
        ),
    )


async def send_lost_alert_email(
    to: str, *, report_id: str, description: str, area_hint: str | None
) -> bool:
    url = f"{settings.FRONTEND_BASE_URL}/app/lost/{report_id}"
    where = f" near {html.escape(area_hint)}" if area_hint else " in your area"
    return await send_email(
        to,
        "A pet was reported lost near you",
        _layout(
            f"Lost pet reported{where}",
            f"<p>{html.escape(description[:300])}</p>"
            "<p>If you spot them, add a sighting — it goes straight to the owner.</p>",
            cta_url=url,
            cta_label="View the report",
            preheader="Spotted them? Add a sighting and the owner hears instantly.",
        ),
    )
