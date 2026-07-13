"""Minimal RFC 6238 TOTP + RFC 4648 base32, implemented on the stdlib so the
app needs no extra dependency (and no Docker image rebuild). Compatible with
Google Authenticator, Authy, 1Password, etc."""
import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

_DIGITS = 6
_PERIOD = 30
# Accept the adjacent windows so a code entered near a boundary still works.
_ALLOWED_DRIFT = 1


def generate_secret(length: int = 20) -> str:
    """A fresh base32 (unpadded) secret suitable for an authenticator app."""
    raw = secrets.token_bytes(length)
    return base64.b32encode(raw).decode("ascii").rstrip("=")


def _hotp(secret: str, counter: int) -> str:
    # base32 decode is case-insensitive and needs padding to a multiple of 8.
    padded = secret.upper() + "=" * (-len(secret) % 8)
    key = base64.b32decode(padded, casefold=True)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(code_int % (10 ** _DIGITS)).zfill(_DIGITS)


def verify(secret: str, code: str, *, at: float | None = None) -> bool:
    """True if `code` is valid for `secret` now (± one 30s window)."""
    if not secret or not code:
        return False
    code = code.strip().replace(" ", "")
    if not code.isdigit() or len(code) != _DIGITS:
        return False
    now = int((at if at is not None else time.time()) // _PERIOD)
    for drift in range(-_ALLOWED_DRIFT, _ALLOWED_DRIFT + 1):
        if hmac.compare_digest(_hotp(secret, now + drift), code):
            return True
    return False


def provisioning_uri(secret: str, *, account: str, issuer: str = "Fetch") -> str:
    """otpauth:// URI an authenticator app scans (as a QR code) to enroll."""
    label = quote(f"{issuer}:{account}")
    params = f"secret={secret}&issuer={quote(issuer)}&digits={_DIGITS}&period={_PERIOD}"
    return f"otpauth://totp/{label}?{params}"
