"""Layer 5 — Enrichment: find email, owner name, and social profiles for scored leads.

Pipeline: scrape website contact pages → Hunter.io fallback → save to enrichment_data.
"""

import re
from urllib.parse import urlparse

import aiohttp
import structlog

from src.config import settings
from src.models.enrichment import EnrichmentData
from src.utils.time import utcnow

logger = structlog.get_logger()

GENERIC_PREFIXES = (
    "info@", "contact@", "hello@", "support@", "admin@",
    "sales@", "noreply@", "no-reply@", "help@", "office@",
    "service@", "billing@", "webmaster@",
)

CONTACT_PATHS = [
    "/contact", "/contact-us", "/about", "/about-us",
    "/team", "/our-team", "/staff",
]

SOCIAL_PATTERNS = {
    "facebook": r'(?:https?://)?(?:www\.)?facebook\.com/[^"\s<>\')]+',
    "instagram": r'(?:https?://)?(?:www\.)?instagram\.com/[^"\s<>\')]+',
    "linkedin": r'(?:https?://)?(?:www\.)?linkedin\.com/(?:in|company)/[^"\s<>\')]+',
    "twitter": r'(?:https?://)?(?:www\.)?(?:twitter|x)\.com/[^"\s<>\')]+',
    "yelp": r'(?:https?://)?(?:www\.)?yelp\.com/biz/[^"\s<>\')]+',
}

EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
JUNK_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js")


def _extract_domain(url: str) -> str | None:
    if not url:
        return None
    if not url.startswith("http"):
        url = f"https://{url}"
    try:
        host = urlparse(url).hostname
        return host if host else None
    except Exception:
        return None


def _clean_emails(raw: set[str]) -> list[str]:
    """Deduplicate, strip junk, sort personal-first."""
    cleaned = set()
    for e in raw:
        e = e.lower().strip().rstrip(".")
        if any(e.endswith(ext) for ext in JUNK_EXTENSIONS):
            continue
        if "@" not in e or "." not in e.split("@")[-1]:
            continue
        if len(e) > 80 or "%" in e:
            continue
        local = e.split("@")[0]
        # Reject hex-hash tokens (32+ hex chars) and UUID-style strings
        if len(local) >= 28 and all(c in "0123456789abcdef" for c in local):
            continue
        if re.match(r'^[0-9a-f\-]{32,}$', local):
            continue
        cleaned.add(e)

    personal = [e for e in cleaned if not e.startswith(GENERIC_PREFIXES)]
    generic = [e for e in cleaned if e.startswith(GENERIC_PREFIXES)]
    return personal + generic


async def scrape_contact_info(website_url: str) -> dict:
    """Crawl business website for email addresses and social links."""
    if not website_url:
        return {"emails": [], "social_profiles": {}}

    if not website_url.startswith("http"):
        website_url = f"https://{website_url}"

    base = website_url.rstrip("/")
    urls_to_check = [base] + [base + p for p in CONTACT_PATHS]

    emails: set[str] = set()
    socials: dict[str, str] = {}

    timeout = aiohttp.ClientTimeout(total=10)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            for url in urls_to_check:
                try:
                    async with session.get(url, allow_redirects=True, ssl=False) as resp:
                        if resp.status >= 400:
                            continue
                        html = await resp.text(errors="replace")
                except Exception:
                    continue

                found = EMAIL_RE.findall(html)
                emails.update(found)

                for platform, pattern in SOCIAL_PATTERNS.items():
                    if platform not in socials:
                        match = re.search(pattern, html, re.IGNORECASE)
                        if match:
                            socials[platform] = match.group(0)
    except Exception as e:
        logger.warning("scrape_contact_failed", url=website_url, error=str(e))

    return {
        "emails": _clean_emails(emails),
        "social_profiles": socials,
    }


async def find_email_hunter(domain: str) -> dict:
    """Use Hunter.io domain-search to find emails for a domain."""
    api_key = settings.hunter_api_key
    if not api_key:
        return {"email": None, "all_emails": [], "owner_name": None, "owner_position": None, "confidence": None}

    url = f"https://api.hunter.io/v2/domain-search?domain={domain}&api_key={api_key}"
    try:
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as resp:
                data = await resp.json()
    except Exception as e:
        logger.warning("hunter_api_failed", domain=domain, error=str(e))
        return {"email": None, "all_emails": [], "owner_name": None, "owner_position": None, "confidence": None}

    results = data.get("data", {})
    email_list = results.get("emails", [])

    email_list.sort(key=lambda e: e.get("confidence", 0), reverse=True)

    owner_titles = ("owner", "founder", "ceo", "president", "director", "manager", "partner")
    owner_emails = [
        e for e in email_list
        if isinstance(e.get("position"), str) and any(t in e["position"].lower() for t in owner_titles)
    ]

    best = (owner_emails or email_list or [{}])[0]

    return {
        "email": best.get("value"),
        "first_name": best.get("first_name"),
        "last_name": best.get("last_name"),
        "owner_name": f"{best.get('first_name', '')} {best.get('last_name', '')}".strip() or None,
        "owner_position": best.get("position"),
        "confidence": best.get("confidence"),
        "all_emails": [e.get("value") for e in email_list[:5] if e.get("value")],
    }


async def enrich_lead(business) -> dict:
    """Run enrichment pipeline for a single business.

    1. Use email from Business record if already scraped.
    2. Scrape website contact pages (free).
    3. Fallback to Hunter.io if no email found.
    """
    result = {
        "emails": [],
        "best_email": None,
        "owner_name": None,
        "owner_position": None,
        "social_profiles": {},
        "source": None,
    }

    # If we already have an email from Google Maps scrape, include it
    if business.email:
        result["emails"].append(business.email)
        result["source"] = "google_maps"

    # Scrape website
    if business.website:
        web = await scrape_contact_info(business.website)
        for e in web["emails"]:
            if e not in result["emails"]:
                result["emails"].append(e)
        result["social_profiles"].update(web["social_profiles"])
        if not result["source"] and web["emails"]:
            result["source"] = "website_scrape"

    # Hunter.io fallback
    domain = _extract_domain(business.website)
    if domain and not result["emails"]:
        hunter = await find_email_hunter(domain)
        if hunter["email"]:
            result["emails"].append(hunter["email"])
            result["owner_name"] = hunter["owner_name"]
            result["owner_position"] = hunter["owner_position"]
            result["source"] = "hunter"
            if hunter.get("all_emails"):
                for e in hunter["all_emails"]:
                    if e not in result["emails"]:
                        result["emails"].append(e)

    result["best_email"] = result["emails"][0] if result["emails"] else None
    return result


ENRICHMENT_BATCH_SIZE = 25


async def run_enrichment(session, businesses: list, min_score: int = 40) -> dict:
    """Enrich a list of Business ORM objects. Saves to enrichment_data.

    Commits every ENRICHMENT_BATCH_SIZE leads so the DB connection doesn't go
    stale during long runs (Supabase PgBouncer drops idle connections after ~60s).

    Args:
        session: SQLAlchemy async session.
        businesses: list of Business ORM objects (should already be filtered by score).
        min_score: informational — the caller should pre-filter.

    Returns:
        Dict with counts.
    """
    from sqlalchemy import select

    counts = {"enriched": 0, "no_email": 0, "skipped": 0, "hunter_used": 0}
    pending = 0

    for biz in businesses:
        existing = (await session.execute(
            select(EnrichmentData).where(EnrichmentData.business_id == biz.id)
        )).scalar_one_or_none()
        if existing:
            counts["skipped"] += 1
            continue

        data = await enrich_lead(biz)

        record = EnrichmentData(
            business_id=biz.id,
            best_email=data["best_email"],
            all_emails=data["emails"] if data["emails"] else None,
            owner_name=data["owner_name"],
            owner_position=data["owner_position"],
            social_profiles=data["social_profiles"] if data["social_profiles"] else None,
            enrichment_source=data["source"],
            enriched_at=utcnow(),
        )
        session.add(record)
        pending += 1

        if data["source"] == "hunter":
            counts["hunter_used"] += 1

        if data["best_email"]:
            counts["enriched"] += 1
            logger.info("enriched", business=biz.name, email=data["best_email"][:30], source=data["source"])
        else:
            counts["no_email"] += 1
            logger.info("enriched_no_email", business=biz.name, socials=len(data["social_profiles"]))

        if pending >= ENRICHMENT_BATCH_SIZE:
            await session.commit()
            pending = 0

    if pending > 0:
        await session.commit()
    return counts
