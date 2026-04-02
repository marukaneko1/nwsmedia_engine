"""Craigslist services scraper using Playwright with anti-detection."""

import asyncio
import hashlib

import structlog

from src.config import settings
from src.scraper.anti_detection import create_stealth_browser, human_delay
from src.scraper.craigslist.deduplication import dedup_within_batch
from src.scraper.craigslist.parsers import extract_detail_from_listing, extract_listings_from_search
from src.scraper.craigslist.urls import build_search_url, get_subdomain
from src.scraper.deduplication import normalize_name, normalize_phone

logger = structlog.get_logger()


async def scrape_craigslist(
    city: str,
    category: str = "bbb",
    keyword: str | None = None,
    max_pages: int = 3,
    headless: bool = True,
) -> list[dict]:
    """Scrape Craigslist services listings for a city.

    Args:
        city: Full city name (e.g. "Austin, TX") — must be in CL_CITY_MAP.
        category: CL category code (default "bbb" = all services).
        keyword: Optional search keyword filter.
        max_pages: Maximum pagination pages to scrape.
        headless: Run browser in headless mode.

    Returns:
        List of business dicts ready for database insertion.
    """
    subdomain = get_subdomain(city)
    if not subdomain:
        logger.error("cl_city_not_mapped", city=city)
        return []

    state = city.split(",")[-1].strip() if "," in city else ""
    city_name = city.split(",")[0].strip() if "," in city else city

    logger.info(
        "cl_scrape_start",
        city=city,
        subdomain=subdomain,
        category=category,
        keyword=keyword,
        max_pages=max_pages,
    )

    pw, browser, context, page = await create_stealth_browser(headless=headless)
    all_listings: list[dict] = []
    request_count = 0

    try:
        for page_num in range(max_pages):
            offset = page_num * 120
            url = build_search_url(subdomain, category, keyword, offset)

            logger.info("cl_loading_page", page=page_num + 1, url=url)
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await human_delay(
                settings.craigslist_page_delay_min,
                settings.craigslist_page_delay_max,
            )
            request_count += 1

            if await _is_blocked(page):
                logger.warning("cl_blocked", page=page_num + 1)
                await human_delay(60, 120)
                break

            listings = await extract_listings_from_search(page)
            logger.info("cl_page_results", page=page_num + 1, count=len(listings))

            if not listings:
                logger.info("cl_no_more_results", page=page_num + 1)
                break

            all_listings.extend(listings)

            if await _should_rotate_session(request_count):
                logger.info("cl_rotating_session", requests=request_count)
                await browser.close()
                pw_new, browser, context, page = await create_stealth_browser(headless=headless)
                await pw.stop()
                pw = pw_new
                request_count = 0

        all_listings = _deduplicate_index(all_listings)
        logger.info("cl_index_complete", total_listings=len(all_listings))

        detailed: list[dict] = []
        for i, listing in enumerate(all_listings):
            try:
                logger.info(
                    "cl_detail_fetch",
                    i=i + 1,
                    total=len(all_listings),
                    title=listing["title"][:50],
                )
                await page.goto(
                    listing["url"],
                    wait_until="domcontentloaded",
                    timeout=20000,
                )
                await human_delay(
                    settings.craigslist_delay_min,
                    settings.craigslist_delay_max,
                )
                request_count += 1

                if await _is_blocked(page):
                    logger.warning("cl_blocked_detail", i=i + 1)
                    await human_delay(60, 120)
                    continue

                detail = await extract_detail_from_listing(page)

                business = _build_business_dict(
                    listing=listing,
                    detail=detail,
                    city_name=city_name,
                    state=state,
                    category=category,
                    keyword=keyword,
                )
                if business.get("name"):
                    detailed.append(business)

                if await _should_rotate_session(request_count):
                    logger.info("cl_rotating_session", requests=request_count)
                    await browser.close()
                    pw_new, browser, context, page = await create_stealth_browser(headless=headless)
                    await pw.stop()
                    pw = pw_new
                    request_count = 0

            except Exception as e:
                logger.warning("cl_detail_failed", i=i + 1, error=str(e))
                continue

        detailed = dedup_within_batch(detailed)
        logger.info("cl_scrape_complete", total=len(detailed))
        return detailed

    except Exception as e:
        logger.error("cl_scrape_failed", error=str(e))
        raise
    finally:
        await browser.close()
        await pw.stop()


def _build_business_dict(
    listing: dict,
    detail: dict,
    city_name: str,
    state: str,
    category: str,
    keyword: str | None,
) -> dict:
    """Combine index listing and detail page data into a business dict."""
    post_id = detail.get("post_id") or listing.get("post_id", "")
    place_id = f"cl:{post_id}" if post_id else None

    if not place_id:
        norm = normalize_name(detail.get("business_name", ""))
        phone = normalize_phone(detail.get("phone"))
        fallback = f"{norm}|{phone}"
        place_id = "cl:gen:" + hashlib.md5(fallback.encode()).hexdigest()

    service_label = keyword or category
    area = detail.get("area") or listing.get("area", "")

    return {
        "place_id": place_id,
        "source_channel": "craigslist",
        "name": detail.get("business_name") or listing.get("title", "Unknown"),
        "category": service_label,
        "address": area,
        "city": city_name,
        "state": state,
        "zip_code": None,
        "phone": detail.get("phone"),
        "email": detail.get("email"),
        "website": detail.get("website"),
        "rating": None,
        "review_count": 0,
        "latitude": detail.get("latitude"),
        "longitude": detail.get("longitude"),
        "maps_url": listing.get("url"),
        "source_url": listing.get("url"),
        "listing_description": (detail.get("description") or "")[:5000],
        "post_id": post_id,
    }


def _deduplicate_index(listings: list[dict]) -> list[dict]:
    """Remove duplicate listings from index pages by post_id."""
    seen: set[str] = set()
    unique: list[dict] = []
    for item in listings:
        pid = item.get("post_id", "")
        if pid in seen:
            continue
        seen.add(pid)
        unique.append(item)
    return unique


async def _is_blocked(page) -> bool:
    """Check if CL is showing a CAPTCHA or block page."""
    try:
        blocked = await page.evaluate(r"""
            () => {
                const text = document.body ? document.body.innerText : '';
                if (text.includes('blocked') && text.includes('IP')) return true;
                if (document.querySelector('#recaptcha, .g-recaptcha, iframe[src*="recaptcha"]'))
                    return true;
                if (text.includes('please complete the CAPTCHA')) return true;
                return false;
            }
        """)
        return blocked
    except Exception:
        return False


async def _should_rotate_session(request_count: int) -> bool:
    """Whether to rotate the browser session based on request count."""
    return request_count >= settings.craigslist_session_rotate_every


async def save_cl_businesses(session, businesses: list[dict]) -> int:
    """Save scraped CL business dicts to the database, skipping duplicates.

    Returns number of new records inserted.
    """
    from src.database import async_session as _session_factory
    from src.models.business import Business
    from src.scraper.craigslist.deduplication import deduplicate_cl_results

    async with _session_factory() as dedup_session:
        unique = await deduplicate_cl_results(dedup_session, businesses)

    count = 0
    for biz in unique:
        if not biz.get("place_id"):
            continue
        record = Business(
            place_id=biz["place_id"],
            source_channel="craigslist",
            name=biz["name"],
            category=biz.get("category"),
            address=biz.get("address"),
            city=biz.get("city"),
            state=biz.get("state"),
            zip_code=biz.get("zip_code"),
            phone=biz.get("phone"),
            email=biz.get("email"),
            website=biz.get("website"),
            rating=biz.get("rating"),
            review_count=biz.get("review_count", 0),
            latitude=biz.get("latitude"),
            longitude=biz.get("longitude"),
            maps_url=biz.get("source_url"),
            source_url=biz.get("source_url"),
            listing_description=biz.get("listing_description"),
        )
        session.add(record)
        count += 1

    if count:
        await session.commit()
    logger.info("cl_businesses_saved", new=count, skipped=len(businesses) - count)
    return count
