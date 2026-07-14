"""Create (or promote) a single platform admin account.

Interactive by default — you are prompted for the password so it never lands in
shell history or the process list. For non-interactive use (CI), set
ADMIN_EMAIL + ADMIN_PASSWORD (+ optional ADMIN_NAME) in the environment.

The account is created active + email-verified with role="admin". If a user
with that email already exists, it is promoted to admin and its password reset
(handy for fixing a locked-out admin), so the script is safe to re-run.

Run inside the backend container, e.g. after a fresh DB reset:
    docker compose -f docker-compose.prod.yml exec backend python -m app.scripts.create_admin
"""
from __future__ import annotations

import asyncio
import getpass
import os
import re
import sys

from sqlalchemy import select

from app.db import async_session, engine
from app.models.user import User
from app.security import hash_password

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LEN = 12


def _die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


def _resolve_email() -> str:
    email = os.environ.get("ADMIN_EMAIL")
    if not email:
        if not sys.stdin.isatty():
            _die("no TTY — set ADMIN_EMAIL (and ADMIN_PASSWORD) for non-interactive use")
        email = input("Admin email: ")
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        _die(f"invalid email: {email!r}")
    return email


def _resolve_name() -> str:
    name = os.environ.get("ADMIN_NAME")
    if name:
        return name
    if not sys.stdin.isatty():  # non-interactive: name is optional
        return "Admin"
    return input("Display name [Admin]: ").strip() or "Admin"


def _resolve_password() -> str:
    pw = os.environ.get("ADMIN_PASSWORD")
    if pw is None:
        if not sys.stdin.isatty():
            _die("no TTY — set ADMIN_PASSWORD for non-interactive use")
        pw = getpass.getpass(f"Admin password (min {MIN_PASSWORD_LEN} chars): ")
        if pw != getpass.getpass("Confirm password: "):
            _die("passwords do not match")
    if len(pw) < MIN_PASSWORD_LEN:
        _die(f"password must be at least {MIN_PASSWORD_LEN} characters")
    return pw


async def main() -> None:
    email = _resolve_email()
    display_name = _resolve_name()
    password = _resolve_password()

    async with async_session() as db:
        existing = (
            await db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()
        if existing is not None:
            existing.role = "admin"
            existing.is_active = True
            existing.is_verified = True
            existing.display_name = display_name
            existing.password_hash = hash_password(password)
            action = "promoted existing user to admin (password reset)"
        else:
            db.add(User(
                email=email,
                password_hash=hash_password(password),
                display_name=display_name,
                role="admin",
                is_active=True,
                is_verified=True,
            ))
            action = "created new admin"
        await db.commit()

    await engine.dispose()
    print(f"OK — {action}: {email}")


if __name__ == "__main__":
    asyncio.run(main())
