"""GitHub Sign-In (plain OAuth2).

GitHub's /user may omit the email or return an unverified one, so the real
verified address comes from /user/emails (needs the user:email scope).
"""
import httpx

from app.config import settings
from app.services.oauth.base import NormalizedIdentity, OAuthError, OAuthProvider

USER_URL = "https://api.github.com/user"
EMAILS_URL = "https://api.github.com/user/emails"


class GitHubProvider(OAuthProvider):
    name = "github"
    scopes = "read:user user:email"
    authorize_endpoint = "https://github.com/login/oauth/authorize"
    token_endpoint = "https://github.com/login/oauth/access_token"

    @property
    def _credentials(self) -> tuple[str, str]:
        return settings.GITHUB_OAUTH_CLIENT_ID, settings.GITHUB_OAUTH_CLIENT_SECRET

    async def fetch_identity(self, access_token: str) -> NormalizedIdentity:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
        }
        try:
            async with httpx.AsyncClient(timeout=settings.OAUTH_TIMEOUT_S) as client:
                user_res = await client.get(USER_URL, headers=headers)
                emails_res = await client.get(EMAILS_URL, headers=headers)
        except httpx.HTTPError as e:
            raise OAuthError(f"github profile request failed: {e}")
        if user_res.status_code != 200:
            raise OAuthError(f"github /user {user_res.status_code}: {user_res.text[:200]}")

        user = user_res.json()
        account_id = user.get("id")
        if not account_id:
            raise OAuthError("github /user missing id")

        # Prefer the primary verified email; fall back to any verified one.
        email: str | None = None
        email_verified = False
        if emails_res.status_code == 200:
            emails = emails_res.json()
            primary = next((e for e in emails if e.get("primary") and e.get("verified")), None)
            chosen = primary or next((e for e in emails if e.get("verified")), None)
            if chosen:
                email, email_verified = chosen.get("email"), True

        return NormalizedIdentity(
            provider=self.name,
            account_id=str(account_id),
            email=email,
            email_verified=email_verified,
            display_name=(user.get("name") or user.get("login") or "Fetchpawz user"),
        )
