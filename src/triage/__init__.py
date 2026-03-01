"""Layer 2 — Website triage: classify businesses by website status."""

import re
from datetime import datetime

import aiohttp
import structlog

from src.models.triage import TriageResult

logger = structlog.get_logger()

FREE_SUBDOMAIN_PATTERNS = [
    r"\.wixsite\.com",
    r"\.squarespace\.com",
    r"\.godaddysites\.com",
    r"\.weebly\.com",
    r"\.wordpress\.com",
    r"\.blogspot\.com",
    r"\.carrd\.co",
    r"\.webflow\.io",
    r"\.my\.canva\.site",
    r"\.business\.site",
    r"\.square\.site",
    r"\.wix\.com/site",
    r"\.jimdosite\.com",
    r"\.site123\.me",
    r"\.strikingly\.com",
    r"\.durable\.co",
]

PAGE_BUILDER_DOMAINS = [
    "wix.com", "squarespace.com", "godaddy.com", "weebly.com",
    "jimdo.com", "site123.com", "durable.co", "strikingly.com",
]


def is_free_subdomain(url: str) -> bool:
    return any(re.search(p, url, re.IGNORECASE) for p in FREE_SUBDOMAIN_PATTERNS)


async def check_url(url: str) -> tuple[bool, int, str]:
    """Check if a URL is reachable. Returns (is_reachable, status_code, final_url)."""
    if not url:
        return False, 0, ""
    if not url.startswith("http"):
        url = f"https://{url}"
    try:
        timeout = aiohttp.ClientTimeout(total=12)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, allow_redirects=True, ssl=False) as resp:
                return True, resp.status, str(resp.url)
    except Exception:
        # Retry with http:// if https:// failed
        if url.startswith("https://"):
            try:
                http_url = url.replace("https://", "http://", 1)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(http_url, allow_redirects=True, ssl=False) as resp:
                        return True, resp.status, str(resp.url)
            except Exception:
                pass
        return False, 0, url


async def triage_business(website: str | None) -> dict:
    """Classify a business's website status.

    Returns dict with keys: status, http_status, redirect_url, is_free_subdomain.
    """
    if not website or website.strip() == "":
        return {
            "status": "NO_WEBSITE",
            "http_status": None,
            "redirect_url": None,
            "is_free_subdomain": False,
        }

    is_reachable, status_code, final_url = await check_url(website)

    if not is_reachable or status_code >= 400:
        return {
            "status": "DEAD_WEBSITE",
            "http_status": status_code,
            "redirect_url": final_url,
            "is_free_subdomain": False,
        }

    if is_free_subdomain(final_url):
        return {
            "status": "FREE_SUBDOMAIN",
            "http_status": status_code,
            "redirect_url": final_url,
            "is_free_subdomain": True,
        }

    if any(builder in final_url.lower() for builder in PAGE_BUILDER_DOMAINS):
        return {
            "status": "PAGE_BUILDER",
            "http_status": status_code,
            "redirect_url": final_url,
            "is_free_subdomain": False,
        }

    return {
        "status": "HAS_WEBSITE",
        "http_status": status_code,
        "redirect_url": final_url,
        "is_free_subdomain": False,
    }


async def run_triage(session, businesses: list) -> dict:
    """Triage a list of Business ORM objects. Returns counts by status."""
    from sqlalchemy import select
    from src.models.triage import TriageResult

    counts = {"NO_WEBSITE": 0, "DEAD_WEBSITE": 0, "FREE_SUBDOMAIN": 0, "PAGE_BUILDER": 0, "HAS_WEBSITE": 0, "skipped": 0}

    for biz in businesses:
        existing = (await session.execute(
            select(TriageResult).where(TriageResult.business_id == biz.id)
        )).scalar_one_or_none()
        if existing:
            counts["skipped"] += 1
            continue

        result = await triage_business(biz.website)
        record = TriageResult(
            business_id=biz.id,
            status=result["status"],
            http_status=result["http_status"],
            redirect_url=result["redirect_url"],
            is_free_subdomain=result["is_free_subdomain"],
            triaged_at=datetime.utcnow(),
        )
        session.add(record)
        await session.commit()

        counts[result["status"]] += 1
        logger.info("triaged", business=biz.name, status=result["status"])

    return counts
