"""Parse Craigslist search results and listing detail pages."""

import re

from playwright.async_api import Page


async def extract_listings_from_search(page: Page) -> list[dict]:
    """Extract listing summaries from a CL search results page.

    Returns list of dicts with keys: title, url, post_id, area.
    """
    results = await page.evaluate(r"""
        () => {
            const items = [];

            // Modern CL: <li> elements inside the search results list
            const listItems = document.querySelectorAll(
                'li.cl-static-search-result, li.cl-search-result, ol.cl-static-search-results > li'
            );

            for (const li of listItems) {
                const link = li.querySelector('a');
                if (!link) continue;

                const href = link.getAttribute('href') || '';
                const fullUrl = href.startsWith('http') ? href : window.location.origin + href;

                // Extract title text (strip price and area)
                const titleEl = li.querySelector('.title, .titlestring, a .label');
                let title = titleEl ? titleEl.textContent.trim() : link.textContent.trim();

                // Extract area/neighborhood
                const areaEl = li.querySelector('.meta .nearby, .meta .surloc, .meta .location');
                const area = areaEl ? areaEl.textContent.trim() : '';

                // Extract post ID from URL
                const idMatch = href.match(/\/(\d{8,12})\.html/);
                const postId = idMatch ? idMatch[1] : null;

                if (title && fullUrl.includes('.html') && postId) {
                    items.push({ title, url: fullUrl, post_id: postId, area });
                }
            }

            // Fallback: grab all result links if the above found nothing
            if (items.length === 0) {
                const allLinks = document.querySelectorAll('a[href*=".html"]');
                for (const a of allLinks) {
                    const href = a.getAttribute('href') || '';
                    // Must be a listing link (contains a long numeric ID)
                    const idMatch = href.match(/\/(\d{8,12})\.html/);
                    if (!idMatch) continue;
                    // Skip navigation/header links
                    if (href.includes('/search/') || href.includes('/about/')) continue;

                    const fullUrl = href.startsWith('http') ? href : window.location.origin + href;
                    const title = a.textContent.trim();
                    if (!title) continue;

                    items.push({
                        title,
                        url: fullUrl,
                        post_id: idMatch[1],
                        area: '',
                    });
                }
            }

            // Deduplicate by post_id within this page
            const seen = new Set();
            return items.filter(item => {
                if (seen.has(item.post_id)) return false;
                seen.add(item.post_id);
                return true;
            });
        }
    """)
    return results


async def extract_detail_from_listing(page: Page) -> dict:
    """Extract contact info and details from a CL listing detail page.

    Returns dict with keys: title, description, phone, email, website,
    post_id, area, latitude, longitude, images_count, posted_date.
    """
    data = await page.evaluate(r"""
        () => {
            const result = {};

            // Title
            const titleEl = document.querySelector(
                '#titletextonly, span.postingtitletext, .posting-title h1'
            );
            result.title = titleEl ? titleEl.textContent.trim() : '';

            // Full title with area (for name extraction)
            const fullTitleEl = document.querySelector(
                'span.postingtitletext, h1.postingtitle, .posting-title'
            );
            result.full_title = fullTitleEl ? fullTitleEl.textContent.trim() : result.title;

            // Description body
            const bodyEl = document.querySelector('#postingbody');
            if (bodyEl) {
                // Remove the "QR Code Link" notice that CL injects
                const clone = bodyEl.cloneNode(true);
                const notices = clone.querySelectorAll('.print-information, .print-qrcode-label');
                notices.forEach(n => n.remove());
                result.description = clone.textContent.trim();
            } else {
                result.description = '';
            }

            // Post ID from the page
            const postIdEl = document.querySelector('.postinginfos .postinginfo');
            if (postIdEl) {
                const idMatch = postIdEl.textContent.match(/post id:\s*(\d+)/i);
                result.post_id = idMatch ? idMatch[1] : null;
            }
            if (!result.post_id) {
                const urlMatch = window.location.href.match(/\/(\d{8,12})\.html/);
                result.post_id = urlMatch ? urlMatch[1] : null;
            }

            // Posted date
            const timeEl = document.querySelector('time.date.timeago, time.posting-info-date');
            result.posted_date = timeEl ? timeEl.getAttribute('datetime') : null;

            // Map coordinates
            const mapEl = document.querySelector('#map');
            if (mapEl) {
                result.latitude = parseFloat(mapEl.getAttribute('data-latitude')) || null;
                result.longitude = parseFloat(mapEl.getAttribute('data-longitude')) || null;
            } else {
                result.latitude = null;
                result.longitude = null;
            }

            // Image count
            const thumbs = document.querySelectorAll('#thumbs a, .swipe .slide');
            result.images_count = thumbs.length;

            // Area from breadcrumb / title
            const areaEl = document.querySelector(
                '.postingtitletext small, .attrgroup span.area'
            );
            result.area = areaEl ? areaEl.textContent.replace(/[()]/g, '').trim() : '';

            return result;
        }
    """)

    combined_text = f"{data.get('title', '')} {data.get('description', '')}"
    data["phone"] = extract_phone(combined_text)
    data["email"] = extract_email(combined_text)
    data["website"] = extract_website(combined_text)
    data["business_name"] = extract_business_name(
        data.get("title", ""), data.get("description", "")
    )

    return data


def extract_phone(text: str) -> str | None:
    """Extract the first US phone number from text."""
    patterns = [
        r"\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}",
        r"\d{3}[\s.\-]\d{3}[\s.\-]\d{4}",
        r"\d{10}",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            digits = re.sub(r"\D", "", match.group())
            if len(digits) >= 10:
                return digits[-10:]
    return None


def extract_email(text: str) -> str | None:
    """Extract a real email from text, ignoring CL relay addresses."""
    matches = re.findall(
        r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text
    )
    for email in matches:
        lower = email.lower()
        if "craigslist" in lower or "reply" in lower:
            continue
        return email
    return None


def extract_website(text: str) -> str | None:
    """Extract a website URL from text."""
    pattern = r"(?:https?://)?(?:www\.)?([a-zA-Z0-9\-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)"
    for match in re.finditer(pattern, text):
        domain = match.group(1).lower()
        skip = (
            "craigslist.org", "google.com", "facebook.com", "instagram.com",
            "youtube.com", "yelp.com", "angieslist.com", "angi.com",
            "nextdoor.com", "twitter.com", "x.com", "tiktok.com",
            "bbb.org", "imgur.com", "gmail.com", "yahoo.com", "hotmail.com",
            "outlook.com", "aol.com", "icloud.com", "protonmail.com",
            "linkedin.com", "pinterest.com", "thumbtack.com", "homeadvisor.com",
        )
        if any(domain.endswith(s) for s in skip):
            continue
        if "." in domain and len(domain) > 4:
            full_match = match.group(0)
            if not full_match.startswith("http"):
                full_match = "https://" + full_match
            return full_match
    return None


def extract_business_name(title: str, description: str) -> str:
    """Heuristically extract a business name from the listing.

    Strategy:
    1. Look for LLC/Inc/Co patterns in description
    2. Look for possessive names ("Mario's Handyman")
    3. Strip common suffixes from the title and use as name
    """
    combined = f"{title} {description}"

    llc_match = re.search(
        r"([A-Z][A-Za-z'\s&]+(?:LLC|Inc|Co\.|Corp|Services|Service|Company))\b",
        combined,
    )
    if llc_match:
        name = llc_match.group(1).strip()
        if 3 < len(name) < 80:
            return name

    possessive_match = re.search(
        r"([A-Z][a-z]+(?:'s|s')\s+[A-Za-z\s&]+(?:Service|Landscaping|Painting|Plumbing|Repair|Cleaning|Removal|Tree|Lawn|Care|Handyman|Construction)s?)\b",
        combined,
    )
    if possessive_match:
        name = possessive_match.group(1).strip()
        if 3 < len(name) < 80:
            return name

    cleaned = re.sub(r"[^\w\s&'\-.,]", "", title)
    cleaned = re.sub(r"\$\d+", "", cleaned)
    cleaned = re.sub(r"\d{3}[\s.\-]?\d{3}[\s.\-]?\d{4}", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    if len(cleaned) > 80:
        cleaned = cleaned[:80].rsplit(" ", 1)[0]

    return cleaned if cleaned else title[:80]
