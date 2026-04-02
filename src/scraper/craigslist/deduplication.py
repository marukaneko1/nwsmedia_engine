"""Craigslist-specific deduplication logic.

Dedup layers:
1. CL post ID — exact match on place_id = "cl:{post_id}"
2. Cross-source name+phone / name+city — reuses normalizers from the Maps scraper
"""

from src.scraper.deduplication import (
    deduplicate_results,
    get_existing_name_keys,
    get_existing_place_ids,
    normalize_name,
    normalize_phone,
)

__all__ = [
    "deduplicate_cl_results",
    "dedup_within_batch",
]


async def deduplicate_cl_results(
    session,
    results: list[dict],
) -> list[dict]:
    """Remove CL results that already exist in the database.

    Uses two layers:
    1. place_id match (cl:{post_id})
    2. Fuzzy name+phone / name+city match (catches cross-source dupes)
    """
    place_ids = [r["place_id"] for r in results if r.get("place_id")]
    existing_pids = await get_existing_place_ids(session, place_ids)
    existing_names = await get_existing_name_keys(session)
    return deduplicate_results(results, existing_pids, existing_names)


def dedup_within_batch(results: list[dict]) -> list[dict]:
    """Remove duplicates within a single CL scrape batch.

    CL posters commonly re-post the same ad daily. Deduplicate by:
    1. Post ID (exact)
    2. Phone number (same poster, different post)
    3. Normalized title (same ad, re-posted)
    """
    seen_ids: set[str] = set()
    seen_phones: set[str] = set()
    seen_titles: set[str] = set()
    unique: list[dict] = []

    for r in results:
        post_id = r.get("post_id", "")
        if post_id and post_id in seen_ids:
            continue

        phone = normalize_phone(r.get("phone"))
        if phone and phone in seen_phones:
            continue

        norm_title = normalize_name(r.get("name", ""))
        if norm_title and norm_title in seen_titles:
            continue

        if post_id:
            seen_ids.add(post_id)
        if phone:
            seen_phones.add(phone)
        if norm_title:
            seen_titles.add(norm_title)
        unique.append(r)

    return unique
