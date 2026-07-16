"""Provider-agnostic OAuth building blocks.

Each provider implements `OAuthProvider`; the router and account-resolution code
work only against this interface + `NormalizedIdentity`, so adding a provider is
a new subclass plus one line in `registry.PROVIDERS`.

House style mirrors services/stripe_service.py: plain httpx, no SDK, a
service-specific exception that routers map to a redirect-with-error.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.config import settings


class OAuthError(Exception):
    """An OAuth step failed (network, bad code, missing/unverified email, …).

    `user_message` is safe to surface to the browser (via ?error=); the base
    message is for logs.
    """

    def __init__(self, message: str, user_message: str = "Sign-in failed. Please try again."):
        super().__init__(message)
        self.user_message = user_message


@dataclass
class NormalizedIdentity:
    """What every provider boils down to for account resolution."""

    provider: str
    account_id: str          # provider's stable, immutable user id
    email: str | None
    email_verified: bool
    display_name: str


class OAuthProvider(ABC):
    name: str
    scopes: str
    authorize_endpoint: str
    token_endpoint: str

    #: (client_id, client_secret) — subclasses map these to their settings.
    @property
    @abstractmethod
    def _credentials(self) -> tuple[str, str]: ...

    def enabled(self) -> bool:
        cid, secret = self._credentials
        return bool(cid and secret)

    def authorize_url(self, state: str, redirect_uri: str) -> str:
        cid, _ = self._credentials
        params = {
            "client_id": cid,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": self.scopes,
            "state": state,
        }
        return f"{self.authorize_endpoint}?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> str:
        """Trade an authorization code for an access token."""
        cid, secret = self._credentials
        try:
            async with httpx.AsyncClient(timeout=settings.OAUTH_TIMEOUT_S) as client:
                res = await client.post(
                    self.token_endpoint,
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": redirect_uri,
                        "client_id": cid,
                        "client_secret": secret,
                    },
                    headers={"Accept": "application/json"},
                )
        except httpx.HTTPError as e:
            raise OAuthError(f"{self.name} token request failed: {e}")
        if res.status_code != 200:
            raise OAuthError(f"{self.name} token exchange {res.status_code}: {res.text[:200]}")
        token = res.json().get("access_token")
        if not token:
            raise OAuthError(f"{self.name} token response missing access_token")
        return token

    @abstractmethod
    async def fetch_identity(self, access_token: str) -> NormalizedIdentity:
        """Fetch + normalize the user's profile using the access token."""
        ...
