"""Google Maps scraper using Playwright with anti-detection."""

import asyncio

import structlog

from src.scraper.anti_detection import create_stealth_browser, human_delay, smooth_scroll
from src.scraper.parsers import extract_detail_from_panel, extract_listings_from_panel, parse_address_components

logger = structlog.get_logger()

MAPS_URL = "https://www.google.com/maps"
RESULTS_FEED_SELECTOR = 'div[role="feed"]'


async def scrape_google_maps(
    query: str,
    location: str,
    max_results: int = 200,
    headless: bool = True,
) -> list[dict]:
    """Scrape Google Maps for businesses matching query + location.

    Args:
        query: Business type (e.g. "dentist")
        location: City/area (e.g. "Austin, TX")
        max_results: Maximum listings to extract
        headless: Run browser in headless mode

    Returns:
        List of business dicts with name, address, phone, website, etc.
    """
    search_term = f"{query} in {location}"
    logger.info("scrape_start", search_term=search_term, max_results=max_results)

    pw, browser, context, page = await create_stealth_browser(headless=headless)

    try:
        await page.goto(MAPS_URL, wait_until="domcontentloaded", timeout=30000)
        await human_delay(2.0, 4.0)

        # Handle consent / cookie dialogs (multiple button text variants)
        for btn_text in ["Accept all", "Accept All", "Reject all", "I agree", "Consent"]:
            try:
                consent_btn = page.locator(f'button:has-text("{btn_text}")').first
                if await consent_btn.is_visible(timeout=2000):
                    await consent_btn.click()
                    await human_delay(1.0, 2.0)
                    break
            except Exception:
                continue

        # Also try the Google consent form button
        try:
            form_btn = page.locator('form[action*="consent"] button').first
            if await form_btn.is_visible(timeout=2000):
                await form_btn.click()
                await human_delay(1.0, 2.0)
        except Exception:
            pass

        # Wait for search box with multiple selectors
        search_box = page.locator('#searchboxinput, input[name="q"], input[aria-label="Search Google Maps"]').first
        await search_box.wait_for(state="visible", timeout=15000)
        await search_box.click()
        await search_box.fill(search_term)
        await page.keyboard.press("Enter")

        # Wait for results feed to appear (not networkidle — Maps never stops fetching)
        await page.locator(RESULTS_FEED_SELECTOR).wait_for(state="attached", timeout=30000)
        await human_delay(2.0, 4.0)

        # Scroll results to load listings
        listings = []
        prev_count = 0
        stale_rounds = 0

        for scroll_round in range(50):
            await smooth_scroll(page, RESULTS_FEED_SELECTOR, scrolls=2)
            await human_delay(1.0, 2.5)

            current = await extract_listings_from_panel(page)
            listings = current

            logger.info("scroll_progress", round=scroll_round, listings=len(listings))

            if len(listings) >= max_results:
                break

            # Detect end of results
            end_marker = page.locator('span.HlvSq')
            try:
                if await end_marker.is_visible(timeout=1000):
                    logger.info("end_of_results_reached")
                    break
            except Exception:
                pass

            if len(listings) == prev_count:
                stale_rounds += 1
                if stale_rounds >= 5:
                    logger.info("no_new_results", total=len(listings))
                    break
            else:
                stale_rounds = 0
            prev_count = len(listings)

        listings = listings[:max_results]
        logger.info("listings_found", count=len(listings))

        # Click into each listing for full details
        detailed = []
        for i, listing in enumerate(listings):
            try:
                name = listing["name"]
                # Escape quotes in the name for the selector
                safe_name = name.replace('"', '\\"').replace("'", "\\'")

                # Try clicking the link by aria-label
                link = page.locator(f'a[aria-label="{safe_name}"]').first
                try:
                    await link.click(timeout=5000)
                except Exception:
                    # Fallback: click by href if available
                    if listing.get("href"):
                        await page.goto(listing["href"], wait_until="domcontentloaded", timeout=15000)
                    else:
                        logger.warning("listing_not_clickable", i=i, name=name)
                        continue

                # Wait for detail panel (h1 with business name)
                await page.locator("h1.DUwDvf, h1.fontHeadlineLarge").first.wait_for(
                    state="visible", timeout=10000
                )
                await human_delay(1.0, 2.0)

                detail = await extract_detail_from_panel(page)

                if detail.get("name"):
                    if not detail.get("place_id"):
                        detail["place_id"] = listing.get("place_id_from_href")
                    if not detail.get("place_id"):
                        import hashlib
                        from src.scraper.deduplication import normalize_name, normalize_phone
                        norm_name = normalize_name(detail["name"])
                        norm_phone = normalize_phone(detail.get("phone"))
                        fallback = f"{norm_name}|{norm_phone}"
                        detail["place_id"] = "gen:" + hashlib.md5(fallback.encode()).hexdigest()

                    addr_parts = parse_address_components(detail.get("address"))
                    detail.update(addr_parts)
                    detailed.append(detail)
                    logger.info("detail_extracted", i=i + 1, name=detail["name"], place_id=detail.get("place_id", "")[:30])

                # Navigate back to results
                back_btn = page.locator('button[aria-label="Back"], button[jsaction*="back"]').first
                try:
                    await back_btn.click(timeout=3000)
                except Exception:
                    await page.keyboard.press("Escape")
                await human_delay(0.8, 1.5)

            except Exception as e:
                logger.warning("detail_extraction_failed", i=i, error=str(e))
                try:
                    await page.keyboard.press("Escape")
                    await human_delay(0.5, 1.0)
                except Exception:
                    pass
                continue

        logger.info("scrape_complete", total_detailed=len(detailed))
        return detailed

    except Exception as e:
        logger.error("scrape_failed", error=str(e))
        raise
    finally:
        await browser.close()
        await pw.stop()


async def save_businesses(session, businesses: list[dict]) -> int:
    """Save scraped business dicts to the database, skipping duplicates.

    Uses two-layer dedup: place_id match AND name+phone/name+city fuzzy match.
    Returns number of new records inserted.
    """
    from src.models.business import Business
    from src.scraper.deduplication import (
        deduplicate_results,
        get_existing_name_keys,
        get_existing_place_ids,
    )

    from src.database import async_session as _session_factory

    place_ids = [b["place_id"] for b in businesses if b.get("place_id")]
    async with _session_factory() as dedup_session:
        existing_pids = await get_existing_place_ids(dedup_session, place_ids)
        existing_names = await get_existing_name_keys(dedup_session)
    unique = deduplicate_results(businesses, existing_pids, existing_names)

    count = 0
    for biz in unique:
        if not biz.get("place_id"):
            continue
        record = Business(
            place_id=biz["place_id"],
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
            hours=biz.get("hours"),
            maps_url=biz.get("maps_url"),
        )
        session.add(record)
        count += 1

    if count:
        await session.commit()
    logger.info("businesses_saved", new=count, skipped=len(businesses) - count)
    return count


async def backfill_emails(
    session,
    businesses: list,
    headless: bool = True,
) -> tuple[int, int]:
    """Re-visit each business's Maps URL and update email (and optionally other fields).

    Args:
        session: SQLAlchemy async session.
        businesses: List of Business ORM objects with id, maps_url, and optionally email.
        headless: Run browser headless.

    Returns:
        (updated_count, skipped_count) — updated_count is how many got an email set/updated.
    """
    from sqlalchemy import update

    from src.models.business import Business

    if not businesses:
        return 0, 0

    # Filter to those with a maps_url we can visit
    to_visit = [b for b in businesses if b.maps_url]
    if len(to_visit) < len(businesses):
        logger.info("backfill_emails_skip_no_url", skipped=len(businesses) - len(to_visit))

    pw, browser, context, page = await create_stealth_browser(headless=headless)
    updated = 0
    skipped = 0
    consent_done = False

    try:
        for i, biz in enumerate(to_visit):
            try:
                await page.goto(biz.maps_url, wait_until="domcontentloaded", timeout=20000)
                await human_delay(1.5, 3.0)

                if not consent_done:
                    for btn_text in ["Accept all", "Accept All", "Reject all", "I agree", "Consent"]:
                        try:
                            consent_btn = page.locator(f'button:has-text("{btn_text}")').first
                            if await consent_btn.is_visible(timeout=1500):
                                await consent_btn.click()
                                await human_delay(1.0, 2.0)
                                consent_done = True
                                break
                        except Exception:
                            continue
                    try:
                        form_btn = page.locator('form[action*="consent"] button').first
                        if await form_btn.is_visible(timeout=1000):
                            await form_btn.click()
                            await human_delay(1.0, 2.0)
                            consent_done = True
                    except Exception:
                        pass
                    consent_done = True

                await page.locator("h1.DUwDvf, h1.fontHeadlineLarge").first.wait_for(
                    state="visible", timeout=10000
                )
                await human_delay(0.8, 1.5)

                detail = await extract_detail_from_panel(page)
                new_email = detail.get("email") if detail else None

                if new_email:
                    await session.execute(
                        update(Business).where(Business.id == biz.id).values(email=new_email)
                    )
                    await session.commit()
                    updated += 1
                    logger.info("backfill_email_updated", id=biz.id, name=biz.name, email=new_email[:30])
                else:
                    skipped += 1
                    logger.info("backfill_email_none", id=biz.id, name=biz.name)

            except Exception as e:
                logger.warning("backfill_email_failed", id=biz.id, name=biz.name, error=str(e))
                skipped += 1
                try:
                    await session.rollback()
                except Exception:
                    pass

            await human_delay(2.0, 4.0)

    finally:
        await browser.close()
        await pw.stop()

    return updated, skipped
