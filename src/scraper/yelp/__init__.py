"""Yelp Fusion API scraper — surfaces established businesses with weak digital presence."""

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.business import Business
from src.scraper.deduplication import (
    deduplicate_results,
    get_existing_name_keys,
    get_existing_place_ids,
)
from src.scraper.yelp.api_client import search_yelp
from src.scraper.yelp.filters import apply_filters
from src.utils.time import utcnow

logger = structlog.get_logger()


async def scrape_yelp(
    niche: str,
    location: str,
    *,
    unclaimed_only: bool = True,
    max_reviews: int = 50,
    require_website: bool = False,
    limit: int = 50,
) -> list[dict]:
    """Scrape Yelp Fusion API for a single niche + location."""
    raw = await search_yelp(term=niche, location=location, limit=limit)
    filtered = apply_filters(
        raw,
        unclaimed_only=unclaimed_only,
        max_reviews=max_reviews,
        require_website=require_website,
    )
    logger.info(
        "yelp_scrape",
        niche=niche,
        location=location,
        raw=len(raw),
        filtered=len(filtered),
    )
    return filtered


async def scrape_yelp_batch(
    niche: str,
    zip_codes: list[str],
    *,
    unclaimed_only: bool = True,
    max_reviews: int = 50,
    require_website: bool = False,
) -> list[dict]:
    """Scrape across multiple zip codes to bypass the 1,000-result cap."""
    all_results: list[dict] = []
    seen_ids: set[str] = set()

    for zc in zip_codes:
        results = await search_yelp(term=niche, location=zc, limit=50)
        for r in results:
            pid = r.get("place_id", "")
            if pid not in seen_ids:
                seen_ids.add(pid)
                all_results.append(r)

    filtered = apply_filters(
        all_results,
        unclaimed_only=unclaimed_only,
        max_reviews=max_reviews,
        require_website=require_website,
    )
    logger.info(
        "yelp_batch",
        niche=niche,
        zips=len(zip_codes),
        raw=len(all_results),
        filtered=len(filtered),
    )
    return filtered


async def save_yelp_businesses(session: AsyncSession, businesses: list[dict]) -> int:
    """Deduplicate and save Yelp results to the businesses table."""
    if not businesses:
        return 0

    place_ids = [b["place_id"] for b in businesses if b.get("place_id")]
    existing_pids = await get_existing_place_ids(session, place_ids)
    existing_names = await get_existing_name_keys(session)
    unique = deduplicate_results(businesses, existing_pids, existing_names)

    for biz in unique:
        record = Business(
            place_id=biz["place_id"],
            source_channel="yelp",
            name=biz["name"],
            category=biz.get("category"),
            address=biz.get("address"),
            city=biz.get("city"),
            state=biz.get("state"),
            zip_code=biz.get("zip_code"),
            phone=biz.get("phone"),
            website=biz.get("website"),
            rating=biz.get("rating"),
            review_count=biz.get("review_count", 0),
            latitude=biz.get("latitude"),
            longitude=biz.get("longitude"),
            source_url=biz.get("source_url"),
            is_claimed=biz.get("is_claimed"),
            price_tier=biz.get("price_tier"),
            scraped_at=utcnow(),
        )
        session.add(record)

    await session.commit()
    logger.info("yelp_saved", new=len(unique), skipped=len(businesses) - len(unique))
    return len(unique)
