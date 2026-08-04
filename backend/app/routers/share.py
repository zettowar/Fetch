"""Public, server-rendered share pages for lost & found reports.

These routes are mounted at the site *root* (no /api prefix) and are the only
server-rendered HTML the backend serves. They exist so a lost-pet report can be
shared off-platform: real Open Graph / Twitter-card meta (which social scrapers
read without running JS, unlike the SPA), a clean shareable URL, one-tap share
buttons (Nextdoor / Facebook / X), and a sitemap so search engines index them.

Privacy: only reports the owner opted into (`is_public`) render here, and
coordinates are always fuzzed via the same deterministic jitter used everywhere
else — the true last-seen point is never emitted. Contact still happens through
the authenticated in-app relay (reporter's address stays hidden).

In production nginx proxies `/lost/`, `/sitemap.xml` and `/robots.txt` to the
backend; in dev the Vite server proxies the same paths (see vite.config.ts).
"""
import html
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db import get_db
from app.models.lost_report import LostReport
from app.models.pet import Pet
from app.services.breed_display import breed_display
from app.services.lost_service import fuzz_coordinate
from app.storage import get_storage

router = APIRouter()

# Short cache so a scraper re-fetch / CDN edge doesn't hammer the DB, but resolved
# reports still fall out of feeds within a few minutes.
_PAGE_CACHE = "public, max-age=300"


def _base() -> str:
    """Absolute public origin used to build canonical + share URLs. Same value
    the emails use (FRONTEND_BASE_URL); in prod that's the brand domain that
    nginx serves and proxies /api + /lost to."""
    return settings.FRONTEND_BASE_URL.rstrip("/")


def _abs(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith(("http://", "https://")):
        return url
    return f"{_base()}{url}"


def _fmt_radius(m: int) -> str:
    if m >= 1000:
        return f"{m / 1000:.1f} km".replace(".0 km", " km")
    return f"{m} m"


def _pet_photo_url(pet: Pet | None) -> str | None:
    if pet is None or not pet.photos:
        return None
    approved = [p for p in pet.photos if p.moderation_status == "approved"]
    if not approved:
        return None
    primary = next((p for p in approved if p.id == pet.primary_photo_id), approved[0])
    return _abs(get_storage().url(primary.storage_key))


def _not_found() -> HTMLResponse:
    body = (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        "<meta name=\"robots\" content=\"noindex\">"
        "<title>Not found · Fetchpawz</title></head>"
        "<body style=\"font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;"
        "background:#fff7ed;color:#1f2937;display:flex;min-height:100vh;margin:0;"
        "align-items:center;justify-content:center;text-align:center;padding:24px\">"
        "<div><div style=\"font-size:48px\">🐾</div>"
        "<h1 style=\"margin:.5rem 0\">This report isn't available</h1>"
        "<p style=\"color:#6b7280\">It may have been resolved, removed, or set to private.</p>"
        f"<p><a href=\"{html.escape(_base())}\" style=\"color:#ee7a10;font-weight:600\">"
        "Go to Fetchpawz</a></p></div></body></html>"
    )
    return HTMLResponse(body, status_code=404)


@router.get("/lost/{report_id}", response_class=HTMLResponse)
async def lost_share_page(report_id: UUID, db: AsyncSession = Depends(get_db)):
    """Public share page for one lost/found report (opt-in via is_public)."""
    result = await db.execute(
        select(LostReport)
        .options(
            selectinload(LostReport.pet).selectinload(Pet.photos),
            selectinload(LostReport.pet).selectinload(Pet.breeds),
        )
        .where(LostReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if report is None or not report.is_public:
        return _not_found()

    missing = report.kind == "missing"
    pet = report.pet
    name = (pet.name if pet else None) or ("A missing pet" if missing else "A found pet")
    breed = breed_display(pet.mix_type, pet.breeds, pet.species) if pet else None
    photo = _pet_photo_url(pet) or _abs("/og-image.png")

    kind_label = "Missing" if missing else "Found"
    accent = "#ef4444" if missing else "#3b82f6"
    emoji = "🚨" if missing else "🐾"
    resolved = report.status != "open"

    # --- text (escaped for HTML) ---
    e_name = html.escape(name)
    e_breed = html.escape(breed) if breed else None
    desc = (report.description or "").strip()
    og_desc = " ".join(desc.split())[:197]
    if len(" ".join(desc.split())) > 197:
        og_desc += "…"
    title = f"{kind_label}: {e_name}" + (f" ({e_breed})" if e_breed else "")

    # --- fuzzed location (never the true point) ---
    map_link = None
    radius_txt = None
    if report.last_seen_lat is not None and report.last_seen_lng is not None:
        flat, flng = fuzz_coordinate(
            report.last_seen_lat, report.last_seen_lng,
            report.location_fuzz_m or 500, seed=str(report.id),
        )
        map_link = (
            f"https://www.openstreetmap.org/?mlat={flat:.5f}&mlon={flng:.5f}"
            f"#map=14/{flat:.5f}/{flng:.5f}"
        )
        radius_txt = _fmt_radius(report.location_fuzz_m or 500)

    public_url = f"{_base()}/lost/{report.id}"
    app_url = f"{_base()}/app/lost/{report.id}"

    # --- share targets ---
    where_bit = f" near this area" if map_link else ""
    share_line = f"{emoji} {kind_label.upper()}: {name}{where_bit} — please share to help!"
    nd_body = quote(f"{share_line} {public_url}")
    nextdoor = f"https://nextdoor.com/sharekit/?source=fetchpawz&body={nd_body}"
    facebook = f"https://www.facebook.com/sharer/sharer.php?u={quote(public_url)}"
    twitter = f"https://twitter.com/intent/tweet?text={quote(share_line)}&url={quote(public_url)}"

    # --- optional fragments ---
    resolved_banner = (
        f"<div style=\"background:#dcfce7;color:#166534;font-weight:600;border-radius:14px;"
        f"padding:12px 16px;margin-bottom:16px;text-align:center\">🎉 Good news — this "
        f"{'pet has been found' if missing else 'report is resolved'}. Thank you for caring.</div>"
        if resolved else ""
    )
    photo_block = (
        f"<img src=\"{html.escape(photo)}\" alt=\"Photo of {e_name}\" "
        f"style=\"width:100%;max-height:420px;object-fit:cover;display:block\">"
        if photo else ""
    )
    breed_block = f"<p style=\"margin:2px 0 0;color:#6b7280\">{e_breed}</p>" if e_breed else ""
    loc_block = (
        f"<p style=\"margin:16px 0 4px;font-weight:600\">{'Last seen near' if missing else 'Found near'} "
        f"<span style=\"font-weight:400;color:#6b7280;font-size:.9em\">(within ~{radius_txt})</span></p>"
        f"<a href=\"{map_link}\" target=\"_blank\" rel=\"noopener nofollow\" "
        f"style=\"display:inline-block;color:{accent};font-weight:600;text-decoration:none\">"
        f"📍 View the area on a map →</a>"
        if map_link else ""
    )
    # Sightings/contact loop lives in the app (auth'd relay keeps the reporter's
    # address hidden). Anonymous finders are funnelled there.
    cta_block = "" if resolved else (
        f"<a href=\"{app_url}\" style=\"display:block;text-align:center;background:{accent};"
        f"color:#fff;font-weight:700;padding:14px;border-radius:14px;text-decoration:none;"
        f"margin-top:20px\">Seen {e_name}? Report a sighting in the app →</a>"
    )

    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ee7a10">
<title>{title} · Fetchpawz</title>
<meta name="description" content="{html.escape(og_desc)}">
{'<meta name="robots" content="noindex">' if resolved else '<meta name="robots" content="index,follow">'}
<link rel="canonical" href="{public_url}">
<link rel="icon" type="image/svg+xml" href="{_abs('/favicon.svg')}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Fetchpawz">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{html.escape(og_desc)}">
<meta property="og:url" content="{public_url}">
<meta property="og:image" content="{html.escape(photo)}">
<meta property="og:image:alt" content="Photo of {e_name}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{html.escape(og_desc)}">
<meta name="twitter:image" content="{html.escape(photo)}">
<style>
  *{{box-sizing:border-box}}
  body{{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    background:#fff7ed;color:#1f2937;line-height:1.5}}
  .wrap{{max-width:560px;margin:0 auto;padding:20px 16px 48px}}
  .brand{{display:flex;align-items:center;gap:8px;font-weight:800;color:#ee7a10;
    text-decoration:none;font-size:18px;margin-bottom:16px}}
  .card{{background:#fff;border-radius:20px;overflow:hidden;
    box-shadow:0 10px 30px -12px rgba(0,0,0,.2)}}
  .pad{{padding:20px}}
  .badge{{display:inline-block;background:{accent};color:#fff;font-weight:800;font-size:12px;
    letter-spacing:.05em;text-transform:uppercase;padding:4px 10px;border-radius:999px}}
  h1{{font-size:26px;margin:12px 0 0}}
  .desc{{white-space:pre-wrap;word-break:break-word;margin:16px 0 0;color:#374151}}
  .share{{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}}
  .share a,.share button{{font:inherit;font-weight:700;font-size:14px;border:0;cursor:pointer;
    padding:12px;border-radius:12px;text-align:center;text-decoration:none;color:#fff}}
  .nd{{background:#8ed500;color:#14330a!important}} .fb{{background:#1877f2}}
  .tw{{background:#0f1419}} .cp{{background:#e5e7eb;color:#1f2937!important}}
  .muted{{color:#6b7280;font-size:13px}}
  .chips{{margin-top:20px;padding-top:16px;border-top:1px solid #f0f0f0}}
  .chips a{{color:#2563eb;text-decoration:none;font-size:13px;margin-right:14px;white-space:nowrap}}
  footer{{text-align:center;margin-top:24px;color:#9ca3af;font-size:12px}}
  footer a{{color:#ee7a10;text-decoration:none;font-weight:600}}
  @media (prefers-color-scheme: dark){{
    body{{background:#0b0b0f;color:#e5e7eb}} .card{{background:#16161c}}
    h1{{color:#f3f4f6}} .desc{{color:#cbd5e1}} .chips{{border-color:#26262e}}
    .cp{{background:#26262e;color:#e5e7eb!important}}
  }}
</style>
</head>
<body>
<div class="wrap">
  <a class="brand" href="{_base()}">🐾 Fetchpawz</a>
  {resolved_banner}
  <div class="card">
    {photo_block}
    <div class="pad">
      <span class="badge">{emoji} {kind_label}</span>
      <h1>{e_name}</h1>
      {breed_block}
      <p class="desc">{html.escape(desc)}</p>
      {loc_block}
      {cta_block}
      <div class="share">
        <a class="nd" href="{nextdoor}" target="_blank" rel="noopener nofollow">Share to Nextdoor</a>
        <a class="fb" href="{facebook}" target="_blank" rel="noopener nofollow">Share to Facebook</a>
        <a class="tw" href="{twitter}" target="_blank" rel="noopener nofollow">Share to X</a>
        <button class="cp" type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText('{public_url}').then(()=>{{this.textContent='Link copied!'}})">Copy link</button>
      </div>
      <div class="chips">
        <span class="muted">Found a pet? Check the chip:</span><br>
        <a href="https://www.aaha.org/your-pet/pet-microchip-lookup/" target="_blank" rel="noopener nofollow">AAHA Universal Lookup</a>
        <a href="https://www.petcolove.org/lost/" target="_blank" rel="noopener nofollow">Petco Love Lost</a>
        <a href="https://www.akcreunite.org/" target="_blank" rel="noopener nofollow">AKC Reunite</a>
      </div>
    </div>
  </div>
  <footer>
    Posted on <a href="{_base()}">Fetchpawz</a> — the pet app with a rescue mission.
  </footer>
</div>
</body>
</html>"""
    return HTMLResponse(page, headers={"Cache-Control": _PAGE_CACHE})


@router.get("/sitemap.xml")
async def sitemap(db: AsyncSession = Depends(get_db)):
    """Sitemap of the public marketing pages + every opted-in, still-open lost
    report, so search engines discover and index them."""
    base = _base()
    urls: list[tuple[str, str | None]] = [
        (f"{base}/", None),
        (f"{base}/about", None),
        (f"{base}/mission", None),
        (f"{base}/news", None),
    ]
    result = await db.execute(
        select(LostReport.id, LostReport.updated_at)
        .where(LostReport.is_public.is_(True), LostReport.status == "open")
        .order_by(LostReport.updated_at.desc())
        .limit(5000)
    )
    for rid, updated in result.all():
        lastmod = updated.date().isoformat() if updated else None
        urls.append((f"{base}/lost/{rid}", lastmod))

    parts = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lastmod in urls:
        parts.append("<url>")
        parts.append(f"<loc>{html.escape(loc)}</loc>")
        if lastmod:
            parts.append(f"<lastmod>{lastmod}</lastmod>")
        parts.append("</url>")
    parts.append("</urlset>")
    return Response(
        content="".join(parts),
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=900"},
    )


@router.get("/robots.txt", response_class=PlainTextResponse)
async def robots() -> PlainTextResponse:
    """Served dynamically so the Sitemap directive carries the deployment's real
    absolute origin. Keeps the app/admin shells out of the index."""
    body = (
        "User-agent: *\n"
        "Disallow: /app/\n"
        "Disallow: /admin/\n"
        "Allow: /\n"
        f"Sitemap: {_base()}/sitemap.xml\n"
    )
    return PlainTextResponse(body, headers={"Cache-Control": "public, max-age=3600"})
