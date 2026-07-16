"""The set of known OAuth providers. Add a provider = one import + one entry."""
from app.services.oauth.base import OAuthProvider
from app.services.oauth.github import GitHubProvider
from app.services.oauth.google import GoogleProvider

PROVIDERS: dict[str, OAuthProvider] = {
    "google": GoogleProvider(),
    "github": GitHubProvider(),
}


def get_provider(name: str) -> OAuthProvider | None:
    return PROVIDERS.get(name)


def enabled_provider_names() -> list[str]:
    """Providers with credentials configured (does NOT check the sso_enabled
    admin flag — callers combine the two)."""
    return [name for name, p in PROVIDERS.items() if p.enabled()]
