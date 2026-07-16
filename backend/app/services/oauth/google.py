"""Google Sign-In (OpenID Connect).

We use the OAuth code flow and read the profile from the OIDC userinfo endpoint
with the resulting access token — the token came to us directly over TLS from
Google's token endpoint, so no id_token/JWKS verification is needed.
"""
import httpx

from app.config import settings
from app.services.oauth.base import NormalizedIdentity, OAuthError, OAuthProvider

USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


class GoogleProvider(OAuthProvider):
    name = "google"
    scopes = "openid email profile"
    authorize_endpoint = "https://accounts.google.com/o/oauth2/v2/auth"
    token_endpoint = "https://oauth2.googleapis.com/token"

    @property
    def _credentials(self) -> tuple[str, str]:
        return settings.GOOGLE_OAUTH_CLIENT_ID, settings.GOOGLE_OAUTH_CLIENT_SECRET

    async def fetch_identity(self, access_token: str) -> NormalizedIdentity:
        try:
            async with httpx.AsyncClient(timeout=settings.OAUTH_TIMEOUT_S) as client:
                res = await client.get(
                    USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
                )
        except httpx.HTTPError as e:
            raise OAuthError(f"google userinfo request failed: {e}")
        if res.status_code != 200:
            raise OAuthError(f"google userinfo {res.status_code}: {res.text[:200]}")
        data = res.json()

        sub = data.get("sub")
        if not sub:
            raise OAuthError("google userinfo missing sub")
        return NormalizedIdentity(
            provider=self.name,
            account_id=str(sub),
            email=(data.get("email") or None),
            email_verified=bool(data.get("email_verified")),
            display_name=(data.get("name") or data.get("email") or "Fetchpawz user"),
        )
