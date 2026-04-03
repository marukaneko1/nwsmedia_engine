"""Yelp Fusion API v3 client with rate-limit awareness."""

import asyncio

import aiohttp
import structlog

from src.config import settings

logger = structlog.get_logger()

YELP_API_BASE = "https://api.yelp.com/v3"
SEARCH_ENDPOINT = f"{YELP_API_BASE}/businesses/search"

CATEGORY_MAP = {
    "dentist": "dentists",
    "medspa": "medspas",
    "med spa": "medspas",
    "contractor": "contractors",
    "hvac": "hvac",
    "plumber": "plumbing",
    "roofing": "roofing",
    "chiropractor": "chiropractors",
    "electrician": "electricians",
    "landscaping": "landscaping",
    "auto repair": "autorepair",
    "hair salon": "hair",
    "barber": "barbers",
    "restaurant": "restaurants",
    "realtor": "realestate",
    "attorney": "lawyers",
    "veterinarian": "vet",
}


def _map_category(term: str) -> str | None:
    """Map a common niche name to a Yelp category alias."""
    return CATEGORY_MAP.get(term.lower().strip())


async def search_yelp(
    term: str,
    location: str,
    *,
    limit: int = 50,
    offset: int = 0,
    sort_by: str = "best_match",
    radius: int | None = None,
) -> list[dict]:
    """Call Yelp Fusion /v3/businesses/search and return normalized results.

    Handles pagination internally up to the 1,000 result API cap.
    """
    api_key = settings.yelp_api_key
    if not api_key:
        logger.error("yelp_api_key_missing")
        return []

    headers = {"Authorization": f"Bearer {api_key}"}
    params: dict = {
        "term": term,
        "location": location,
        "limit": min(limit, 50),
        "offset": offset,
        "sort_by": sort_by,
    }

    category_alias = _map_category(term)
    if category_alias:
        params["categories"] = category_alias

    if radius:
        params["radius"] = min(radius, 40000)

    results: list[dict] = []
    fetched = 0
    max_total = min(limit, 1000)

    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
        while fetched < max_total:
            params["offset"] = offset + fetched
            params["limit"] = min(50, max_total - fetched)

            try:
                async with session.get(SEARCH_ENDPOINT, params=params) as resp:
                    if resp.status == 429:
                        logger.warning("yelp_rate_limited", status=429)
                        await asyncio.sleep(2)
                        continue
                    if resp.status != 200:
                        body = await resp.text()
                        logger.warning("yelp_api_error", status=resp.status, body=body[:200])
                        break
                    data = await resp.json()
            except Exception as e:
                logger.error("yelp_request_failed", error=str(e))
                break

            businesses = data.get("businesses", [])
            if not businesses:
                break

            for biz in businesses:
                loc = biz.get("location", {})
                coords = biz.get("coordinates", {})
                cats = biz.get("categories", [])
                category_str = cats[0]["title"] if cats else None

                results.append({
                    "place_id": f"yelp:{biz['id']}",
                    "name": biz.get("name", ""),
                    "category": category_str,
                    "address": ", ".join(loc.get("display_address", [])),
                    "city": loc.get("city"),
                    "state": loc.get("state"),
                    "zip_code": loc.get("zip_code"),
                    "phone": biz.get("phone") or biz.get("display_phone"),
                    "website": None,
                    "rating": biz.get("rating"),
                    "review_count": biz.get("review_count", 0),
                    "latitude": coords.get("latitude"),
                    "longitude": coords.get("longitude"),
                    "source_url": biz.get("url"),
                    "is_claimed": biz.get("is_claimed"),
                    "price_tier": biz.get("price"),
                    "photos_count": len(biz.get("photos", [])),
                })

            fetched += len(businesses)
            total_available = data.get("total", 0)
            if fetched >= total_available:
                break

            await asyncio.sleep(0.25)

    logger.info("yelp_search", term=term, location=location, results=len(results))
    return results
