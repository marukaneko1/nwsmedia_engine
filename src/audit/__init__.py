"""Layer 3 — Website audit: PageSpeed, SSL, mobile, tech stack, freshness."""

import asyncio
import re
import socket
import ssl
from datetime import datetime
from urllib.parse import urlparse

import aiohttp
import structlog

from src.config import settings
from src.models.audit import WebsiteAudit

logger = structlog.get_logger()

PAGESPEED_API = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed"

TECH_SIGNATURES = {
    "wordpress": [r"/wp-content/", r"/wp-includes/", r'<meta name="generator" content="WordPress'],
    "wix": [r"wix\.com", r"_wix_browser_sess", r"X-Wix-"],
    "squarespace": [r"squarespace\.com", r"sqsp", r"<!-- This is Squarespace -->"],
    "shopify": [r"cdn\.shopify\.com", r"Shopify\.theme"],
    "godaddy_builder": [r"godaddy\.com", r"wsimg\.com"],
    "react": [r"__NEXT_DATA__", r"_reactRootContainer"],
    "webflow": [r"webflow\.com", r"wf-"],
}


async def run_pagespeed(url: str) -> dict:
    """Call Google PageSpeed Insights API."""
    params = {
        "url": url,
        "key": settings.google_pagespeed_api_key,
        "strategy": "mobile",
        "category": ["performance", "seo", "accessibility", "best-practices"],
    }
    try:
        timeout = aiohttp.ClientTimeout(total=60)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(PAGESPEED_API, params=params) as resp:
                if resp.status != 200:
                    logger.warning("pagespeed_error", status=resp.status)
                    return {}
                data = await resp.json()

        cats = data.get("lighthouseResult", {}).get("categories", {})
        audits = data.get("lighthouseResult", {}).get("audits", {})

        def metric_val(audit_id: str) -> float | None:
            a = audits.get(audit_id, {})
            return a.get("numericValue")

        perf = cats.get("performance", {}).get("score")
        seo = cats.get("seo", {}).get("score")
        a11y = cats.get("accessibility", {}).get("score")
        bp = cats.get("best-practices", {}).get("score")

        return {
            "performance_score": int(perf * 100) if perf is not None else None,
            "seo_score": int(seo * 100) if seo is not None else None,
            "accessibility_score": int(a11y * 100) if a11y is not None else None,
            "best_practices_score": int(bp * 100) if bp is not None else None,
            "lcp_seconds": round(metric_val("largest-contentful-paint") / 1000, 2) if metric_val("largest-contentful-paint") else None,
            "fid_ms": round(metric_val("max-potential-fid"), 2) if metric_val("max-potential-fid") else None,
            "cls_score": round(metric_val("cumulative-layout-shift"), 3) if metric_val("cumulative-layout-shift") is not None else None,
            "fcp_seconds": round(metric_val("first-contentful-paint") / 1000, 2) if metric_val("first-contentful-paint") else None,
            "speed_index_seconds": round(metric_val("speed-index") / 1000, 2) if metric_val("speed-index") else None,
            "total_blocking_ms": round(metric_val("total-blocking-time"), 2) if metric_val("total-blocking-time") else None,
        }
    except Exception as e:
        logger.warning("pagespeed_failed", url=url, error=str(e))
        return {}


def check_ssl(domain: str) -> dict:
    """Check SSL certificate validity and expiry."""
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=5) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                expires = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
                return {"has_ssl": True, "ssl_valid": True, "ssl_expires": expires}
    except ssl.SSLCertVerificationError:
        return {"has_ssl": True, "ssl_valid": False, "ssl_expires": None}
    except Exception:
        return {"has_ssl": False, "ssl_valid": False, "ssl_expires": None}


async def detect_tech_stack(url: str) -> dict:
    """Detect technologies from HTML and headers."""
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, allow_redirects=True, ssl=False) as resp:
                html = await resp.text(errors="replace")
                headers = dict(resp.headers)
    except Exception:
        return {"technologies": [], "is_page_builder": False, "is_wordpress": False}

    detected = []
    for tech, patterns in TECH_SIGNATURES.items():
        for pattern in patterns:
            if re.search(pattern, html, re.IGNORECASE) or \
               any(re.search(pattern, str(v), re.IGNORECASE) for v in headers.values()):
                detected.append(tech)
                break

    if not detected:
        detected.append("custom_html")

    return {
        "technologies": detected,
        "is_page_builder": any(t in detected for t in ["wix", "squarespace", "godaddy_builder", "webflow"]),
        "is_wordpress": "wordpress" in detected,
    }


async def check_content_freshness(url: str) -> dict:
    """Check copyright year and Last-Modified header."""
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, allow_redirects=True, ssl=False) as resp:
                html = await resp.text(errors="replace")
    except Exception:
        return {"copyright_year": None, "is_outdated": None}

    years = re.findall(r"©\s*(\d{4})|copyright\s*(\d{4})", html, re.IGNORECASE)
    latest = max([int(y) for group in years for y in group if y], default=None)

    return {
        "copyright_year": latest,
        "is_outdated": latest is not None and latest < (datetime.now().year - 1),
    }


async def full_audit(url: str) -> dict:
    """Run all audit checks in parallel."""
    if not url.startswith("http"):
        url = f"https://{url}"

    domain = urlparse(url).hostname

    pagespeed, ssl_result, tech, freshness = await asyncio.gather(
        run_pagespeed(url),
        asyncio.to_thread(check_ssl, domain),
        detect_tech_stack(url),
        check_content_freshness(url),
    )

    return {
        "url": url,
        "pagespeed": pagespeed,
        "ssl": ssl_result,
        "tech": tech,
        "freshness": freshness,
    }


async def run_audits(session, businesses_with_triage: list[tuple]) -> int:
    """Audit businesses that have HAS_WEBSITE triage status.

    Args:
        session: SQLAlchemy async session.
        businesses_with_triage: list of (Business, TriageResult) tuples.

    Returns:
        Number of audits completed.
    """
    from sqlalchemy import select

    count = 0
    for biz, triage in businesses_with_triage:
        if triage.status != "HAS_WEBSITE":
            continue

        existing = (await session.execute(
            select(WebsiteAudit).where(WebsiteAudit.business_id == biz.id)
        )).scalar_one_or_none()
        if existing:
            continue

        url = triage.redirect_url or biz.website
        if not url:
            continue

        logger.info("auditing", business=biz.name, url=url[:60])
        result = await full_audit(url)

        ps = result.get("pagespeed", {})
        ssl_r = result.get("ssl", {})
        tech = result.get("tech", {})
        fresh = result.get("freshness", {})

        record = WebsiteAudit(
            business_id=biz.id,
            url_audited=url,
            performance_score=ps.get("performance_score"),
            seo_score=ps.get("seo_score"),
            accessibility_score=ps.get("accessibility_score"),
            best_practices_score=ps.get("best_practices_score"),
            lcp_seconds=ps.get("lcp_seconds"),
            fid_ms=ps.get("fid_ms"),
            cls_score=ps.get("cls_score"),
            fcp_seconds=ps.get("fcp_seconds"),
            speed_index_seconds=ps.get("speed_index_seconds"),
            total_blocking_ms=ps.get("total_blocking_ms"),
            has_ssl=ssl_r.get("has_ssl"),
            ssl_valid=ssl_r.get("ssl_valid"),
            ssl_expires=ssl_r.get("ssl_expires"),
            is_mobile_friendly=not bool(tech.get("is_page_builder")),
            has_viewport_meta=None,
            has_horizontal_scroll=None,
            small_tap_targets=None,
            technologies=tech.get("technologies"),
            is_page_builder=tech.get("is_page_builder"),
            is_wordpress=tech.get("is_wordpress"),
            copyright_year=fresh.get("copyright_year"),
            is_outdated=fresh.get("is_outdated"),
            audited_at=datetime.utcnow(),
        )
        session.add(record)
        await session.commit()
        count += 1
        logger.info("audit_done", business=biz.name, perf=ps.get("performance_score"))

    return count
