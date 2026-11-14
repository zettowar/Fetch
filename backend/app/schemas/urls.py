"""Shared URL normalisation for user/admin-supplied links.

Several models store a link that the SPA renders straight into an ``href``
(``rescue_profiles.website``/``donation_url``, ``vets.website``,
``news.link_url``). Anything that is not clearly an http(s) URL must not survive
to the client, or a stored ``javascript:`` value becomes click-triggered XSS.
"""

# Schemes that execute rather than navigate. Checked before the https:// prefix
# is applied, so "javascript:alert(1)" is rejected rather than silently turned
# into the harmless-but-confusing "https://javascript:alert(1)".
_DANGEROUS_SCHEMES = ("javascript:", "data:", "vbscript:", "file:", "blob:")


def normalise_url(v: str | None, *, allow_site_path: bool = False) -> str | None:
    """Trim, reject executable schemes, and default a bare host to https://.

    Returns None for empty input. Raises ValueError for a dangerous scheme so
    Pydantic surfaces it as a 422 rather than storing it.

    ``allow_site_path`` keeps a same-site path such as ``/signup-rescue`` as it
    is. News posts link into the site that way (the page renders them with the
    router, not as an external link), and without this the https:// default
    below turned the path into ``https:///signup-rescue`` — so editing a post
    to fix a typo broke its link. A leading ``//`` is not a path (it is a
    protocol-relative URL to another host) and is still treated as a host.
    """
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if v.lower().replace(" ", "").startswith(_DANGEROUS_SCHEMES):
        raise ValueError("Only http(s) links are allowed")
    if allow_site_path and v.startswith("/") and not v.startswith("//") and "\\" not in v:
        return v
    if not v.startswith(("http://", "https://")):
        return f"https://{v}"
    return v


def sanitize_url(v: str | None) -> str | None:
    """normalise_url for bulk imports: drop a bad value instead of raising.

    OpenStreetMap is world-editable and its `website` tags land straight in an
    <a href> on the vet/park pages. A single hostile tag must neither ship an
    executing link nor abort the whole import.
    """
    try:
        return normalise_url(v)
    except ValueError:
        return None
