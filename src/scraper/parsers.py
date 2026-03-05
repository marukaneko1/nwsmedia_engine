"""Parse business data from Google Maps listing elements."""

import re

from playwright.async_api import Page


async def extract_listings_from_panel(page: Page) -> list[dict]:
    """Extract basic listing info from the visible Maps results panel."""
    results = await page.evaluate(r"""
        () => {
            const items = document.querySelectorAll('div[role="feed"] > div > div > a');
            return Array.from(items).map(a => {
                const ariaLabel = a.getAttribute('aria-label') || '';
                const href = a.getAttribute('href') || '';

                // Try to extract place_id from the listing href
                let placeId = null;
                const ftidMatch = href.match(/ftid=([^&]+)/);
                if (ftidMatch) placeId = decodeURIComponent(ftidMatch[1]);
                if (!placeId) {
                    const s1Match = href.match(/!1s([^!]+)/);
                    if (s1Match) placeId = decodeURIComponent(s1Match[1]);
                }
                if (!placeId) {
                    const cidMatch = href.match(/[?&]cid=([^&]+)/);
                    if (cidMatch) placeId = 'cid:' + cidMatch[1];
                }
                if (!placeId) {
                    const placeMatch = href.match(/place\/[^/]+\/([^/]+)/);
                    if (placeMatch) placeId = decodeURIComponent(placeMatch[1]);
                }

                return { name: ariaLabel, href: href, place_id_from_href: placeId };
            }).filter(item => item.name && item.href);
        }
    """)
    return results


async def extract_detail_from_panel(page: Page) -> dict:
    """Extract full details from an opened Maps listing panel."""
    data = await page.evaluate(r"""
        () => {
            const result = {};

            // Name
            const nameEl = document.querySelector('h1.DUwDvf');
            result.name = nameEl ? nameEl.textContent.trim() : null;

            // Category
            const catEl = document.querySelector('button[jsaction*="category"]');
            result.category = catEl ? catEl.textContent.trim() : null;

            // Address
            const addrEl = document.querySelector('[data-item-id="address"] .Io6YTe');
            result.address = addrEl ? addrEl.textContent.trim() : null;

            // Phone
            const phoneEl = document.querySelector('[data-item-id*="phone"] .Io6YTe');
            result.phone = phoneEl ? phoneEl.textContent.trim() : null;

            // Website
            const siteEl = document.querySelector('[data-item-id="authority"] .Io6YTe');
            result.website = siteEl ? siteEl.textContent.trim() : null;

            // Email — Maps sometimes shows it in contact section or mailto link
            let email = null;
            const emailItem = document.querySelector('[data-item-id="email"] .Io6YTe');
            if (emailItem) email = emailItem.textContent.trim();
            if (!email) {
                const mailto = document.querySelector('a[href^="mailto:"]');
                if (mailto) {
                    const href = mailto.getAttribute('href') || '';
                    const m = href.replace(/^mailto:/i, '').split(/[?&]/)[0].trim();
                    if (m && m.includes('@')) email = m;
                }
            }
            if (!email) {
                const text = document.body ? document.body.innerText : '';
                const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (match) email = match[0];
            }
            result.email = email;

            // Rating
            const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
            result.rating = ratingEl ? parseFloat(ratingEl.textContent) : null;

            // Review count
            const reviewEl = document.querySelector('div.F7nice span[aria-label*="review"]');
            if (reviewEl) {
                const match = reviewEl.getAttribute('aria-label').match(/([\d,]+)/);
                result.review_count = match ? parseInt(match[1].replace(',', '')) : 0;
            } else {
                result.review_count = 0;
            }

            // Hours (simplified)
            result.hours = null;

            // Place ID from URL — try multiple patterns
            const url = window.location.href;
            let placeId = null;

            // Pattern 1: ftid parameter
            const ftidMatch = url.match(/ftid=([^&!]+)/);
            if (ftidMatch) placeId = decodeURIComponent(ftidMatch[1]);

            // Pattern 2: !1s prefix (most common in Maps URLs)
            if (!placeId) {
                const s1Match = url.match(/!1s(0x[^!]+)/);
                if (s1Match) placeId = decodeURIComponent(s1Match[1]);
            }

            // Pattern 3: ChIJ-style place IDs
            if (!placeId) {
                const chijMatch = url.match(/!1s(ChIJ[^!]+)/);
                if (chijMatch) placeId = decodeURIComponent(chijMatch[1]);
            }

            // Pattern 4: cid parameter
            if (!placeId) {
                const cidMatch = url.match(/[?&]cid=(\d+)/);
                if (cidMatch) placeId = 'cid:' + cidMatch[1];
            }

            // Pattern 5: /place/ path segment
            if (!placeId) {
                const placePathMatch = url.match(/\/place\/[^/]+\/@[^/]+\/data=.*!1s([^!]+)/);
                if (placePathMatch) placeId = decodeURIComponent(placePathMatch[1]);
            }

            result.place_id = placeId;

            // Maps URL
            result.maps_url = url;

            // Coordinates from URL
            const coordMatch = url.match(/@(-?[\d.]+),(-?[\d.]+)/);
            if (coordMatch) {
                result.latitude = parseFloat(coordMatch[1]);
                result.longitude = parseFloat(coordMatch[2]);
            }

            return result;
        }
    """)

    return data


def parse_address_components(full_address: str | None) -> dict:
    """Split a full address string into city, state, zip."""
    if not full_address:
        return {"city": None, "state": None, "zip_code": None}

    match = re.search(r",\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?", full_address)
    if match:
        return {
            "city": match.group(1).strip(),
            "state": match.group(2).strip(),
            "zip_code": match.group(3).strip() if match.group(3) else None,
        }
    return {"city": None, "state": None, "zip_code": None}
