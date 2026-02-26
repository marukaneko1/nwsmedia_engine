# NWS Media — Automated Lead Generation Engine

## Full Technical Blueprint

**Project**: Dual-Channel Lead Engine — Google Maps Audit + LLC Filing Interception
**Goal**: Automatically discover local businesses with bad or no websites (Channel 1) AND intercept brand-new businesses at formation before they exist online (Channel 2). Score them, enrich contact data, and deliver outreach-ready leads daily via cold email and direct mail.

---

### QUICK-START SUMMARY (TL;DR)

**What this is**: An automated system that finds local businesses who need websites and contacts them with personalized outreach — while you sleep.

**Two channels**:
1. **Google Maps** — scrape businesses, audit their websites, email them a free report showing their problems
2. **LLC Filings** — intercept brand-new businesses at formation, mail them a welcome postcard before any competitor reaches them

**What it costs to run**: $260/month (starter) to $685/month (scale)

**What it produces**: 4-27 new web design clients per month

**What that means in revenue**: $15K-$186K/month (depending on scale and close rate)

**Break-even point**: 1 closed client pays for 14+ months of operating costs

**Time to build**: 5-7 weeks (both channels)

**Time to first lead**: Week 6-8 (after build + email warmup period)

**Tech required**: Python, PostgreSQL, Playwright, Celery. All code detailed in this document.

**Key numbers**:
| Metric | Value |
|---|---|
| Cost per acquisition | $25-$65 |
| Google Ads CPA comparison | $500-$2,000 |
| Savings vs. paid ads | 10-80x cheaper |
| Year 1 projected profit | $96K-$176K |
| Monthly time investment (after build) | 1-2 hours maintenance |

**Start here**: Jump to [Section 25 — Prerequisites & Setup Checklist](#25-prerequisites--setup-checklist) to get all accounts created, then follow the [Implementation Timeline](#19-implementation-phases--timeline) phase by phase.

---

### Two Channels, One Pipeline

| | Channel 1: Google Maps + Audit | Channel 2: LLC Filing Interception |
|---|---|---|
| **Catches** | Established businesses with bad/no websites | Brand-new businesses before they exist online |
| **Pitch** | "Your website has these specific problems" | "Welcome to business — let me build your first site" |
| **Outreach** | Cold email with personalized audit report | Direct mail + LinkedIn (no email on file) |
| **Timing** | Businesses operating for months/years | Businesses formed days/weeks ago |
| **Competition** | Low (audit-based personalization is rare) | Near zero (almost no agencies mine filings) |
| **Pipeline share** | ~80% of volume | ~20% of volume |

---

## Table of Contents

**Channel 1 — Google Maps + Website Audit (Primary)**
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Layer 1A — Discovery: Google Maps Scraping](#3-layer-1a--discovery-google-maps-scraping)
4. [Layer 2 — Triage (Website Detection & Classification)](#4-layer-2--triage-website-detection--classification)
5. [Layer 3 — Audit (Automated Website Quality Analysis)](#5-layer-3--audit-automated-website-quality-analysis)
6. [Layer 4 — Scoring (Lead Priority Ranking)](#6-layer-4--scoring-lead-priority-ranking)
7. [Layer 5 — Enrichment (Contact & Decision-Maker Data)](#7-layer-5--enrichment-contact--decision-maker-data)
8. [Layer 6 — Outreach Prep (Personalized Audit Reports)](#8-layer-6--outreach-prep-personalized-audit-reports)
9. [Layer 7 — Delivery & CRM (Email Sequences + Tracking)](#9-layer-7--delivery--crm-email-sequences--tracking)

**Channel 2 — LLC Filing Interception (Secondary)**
10. [Layer 1B — Discovery: Secretary of State LLC Filings](#10-layer-1b--discovery-secretary-of-state-llc-filings)
11. [LLC Lead Scoring & Filtering](#11-llc-lead-scoring--filtering)
12. [LLC Enrichment (Skip Tracing & LinkedIn)](#12-llc-enrichment-skip-tracing--linkedin)
13. [LLC Outreach — Direct Mail + LinkedIn](#13-llc-outreach--direct-mail--linkedin)

**Shared Infrastructure**
14. [Database Schema](#14-database-schema)
15. [API Reference & Rate Limits](#15-api-reference--rate-limits)
16. [Niche Targeting Strategy](#16-niche-targeting-strategy)
17. [Financial Model (Full P&L, Unit Economics, Break-Even, Cash Flow)](#17-financial-model)
18. [Legal & Compliance](#18-legal--compliance)
19. [Implementation Phases & Timeline](#19-implementation-phases--timeline)
20. [File & Folder Structure](#20-file--folder-structure)
21. [Projected Performance Metrics](#21-projected-performance-metrics)
22. [Maintenance & Scaling](#22-maintenance--scaling)
23. [Risks & Mitigations](#23-risks--mitigations)
24. [KPIs & Success Metrics](#24-kpis--success-metrics)
25. [Prerequisites & Setup Checklist](#25-prerequisites--setup-checklist)

---

## 1. System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         SCHEDULER (cron / Celery Beat)                    │
│            Runs nightly: new searches, audits, enrichment, outreach      │
└────────────────┬─────────────────────────────┬───────────────────────────┘
                 │                             │
    ═══ CHANNEL 1 (80%) ═══       ═══ CHANNEL 2 (20%) ═══
                 │                             │
                 ▼                             ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│  LAYER 1A: DISCOVERY     │  │  LAYER 1B: DISCOVERY          │
│  Google Maps scraping    │  │  Secretary of State API        │
│  Input: niche + geo      │  │  Input: state + date range     │
│  Output: 500-1000/run    │  │  Output: 200-500 filings/day   │
└──────────┬───────────────┘  └──────────────┬────────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│  LAYER 2: TRIAGE         │  │  LLC FILTERING                │
│  Website existence check │  │  Entity name NLP analysis     │
│  Path A: No website      │  │  Filter: holding cos, real    │
│  Path B: Has website     │  │  estate LLCs, non-customer-   │
│  Path C: Page builder    │  │  facing entities               │
└──────────┬───────────────┘  └──────────────┬────────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│  LAYER 3: AUDIT          │  │  LLC SCORING                  │
│  PageSpeed API + custom  │  │  Entity name signals, niche   │
│  SSL, mobile, tech stack │  │  detection, address quality,  │
│  CWV, freshness checks   │  │  filing recency               │
└──────────┬───────────────┘  └──────────────┬────────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│  LAYER 4: SCORING        │  │  LLC ENRICHMENT               │
│  Composite score 0-100   │  │  Google Maps cross-ref,       │
│  Weighted formula across │  │  LinkedIn owner lookup,       │
│  all audit signals       │  │  skip tracing for email       │
└──────────┬───────────────┘  └──────────────┬────────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│  LAYER 5: ENRICHMENT     │  │  LLC OUTREACH                 │
│  Email, owner name,      │  │  Direct mail (postcard +      │
│  socials from website    │  │  letter) + LinkedIn connect    │
│  + Hunter.io fallback    │  │  + cold email if found        │
└──────────┬───────────────┘  └──────────────┬────────────────┘
           │                                  │
           ▼                                  │
┌──────────────────────────┐                  │
│  LAYER 6: OUTREACH PREP  │                  │
│  Personalized audit PDF  │                  │
│  Dynamic email template  │                  │
└──────────┬───────────────┘                  │
           │                                  │
           ▼                                  │
┌──────────────────────────┐                  │
│  LAYER 7: DELIVERY       │                  │
│  Cold email via          │                  │
│  Instantly.ai + CRM      │                  │
└──────────┬───────────────┘                  │
           │                                  │
           └──────────────┬───────────────────┘
                          ▼
              ┌───────────────────────┐
              │  SHARED CRM / DB      │
              │  PostgreSQL: unified   │
              │  lead lifecycle        │
              │  tracking across both  │
              │  channels              │
              └───────────────────────┘
```

**Data Store**: PostgreSQL (leads from both channels, audits, scores, outreach status)
**Queue**: Redis + Celery (async task processing for both pipelines)
**Dashboard**: Next.js admin panel (view leads, scores, outreach stats, channel breakdown)

---

## 2. Tech Stack

### Core Application
| Component | Technology | Why |
|---|---|---|
| Language | Python 3.12+ | Best scraping ecosystem, async support, rich libraries |
| Web Framework | FastAPI | Async API for dashboard backend, webhook endpoints |
| Task Queue | Celery + Redis | Distributed async job processing for scraping/auditing |
| Scheduler | Celery Beat | Cron-like scheduling for nightly pipeline runs |
| Database | PostgreSQL 16 | Relational data with JSON support for audit results |
| ORM | SQLAlchemy 2.0 + Alembic | Schema management and migrations |
| Browser Automation | Playwright (Python) | Headless Chrome for scraping JS-rendered content |

### Scraping & Data (Channel 1 — Google Maps)
| Component | Technology | Why |
|---|---|---|
| Google Maps Scraping | Playwright + custom parser OR Outscraper API | Full control vs. managed reliability |
| Website Auditing | Google PageSpeed Insights API (free) | 25K calls/day, Lighthouse-powered |
| SSL Check | Python `ssl` + `socket` stdlib | Zero cost, instant check |
| Tech Detection | Wappalyzer (open-source) or BuiltWith API | Detect Wix/Squarespace/WordPress |
| Email Finder | Hunter.io API or Snov.io API | Find business emails by domain |
| Proxy Rotation | Bright Data or ScraperAPI residential proxies | Avoid IP bans during Maps scraping |

### LLC Filing Data (Channel 2 — Secretary of State)
| Component | Technology | Why |
|---|---|---|
| Multi-State Filing API | Cobalt Intelligence API | All 50 states, real-time data, 22+ data points |
| State-Specific Scrapers | Apify actors (FL, CA, TX) OR custom Playwright | Cheaper per-state alternative to Cobalt |
| Entity Name Analysis | spaCy NLP + regex patterns | Classify entity as customer-facing vs. holding co |
| Google Maps Cross-Ref | Google Places API (text search) | Check if new LLC already has a Maps listing |
| Skip Tracing (email) | Snov.io or Voila Norbert | Find owner email from name + address |
| LinkedIn Lookup | LinkedIn Sales Navigator or manual | Find owner profile for direct outreach |
| Direct Mail | Lob.com API or PostcardMania | Automated postcard/letter printing and mailing |

### Outreach & Delivery (Both Channels)
| Component | Technology | Why |
|---|---|---|
| Cold Email | Instantly.ai or Smartlead | Warmup, rotation, deliverability |
| Direct Mail | Lob.com API | Programmatic postcard printing + mailing |
| Audit PDF Generation | WeasyPrint or Puppeteer | Auto-generate branded PDF reports |
| Email Templates | Jinja2 | Dynamic variable injection |
| Postcard Templates | HTML + Lob.com rendering | Branded welcome postcards for LLC leads |
| CRM | Built-in (PostgreSQL) or Pipedrive/HubSpot | Track lead lifecycle across both channels |

### Dashboard (Optional Phase 6)
| Component | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 + Tailwind CSS | Fast admin panel |
| Charts | Recharts or Chart.js | Visualize pipeline metrics |
| Auth | NextAuth.js | Simple login for you |

---

## 3. Layer 1A — Discovery: Google Maps Scraping

### What It Does
Searches Google Maps for businesses by **category + location**, extracts all available business data, and stores raw records in the database.

### Data Points Extracted Per Business
| Field | Example | Source |
|---|---|---|
| `name` | "Smile Dental Clinic" | Maps listing |
| `place_id` | "ChIJN1t_tDeuEmsR..." | Maps listing (unique ID) |
| `category` | "Dentist" | Maps listing |
| `address` | "123 Main St, Austin, TX 78701" | Maps listing |
| `phone` | "+1 (512) 555-0123" | Maps listing |
| `website` | "http://smiledental.com" | Maps listing (may be null) |
| `rating` | 4.7 | Maps listing |
| `review_count` | 127 | Maps listing |
| `latitude` | 30.2672 | Maps listing |
| `longitude` | -97.7431 | Maps listing |
| `hours` | {"Mon": "9AM-5PM", ...} | Maps listing |
| `photos_count` | 23 | Maps listing |
| `maps_url` | "https://maps.google.com/?cid=..." | Maps listing |

### Search Strategy

**Input Configuration** (stored in DB, editable via dashboard):

```python
SEARCH_CONFIGS = [
    {
        "niche": "dentist",
        "locations": [
            "Austin, TX",
            "San Antonio, TX",
            "Houston, TX",
            # ... expand as needed
        ],
        "radius_miles": 25,
        "max_results_per_search": 200,
    },
    {
        "niche": "contractor",
        "locations": ["Austin, TX"],
        "radius_miles": 15,
        "max_results_per_search": 200,
    },
    # ... more niches
]
```

### Implementation Approach: Playwright Scraper

```python
# Pseudocode — actual implementation will handle pagination, anti-detection, retries

async def scrape_google_maps(query: str, location: str, max_results: int = 200):
    """
    1. Navigate to Google Maps
    2. Enter search query (e.g., "dentist in Austin, TX")
    3. Scroll the results panel to load all listings (infinite scroll)
    4. For each listing, extract business data
    5. Click into each listing for full details (website, phone, hours)
    6. Return list of business dicts
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, proxy=get_rotating_proxy())
        page = await browser.new_page()

        # Anti-detection: random user agent, viewport, language
        await page.set_extra_http_headers(random_headers())
        await page.set_viewport_size(random_viewport())

        await page.goto("https://www.google.com/maps")
        await page.fill('input#searchboxinput', f"{query} in {location}")
        await page.press('input#searchboxinput', 'Enter')
        await page.wait_for_load_state('networkidle')

        businesses = []
        while len(businesses) < max_results:
            # Scroll results panel
            await scroll_results_panel(page)
            # Extract visible listings
            new_listings = await extract_listings(page)
            businesses.extend(new_listings)
            if no_more_results(page):
                break

        # Click into each listing for full details
        detailed = []
        for biz in businesses:
            detail = await extract_full_details(page, biz)
            detailed.append(detail)
            await random_delay(1.5, 3.5)  # Human-like pacing

        await browser.close()
        return detailed
```

### Alternative: Outscraper API (Managed)

If you want to skip building the scraper and pay for reliability:

```python
import outscraper

client = outscraper.ApiClient(api_key="YOUR_KEY")

results = client.google_maps_search(
    "dentist",
    region="US",
    limit=200,
    language="en",
    coordinates="30.2672,-97.7431",  # Austin, TX
    radius=25000,  # meters
    fields=["name", "phone", "site", "full_address", "rating",
            "reviews", "place_id", "latitude", "longitude"]
)
# Cost: ~$2 per 1,000 results
```

### Deduplication

Before inserting into DB, deduplicate on `place_id` (Google's unique business identifier). This prevents re-scraping the same business across overlapping searches.

```python
async def store_businesses(businesses: list[dict]):
    for biz in businesses:
        existing = await db.get_by_place_id(biz["place_id"])
        if existing:
            await db.update_business(existing.id, biz)  # refresh data
        else:
            await db.insert_business(biz)  # new lead
```

### Rate Limiting & Anti-Detection

| Technique | Implementation |
|---|---|
| Proxy rotation | Bright Data residential proxies, rotate per request |
| Request pacing | Random delay 1.5-3.5s between actions |
| User agent rotation | Pool of 50+ real Chrome user agents |
| Viewport variation | Randomize window size per session |
| Session limits | Max 100 listings per browser session, then restart |
| CAPTCHA handling | 2Captcha or Anti-Captcha service integration |
| Fingerprint evasion | Use `playwright-stealth` plugin |

---

## 4. Layer 2 — Triage (Website Detection & Classification)

### What It Does
For each scraped business, determines whether they have a website and classifies it into priority buckets.

### Classification Logic

```python
from urllib.parse import urlparse

async def triage_business(business: dict) -> str:
    website = business.get("website")

    # PATH A: No website at all
    if not website or website.strip() == "":
        return "NO_WEBSITE"  # Highest priority

    # Check if the URL is actually reachable
    is_reachable, status_code, redirect_url = await check_url(website)

    if not is_reachable:
        return "DEAD_WEBSITE"  # Very high priority — they think they have a site

    # PATH C: Detect page builder / free tier
    page_builders = ["wix.com", "squarespace.com", "godaddy.com",
                     "weebly.com", "jimdo.com", "site123.com"]

    if any(builder in redirect_url.lower() for builder in page_builders):
        return "PAGE_BUILDER"  # Medium priority — upgrade opportunity

    if is_free_subdomain(redirect_url):
        return "FREE_SUBDOMAIN"  # High priority — using business.wixsite.com etc.

    # PATH B: Has a real website → send to audit
    return "HAS_WEBSITE"
```

### URL Health Check

```python
import aiohttp

async def check_url(url: str) -> tuple[bool, int, str]:
    """Returns (is_reachable, status_code, final_url_after_redirects)"""
    try:
        if not url.startswith("http"):
            url = f"https://{url}"
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, allow_redirects=True) as resp:
                return True, resp.status, str(resp.url)
    except Exception:
        return False, 0, url
```

### Free Subdomain Detection

```python
FREE_SUBDOMAIN_PATTERNS = [
    r"\.wixsite\.com",
    r"\.squarespace\.com",
    r"\.godaddysites\.com",
    r"\.weebly\.com",
    r"\.wordpress\.com",        # .com = free, .org = self-hosted
    r"\.blogspot\.com",
    r"\.carrd\.co",
    r"\.webflow\.io",
    r"\.my\.canva\.site",
    r"\.business\.site",        # Google Business Profile free site
    r"\.square\.site",
]

def is_free_subdomain(url: str) -> bool:
    return any(re.search(pattern, url) for pattern in FREE_SUBDOMAIN_PATTERNS)
```

### Priority Buckets (Output)

| Bucket | Description | Action |
|---|---|---|
| `NO_WEBSITE` | No website listed on Google Maps | Immediate high-priority lead |
| `DEAD_WEBSITE` | URL listed but returns 4xx/5xx or unreachable | High priority — they don't even know it's down |
| `FREE_SUBDOMAIN` | Using business.wixsite.com or similar | High priority — screams "no budget yet" or "didn't invest" |
| `PAGE_BUILDER` | Wix/Squarespace/GoDaddy with own domain | Medium priority — upgrade pitch |
| `HAS_WEBSITE` | Real website on own domain | Send to audit layer for quality scoring |

---

## 5. Layer 3 — Audit (Automated Website Quality Analysis)

### What It Does
For businesses with existing websites, runs a comprehensive automated audit to quantify exactly how bad (or good) their site is. This produces the ammunition for personalized outreach.

### 5.1 Google PageSpeed Insights API

**Endpoint**: `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed`
**Cost**: FREE — 25,000 requests/day (no API key needed for low volume, key recommended for quota)
**Latency**: 10-30 seconds per URL

```python
import aiohttp

PAGESPEED_API = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed"

async def run_pagespeed_audit(url: str, api_key: str) -> dict:
    params = {
        "url": url,
        "key": api_key,
        "strategy": "mobile",  # or "desktop"
        "category": ["performance", "seo", "accessibility", "best-practices"],
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(PAGESPEED_API, params=params) as resp:
            data = await resp.json()

    categories = data.get("lighthouseResult", {}).get("categories", {})

    return {
        "performance_score": int(categories.get("performance", {}).get("score", 0) * 100),
        "seo_score": int(categories.get("seo", {}).get("score", 0) * 100),
        "accessibility_score": int(categories.get("accessibility", {}).get("score", 0) * 100),
        "best_practices_score": int(categories.get("best-practices", {}).get("score", 0) * 100),
        "lcp": extract_metric(data, "largest-contentful-paint"),    # seconds
        "fid": extract_metric(data, "max-potential-fid"),            # milliseconds
        "cls": extract_metric(data, "cumulative-layout-shift"),      # score
        "fcp": extract_metric(data, "first-contentful-paint"),       # seconds
        "speed_index": extract_metric(data, "speed-index"),          # seconds
        "total_blocking_time": extract_metric(data, "total-blocking-time"),
    }
```

### 5.2 SSL Certificate Check

```python
import ssl
import socket
from datetime import datetime

def check_ssl(domain: str) -> dict:
    """Check if domain has valid SSL and when it expires."""
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                expires = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')
                return {
                    "has_ssl": True,
                    "ssl_valid": True,
                    "ssl_expires": expires.isoformat(),
                    "ssl_days_remaining": (expires - datetime.utcnow()).days,
                    "ssl_issuer": dict(x[0] for x in cert['issuer']).get('organizationName', 'Unknown'),
                }
    except ssl.SSLCertVerificationError:
        return {"has_ssl": True, "ssl_valid": False, "ssl_error": "Invalid certificate"}
    except Exception as e:
        return {"has_ssl": False, "ssl_valid": False, "ssl_error": str(e)}
```

### 5.3 Mobile Responsiveness Check

```python
async def check_mobile_responsive(url: str) -> dict:
    """Use Playwright to render page at mobile viewport and detect issues."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # Render at mobile size
        mobile_page = await browser.new_page(viewport={"width": 375, "height": 812})
        await mobile_page.goto(url, wait_until="networkidle", timeout=15000)

        # Check for horizontal overflow (common mobile issue)
        has_horizontal_scroll = await mobile_page.evaluate("""
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        """)

        # Check viewport meta tag
        has_viewport_meta = await mobile_page.evaluate("""
            () => !!document.querySelector('meta[name="viewport"]')
        """)

        # Check tap target sizes (buttons/links too small)
        small_tap_targets = await mobile_page.evaluate("""
            () => {
                const links = document.querySelectorAll('a, button, input, select, textarea');
                let smallCount = 0;
                links.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
                        smallCount++;
                    }
                });
                return smallCount;
            }
        """)

        await browser.close()

        return {
            "has_viewport_meta": has_viewport_meta,
            "has_horizontal_scroll": has_horizontal_scroll,
            "small_tap_targets": small_tap_targets,
            "is_mobile_friendly": has_viewport_meta and not has_horizontal_scroll,
        }
```

### 5.4 Technology Stack Detection

```python
import re

TECH_SIGNATURES = {
    "wordpress": [
        r"/wp-content/",
        r"/wp-includes/",
        r'<meta name="generator" content="WordPress',
    ],
    "wix": [
        r"wix\.com",
        r"_wix_browser_sess",
        r"X-Wix-",
    ],
    "squarespace": [
        r"squarespace\.com",
        r"sqsp",
        r"<!-- This is Squarespace -->",
    ],
    "shopify": [
        r"cdn\.shopify\.com",
        r"Shopify\.theme",
    ],
    "godaddy_builder": [
        r"godaddy\.com",
        r"wsimg\.com",
    ],
    "react": [r"__NEXT_DATA__", r"_reactRootContainer", r"react-root"],
    "custom_html": [],  # Fallback — no framework detected
}

async def detect_tech_stack(url: str) -> dict:
    """Fetch page HTML + headers and match against known signatures."""
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=10) as resp:
            html = await resp.text()
            headers = dict(resp.headers)

    detected = []
    for tech, patterns in TECH_SIGNATURES.items():
        for pattern in patterns:
            if re.search(pattern, html, re.IGNORECASE) or \
               any(re.search(pattern, v, re.IGNORECASE) for v in headers.values()):
                detected.append(tech)
                break

    return {
        "technologies": detected if detected else ["custom_html"],
        "is_page_builder": any(t in detected for t in ["wix", "squarespace", "godaddy_builder"]),
        "is_wordpress": "wordpress" in detected,
        "is_ecommerce": "shopify" in detected,
    }
```

### 5.5 Content Freshness Detection

```python
async def check_content_freshness(url: str) -> dict:
    """Check how recently the website content was updated."""
    async with aiohttp.ClientSession() as session:
        async with session.head(url, timeout=10) as resp:
            last_modified = resp.headers.get("Last-Modified")

        async with session.get(url, timeout=10) as resp:
            html = await resp.text()

    # Check copyright year in footer
    copyright_years = re.findall(r'©\s*(\d{4})|copyright\s*(\d{4})', html, re.IGNORECASE)
    latest_year = max([int(y) for group in copyright_years for y in group if y], default=None)

    return {
        "last_modified_header": last_modified,
        "copyright_year": latest_year,
        "is_outdated": latest_year is not None and latest_year < (datetime.now().year - 1),
        "years_outdated": (datetime.now().year - latest_year) if latest_year else None,
    }
```

### 5.6 Combined Audit Function

```python
async def full_website_audit(url: str, api_key: str) -> dict:
    """Run all audit checks in parallel for speed."""
    from urllib.parse import urlparse
    domain = urlparse(url).hostname

    # Run all checks concurrently
    pagespeed, ssl_result, mobile, tech, freshness = await asyncio.gather(
        run_pagespeed_audit(url, api_key),
        asyncio.to_thread(check_ssl, domain),
        check_mobile_responsive(url),
        detect_tech_stack(url),
        check_content_freshness(url),
    )

    return {
        "url": url,
        "audited_at": datetime.utcnow().isoformat(),
        "pagespeed": pagespeed,
        "ssl": ssl_result,
        "mobile": mobile,
        "technology": tech,
        "freshness": freshness,
    }
```

---

## 6. Layer 4 — Scoring (Lead Priority Ranking)

### What It Does
Combines all signals into a single **composite lead score (0-100)** that tells you exactly who to contact first.

### Scoring Formula

```python
def calculate_lead_score(business: dict, triage: str, audit: dict | None) -> int:
    score = 0

    # === WEBSITE STATUS (max 40 points) ===
    if triage == "NO_WEBSITE":
        score += 40
    elif triage == "DEAD_WEBSITE":
        score += 38
    elif triage == "FREE_SUBDOMAIN":
        score += 35
    elif triage == "PAGE_BUILDER":
        score += 20
    elif triage == "HAS_WEBSITE" and audit:
        # Scale inversely with website quality
        perf = audit["pagespeed"]["performance_score"]
        if perf < 20:
            score += 35
        elif perf < 40:
            score += 28
        elif perf < 60:
            score += 18
        elif perf < 80:
            score += 8
        else:
            score += 0  # Good website — low priority

    # === SSL STATUS (max 10 points) ===
    if audit and not audit["ssl"]["has_ssl"]:
        score += 10
    elif audit and not audit["ssl"]["ssl_valid"]:
        score += 8

    # === MOBILE FRIENDLINESS (max 10 points) ===
    if audit and not audit["mobile"]["is_mobile_friendly"]:
        score += 10
    elif audit and audit["mobile"]["small_tap_targets"] > 10:
        score += 5

    # === CONTENT FRESHNESS (max 8 points) ===
    if audit and audit["freshness"]["is_outdated"]:
        years = audit["freshness"]["years_outdated"] or 1
        score += min(years * 2, 8)

    # === SEO SCORE (max 7 points) ===
    if audit and audit["pagespeed"]["seo_score"] < 50:
        score += 7
    elif audit and audit["pagespeed"]["seo_score"] < 70:
        score += 4

    # === BUSINESS HEALTH SIGNALS (max 25 points) ===
    # High reviews + bad website = proven business that should invest
    review_count = business.get("review_count", 0)
    rating = business.get("rating", 0)

    if review_count >= 100 and rating >= 4.0:
        score += 15  # Established, successful business
    elif review_count >= 50 and rating >= 4.0:
        score += 12
    elif review_count >= 20 and rating >= 3.5:
        score += 8
    elif review_count >= 5:
        score += 4
    # New business with few reviews
    elif review_count < 5 and review_count > 0:
        score += 6  # Just opened — likely needs everything

    # Bonus: has photos (shows they care about their brand)
    if business.get("photos_count", 0) > 10:
        score += 5
    elif business.get("photos_count", 0) > 3:
        score += 3

    # Bonus: has a phone number (reachable)
    if business.get("phone"):
        score += 3

    # Bonus: has hours listed (active business)
    if business.get("hours"):
        score += 2

    return min(score, 100)
```

### Lead Tiers

| Tier | Score Range | Action | Expected Volume |
|---|---|---|---|
| **HOT** | 80-100 | Outreach immediately, personalized audit | ~5-10% of leads |
| **WARM** | 60-79 | Outreach within 48hrs, templated audit | ~15-20% of leads |
| **COOL** | 40-59 | Queue for batch outreach, light personalization | ~25-30% of leads |
| **COLD** | 20-39 | Low priority, drip nurture only | ~20-25% of leads |
| **SKIP** | 0-19 | Good website, don't contact | ~20-30% of leads |

---

## 7. Layer 5 — Enrichment (Contact & Decision-Maker Data)

### What It Does
For scored leads (40+), finds the business owner's name, email address, and social profiles so outreach can be personalized.

### 7.1 Website Contact Page Scraping

```python
async def scrape_contact_info(website_url: str) -> dict:
    """Crawl the business website for contact information."""
    contact_pages = [
        "/contact", "/contact-us", "/about", "/about-us",
        "/team", "/our-team", "/staff",
    ]

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        emails = set()
        names = []
        socials = {}

        # Check main page and common contact pages
        urls_to_check = [website_url] + [website_url.rstrip("/") + cp for cp in contact_pages]

        for url in urls_to_check:
            try:
                await page.goto(url, timeout=8000)
                html = await page.content()

                # Extract emails
                found_emails = re.findall(
                    r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
                    html
                )
                emails.update(e.lower() for e in found_emails
                              if not e.endswith(('.png', '.jpg', '.gif')))

                # Extract social links
                social_patterns = {
                    "facebook": r'facebook\.com/[^"\s<>]+',
                    "instagram": r'instagram\.com/[^"\s<>]+',
                    "linkedin": r'linkedin\.com/(?:in|company)/[^"\s<>]+',
                    "twitter": r'(?:twitter|x)\.com/[^"\s<>]+',
                }
                for platform, pattern in social_patterns.items():
                    match = re.search(pattern, html)
                    if match:
                        socials[platform] = match.group(0)

            except Exception:
                continue

        await browser.close()

    # Filter out generic emails, prefer personal ones
    personal_emails = [e for e in emails if not e.startswith(
        ("info@", "contact@", "hello@", "support@", "admin@", "sales@", "noreply@")
    )]
    generic_emails = [e for e in emails if e not in personal_emails]

    return {
        "emails": personal_emails + generic_emails,  # personal first
        "best_email": (personal_emails + generic_emails + [None])[0],
        "social_profiles": socials,
    }
```

### 7.2 Hunter.io Email Finder (API Fallback)

```python
async def find_email_hunter(domain: str, api_key: str) -> dict:
    """Use Hunter.io to find email addresses for a domain."""
    url = f"https://api.hunter.io/v2/domain-search?domain={domain}&api_key={api_key}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            data = await resp.json()

    results = data.get("data", {})
    emails = results.get("emails", [])

    # Sort by confidence score
    emails.sort(key=lambda e: e.get("confidence", 0), reverse=True)

    owner_emails = [e for e in emails if e.get("position") and
                    any(t in e["position"].lower() for t in
                        ["owner", "founder", "ceo", "president", "director", "manager"])]

    best_email = (owner_emails or emails or [{}])[0]

    return {
        "email": best_email.get("value"),
        "first_name": best_email.get("first_name"),
        "last_name": best_email.get("last_name"),
        "position": best_email.get("position"),
        "confidence": best_email.get("confidence"),
        "all_emails": [e["value"] for e in emails[:5]],
    }
```

### 7.3 Combined Enrichment Pipeline

```python
async def enrich_lead(business: dict) -> dict:
    """Run all enrichment methods, merge results."""
    domain = extract_domain(business.get("website", ""))
    enriched = {"emails": [], "owner_name": None, "social_profiles": {}}

    if business.get("website"):
        # Scrape website first (free)
        web_data = await scrape_contact_info(business["website"])
        enriched["emails"].extend(web_data["emails"])
        enriched["social_profiles"].update(web_data["social_profiles"])

    if domain and not enriched["emails"]:
        # Fallback to Hunter.io if no emails found
        hunter_data = await find_email_hunter(domain, HUNTER_API_KEY)
        if hunter_data["email"]:
            enriched["emails"].append(hunter_data["email"])
            enriched["owner_name"] = f"{hunter_data.get('first_name', '')} {hunter_data.get('last_name', '')}".strip()
            enriched["owner_position"] = hunter_data.get("position")

    enriched["best_email"] = enriched["emails"][0] if enriched["emails"] else None
    return enriched
```

---

## 8. Layer 6 — Outreach Prep (Personalized Audit Reports)

### What It Does
Auto-generates a personalized one-page audit report for each qualified lead and prepares a dynamic email template with their specific issues.

### 8.1 Email Template (Jinja2)

```
Subject: {{ business_name }} — Your Website Is Costing You Customers

Hi {{ owner_name | default("there") }},

I came across {{ business_name }} and noticed you have
{{ review_count }} reviews with a {{ rating }}-star rating — your customers
clearly love what you do.

But I also noticed some issues with your website that are likely
costing you new customers:

{% if triage == "NO_WEBSITE" %}
• You don't have a website listed on Google — meaning anyone who
  searches "{{ category }} near me" can't find you online.
{% elif triage == "DEAD_WEBSITE" %}
• Your website ({{ website }}) appears to be down or unreachable.
  Customers clicking through from Google Maps are hitting a dead end.
{% elif triage == "FREE_SUBDOMAIN" %}
• Your website is on a free subdomain ({{ website }}), which hurts
  credibility and search rankings. A professional domain costs $12/year.
{% else %}
{% if not audit.ssl.has_ssl %}
• No SSL certificate — browsers show a "Not Secure" warning to
  every visitor. This kills trust immediately.
{% endif %}
{% if not audit.mobile.is_mobile_friendly %}
• Your site isn't mobile-friendly — {{ "60%" }} of your customers are
  searching from their phone and having a bad experience.
{% endif %}
{% if audit.pagespeed.performance_score < 50 %}
• Your site loads in {{ audit.pagespeed.lcp }}s (Google recommends
  under 2.5s). Slow sites lose 53% of mobile visitors.
{% endif %}
{% if audit.pagespeed.seo_score < 60 %}
• Your SEO score is {{ audit.pagespeed.seo_score }}/100 — meaning
  Google is ranking your competitors above you.
{% endif %}
{% if audit.freshness.is_outdated %}
• Your site hasn't been updated since {{ audit.freshness.copyright_year }}.
  Outdated sites signal "this business might be closed."
{% endif %}
{% endif %}

I put together a free 1-page audit with specific fixes. Want me to
send it over?

— {{ sender_name }}
{{ sender_title }}, NWS Media
{{ sender_phone }}
```

### 8.2 Audit PDF Generation

```python
from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader

async def generate_audit_pdf(business: dict, audit: dict, triage: str) -> str:
    """Generate a branded PDF audit report. Returns file path."""
    env = Environment(loader=FileSystemLoader("templates/"))
    template = env.get_template("audit_report.html")

    html_content = template.render(
        business_name=business["name"],
        website=business.get("website", "None"),
        category=business.get("category", ""),
        rating=business.get("rating"),
        review_count=business.get("review_count"),
        triage=triage,
        audit=audit,
        generated_date=datetime.now().strftime("%B %d, %Y"),
        # Scores for visual gauges
        performance_score=audit.get("pagespeed", {}).get("performance_score", 0) if audit else 0,
        seo_score=audit.get("pagespeed", {}).get("seo_score", 0) if audit else 0,
        mobile_friendly=audit.get("mobile", {}).get("is_mobile_friendly", False) if audit else False,
        has_ssl=audit.get("ssl", {}).get("has_ssl", False) if audit else False,
    )

    output_path = f"reports/{business['place_id']}_audit.pdf"
    HTML(string=html_content).write_pdf(output_path)
    return output_path
```

### 8.3 Optional: Auto-Generated Video Audit (Advanced)

Using Playwright screenshots + MoviePy to create a narrated video walkthrough:

```python
async def generate_video_audit(url: str, business_name: str) -> str:
    """Capture screenshots of website issues and compile into a video."""
    screenshots = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # Desktop screenshot
        desktop = await browser.new_page(viewport={"width": 1440, "height": 900})
        await desktop.goto(url, timeout=15000)
        await desktop.screenshot(path=f"/tmp/{business_name}_desktop.png", full_page=True)
        screenshots.append(f"/tmp/{business_name}_desktop.png")

        # Mobile screenshot (show responsiveness issues)
        mobile = await browser.new_page(viewport={"width": 375, "height": 812})
        await mobile.goto(url, timeout=15000)
        await mobile.screenshot(path=f"/tmp/{business_name}_mobile.png", full_page=True)
        screenshots.append(f"/tmp/{business_name}_mobile.png")

        # PageSpeed screenshot
        psi_url = f"https://pagespeed.web.dev/analysis?url={url}"
        psi_page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await psi_page.goto(psi_url, timeout=30000)
        await psi_page.wait_for_timeout(5000)
        await psi_page.screenshot(path=f"/tmp/{business_name}_pagespeed.png")
        screenshots.append(f"/tmp/{business_name}_pagespeed.png")

        await browser.close()

    # Compile screenshots into video with captions using MoviePy
    # (separate implementation — can also use FFmpeg directly)
    video_path = await compile_audit_video(screenshots, business_name)
    return video_path
```

---

## 9. Layer 7 — Delivery & CRM (Email Sequences + Tracking)

### What It Does
Sends personalized cold emails with follow-up sequences and tracks the entire lead lifecycle.

### 9.1 Email Sending via Instantly.ai API

```python
INSTANTLY_API = "https://api.instantly.ai/api/v1"

async def add_lead_to_campaign(lead: dict, campaign_id: str, api_key: str):
    """Add an enriched lead to an Instantly.ai campaign."""
    payload = {
        "api_key": api_key,
        "campaign_id": campaign_id,
        "skip_if_in_workspace": True,
        "leads": [
            {
                "email": lead["best_email"],
                "first_name": lead.get("owner_first_name", ""),
                "last_name": lead.get("owner_last_name", ""),
                "company_name": lead["business_name"],
                "phone": lead.get("phone", ""),
                "website": lead.get("website", ""),
                "custom_variables": {
                    "rating": str(lead.get("rating", "")),
                    "review_count": str(lead.get("review_count", "")),
                    "category": lead.get("category", ""),
                    "city": lead.get("city", ""),
                    "lead_score": str(lead.get("lead_score", "")),
                    "issues_found": lead.get("issues_summary", ""),
                    "performance_score": str(lead.get("performance_score", "")),
                    "triage_status": lead.get("triage_status", ""),
                },
            }
        ],
    }
    async with aiohttp.ClientSession() as session:
        await session.post(f"{INSTANTLY_API}/lead/add", json=payload)
```

### 9.2 Follow-Up Sequence Design

```
DAY 1 — Initial Email
  Subject: {{ business_name }} — Your Website Is Costing You Customers
  Content: Personalized audit findings + offer free report
  Goal: Get a reply or click

DAY 3 — Follow-Up #1 (Value Add)
  Subject: Re: {{ business_name }} website
  Content: "Quick follow-up — I also noticed [1 additional specific issue].
           Here's a screenshot of how your site looks on mobile: [image]"
  Goal: Add more value, show you did real research

DAY 7 — Follow-Up #2 (Social Proof)
  Subject: How [similar business] got 3x more calls from their website
  Content: Brief case study of a similar business you helped.
           Link to their before/after.
  Goal: Build credibility

DAY 12 — Follow-Up #3 (Soft Close)
  Subject: Should I close your file?
  Content: "I don't want to bother you — just wanted to see if
           improving your website is on your radar for 2026.
           If not, no worries at all."
  Goal: Loss aversion trigger — people respond to "closing the file"

DAY 18 — Follow-Up #4 (Breakup Email)
  Subject: Last note from me
  Content: "This is my last email. If you ever want a free website audit,
           just reply to this thread. Wishing {{ business_name }} continued
           success!"
  Goal: Final chance — breakup emails often get highest reply rates
```

### 9.3 Internal Lead Tracking (PostgreSQL)

Track the full lifecycle in your database:

```
LEAD STATUSES:
  new          → Just scraped, not yet processed
  triaged      → Website check complete
  audited      → Full audit complete
  scored       → Lead score calculated
  enriched     → Contact info found
  queued       → Added to email campaign
  contacted    → First email sent
  replied      → Prospect responded
  meeting      → Discovery call scheduled
  proposal     → Proposal sent
  won          → Client signed
  lost         → Declined / no response after full sequence
  disqualified → Bad data, out of business, etc.
```

---

## CHANNEL 2 — LLC FILING INTERCEPTION

---

## 10. Layer 1B — Discovery: Secretary of State LLC Filings

### What It Does
Pulls daily new business filings (LLCs, Corporations, LPs) from Secretary of State registries across target states. These are businesses formed in the last 1-7 days that likely don't have websites yet — you reach them before any other agency.

### Why This Channel Exists
Google Maps catches businesses that have been operating long enough to create a listing. LLC filings catch them at Day 0 — the moment they legally form. This creates a **2-8 week timing advantage** where you're the only agency contacting them.

```
BUSINESS LIFECYCLE COVERAGE:

  Day 0          Week 2-4           Month 2-6           Month 6+
    │                │                   │                   │
    ▼                ▼                   ▼                   ▼
 LLC Filed     Getting set up     Google Maps listing    Established
    │                │              appears here             │
    │                │                   │                   │
    └── CHANNEL 2 ───┘                   └─── CHANNEL 1 ────┘
     (you're first)                      (you have evidence)
```

### Data Points Extracted Per Filing
| Field | Example | Source |
|---|---|---|
| `entity_name` | "Bright Smile Dental LLC" | Filing record |
| `entity_type` | "LLC" | Filing record |
| `filing_date` | "2026-02-20" | Filing record |
| `filing_number` | "L26000123456" | Filing record (unique ID) |
| `state` | "TX" | Filing record |
| `status` | "Active" | Filing record |
| `owner_name` | "Maria Gonzalez" | Member/organizer info |
| `owner_address` | "456 Oak Ave, Austin, TX 78702" | Filing record |
| `registered_agent` | "Maria Gonzalez" | Filing record |
| `agent_address` | "456 Oak Ave, Austin, TX 78702" | Filing record |
| `mailing_address` | "PO Box 1234, Austin, TX 78702" | Filing record |
| `principal_address` | "789 Main St, Austin, TX 78701" | Filing record (business location) |

### 10.1 Implementation: Cobalt Intelligence API (Multi-State)

```python
import aiohttp
from datetime import datetime, timedelta

COBALT_API = "https://api.cobaltintelligence.com/v1"

async def fetch_new_filings(
    state: str,
    days_back: int = 3,
    api_key: str = None
) -> list[dict]:
    """Fetch new LLC/Corp filings from the last N days for a state."""
    params = {
        "state": state,
        "entityType": "LLC",
        "filingDateStart": (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d"),
        "filingDateEnd": datetime.now().strftime("%Y-%m-%d"),
    }
    headers = {"Authorization": f"Bearer {api_key}"}

    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{COBALT_API}/search",
            params=params,
            headers=headers
        ) as resp:
            data = await resp.json()

    filings = []
    for entity in data.get("results", []):
        filings.append({
            "entity_name": entity.get("entityName"),
            "entity_type": entity.get("entityType"),
            "filing_date": entity.get("filingDate"),
            "filing_number": entity.get("filingNumber"),
            "state": state,
            "status": entity.get("status"),
            "owner_name": extract_owner_name(entity),
            "owner_address": extract_owner_address(entity),
            "registered_agent": entity.get("registeredAgent", {}).get("name"),
            "agent_address": format_address(entity.get("registeredAgent", {})),
            "mailing_address": format_address(entity.get("mailingAddress", {})),
            "principal_address": format_address(entity.get("principalAddress", {})),
        })

    return filings

def extract_owner_name(entity: dict) -> str | None:
    officers = entity.get("officers", [])
    for officer in officers:
        title = (officer.get("title") or "").lower()
        if any(t in title for t in ["member", "manager", "organizer", "president", "ceo"]):
            return officer.get("name")
    return officers[0].get("name") if officers else None

def extract_owner_address(entity: dict) -> str | None:
    officers = entity.get("officers", [])
    if officers:
        return format_address(officers[0])
    return None

def format_address(data: dict) -> str | None:
    parts = [
        data.get("address1", ""),
        data.get("address2", ""),
        data.get("city", ""),
        data.get("state", ""),
        data.get("zip", ""),
    ]
    addr = ", ".join(p for p in parts if p)
    return addr if addr else None
```

### 10.2 Alternative: State-Specific Scrapers (Cheaper)

For high-volume states, direct scraping of state websites is cheaper than API access:

```python
# Florida (Sunbiz) — publishes daily bulk data feeds
async def fetch_florida_filings(days_back: int = 1) -> list[dict]:
    """Scrape Florida Division of Corporations new filings."""
    # Florida provides daily CSV/XML feeds at:
    # http://search.sunbiz.org/Inquiry/CorporationSearch/GetDailyReport
    async with aiohttp.ClientSession() as session:
        async with session.get(
            "http://search.sunbiz.org/Inquiry/CorporationSearch/GetDailyReport",
            params={"type": "new", "format": "csv"}
        ) as resp:
            content = await resp.text()

    filings = parse_sunbiz_csv(content)
    return filings

# Texas — SOSDirect search interface
async def fetch_texas_filings(days_back: int = 3) -> list[dict]:
    """Scrape Texas Secretary of State new entity filings."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://direct.sos.state.tx.us/acct/acct-login.asp")
        # Navigate to new entity search, filter by date range
        # Extract entity details from results
        # ...
        await browser.close()

    return filings

# California — bizfile API (developer portal)
async def fetch_california_filings(api_key: str, days_back: int = 3) -> list[dict]:
    """Use California's official bizfile API for new filings."""
    url = "https://calicodev.sos.ca.gov/api/v1/entities"
    params = {
        "formationDateStart": (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d"),
        "formationDateEnd": datetime.now().strftime("%Y-%m-%d"),
        "entityType": "LLC",
    }
    headers = {"Authorization": f"Bearer {api_key}"}

    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params, headers=headers) as resp:
            data = await resp.json()

    return [normalize_ca_filing(f) for f in data.get("results", [])]
```

### 10.3 Deduplication

Deduplicate on `filing_number` (unique per state) and cross-reference against the main `businesses` table to avoid contacting the same business through both channels.

```python
async def store_llc_filing(filing: dict):
    # Check if already exists in LLC filings table
    existing = await db.get_filing_by_number(filing["filing_number"], filing["state"])
    if existing:
        return None  # Already processed

    # Check if this business already exists in Channel 1 (Google Maps)
    maps_match = await db.search_businesses_by_name_and_city(
        filing["entity_name"],
        extract_city(filing["principal_address"])
    )
    if maps_match:
        # Link the filing to the existing business record
        await db.link_filing_to_business(filing, maps_match.id)
        return None  # Already being contacted through Channel 1

    # New unique lead — insert
    return await db.insert_llc_filing(filing)
```

---

## 11. LLC Lead Scoring & Filtering

### What It Does
Not every LLC filing is a potential client. Many filings are holding companies, real estate LLCs, investment vehicles, or solo consultants who won't need a website. This layer filters and scores LLC filings to surface the ones most likely to be customer-facing businesses.

### 11.1 Entity Name Analysis (NLP + Pattern Matching)

```python
import re

# Patterns that indicate a customer-facing business (KEEP)
CUSTOMER_FACING_PATTERNS = [
    r"dental|dentist|orthodont",
    r"law\s+(firm|office|group)|attorney|legal",
    r"med\s*spa|medical\s*spa|aestheti|derma|skin",
    r"plumb|hvac|heat|cool|roof|electri|paint|remodel|construct",
    r"real\s*estate|realty|propert",
    r"restaurant|grill|kitchen|cafe|bistro|bakery|pizza|taco|sushi",
    r"salon|barber|beauty|spa|nail|hair",
    r"gym|fitness|yoga|pilates|crossfit",
    r"vet|veterinar|animal|pet",
    r"auto\s*(repair|body|shop)|mechanic|tire|collision",
    r"clean|maid|janitor",
    r"photo|video|film|media|studio",
    r"account|tax|bookkeep|cpa",
    r"chiro|physical\s*therap|wellness",
    r"landscap|lawn|tree|garden",
    r"insurance|financial|wealth|invest",
    r"tutor|academy|school|learning|education",
    r"consult|coach|advisor",
    r"wedding|event|cater",
]

# Patterns that indicate a non-customer-facing entity (SKIP)
NON_CUSTOMER_PATTERNS = [
    r"holding|holdings",
    r"investment|capital|venture|fund|equity",
    r"trust|estate\s*of|irrevocable",
    r"rental|property|properties|management\s*llc",
    r"land\s*co|real\s*estate\s*invest",
    r"series\s+[a-z]",           # Series LLCs (investment structures)
    r"^\d+\s",                    # Starts with a number (usually an address = rental LLC)
    r"revocable|irrevocable",     # Trusts misclassified as LLCs
]

def classify_entity_name(name: str) -> dict:
    """Analyze LLC entity name to determine if it's a customer-facing business."""
    name_lower = name.lower()

    # Check for non-customer patterns first (reject)
    for pattern in NON_CUSTOMER_PATTERNS:
        if re.search(pattern, name_lower):
            return {"classification": "SKIP", "reason": f"Matched non-customer pattern: {pattern}"}

    # Check for customer-facing patterns (keep)
    detected_niches = []
    for pattern in CUSTOMER_FACING_PATTERNS:
        if re.search(pattern, name_lower):
            detected_niches.append(pattern)

    if detected_niches:
        return {
            "classification": "CUSTOMER_FACING",
            "detected_niches": detected_niches,
            "confidence": "high",
        }

    # No clear signal — could be anything
    return {
        "classification": "UNKNOWN",
        "confidence": "low",
        "reason": "No niche patterns detected in entity name",
    }
```

### 11.2 LLC Lead Scoring

```python
def calculate_llc_score(filing: dict, classification: dict) -> int:
    """Score LLC filing 0-100 based on available signals."""
    score = 0

    # === ENTITY CLASSIFICATION (max 40 points) ===
    if classification["classification"] == "CUSTOMER_FACING":
        score += 40
        if classification.get("confidence") == "high":
            score += 0  # Already at 40
    elif classification["classification"] == "UNKNOWN":
        score += 15  # Might be customer-facing, worth a shot
    else:  # SKIP
        return 0  # Don't contact holding companies

    # === FILING RECENCY (max 20 points) ===
    days_since_filing = (datetime.now() - filing["filing_date"]).days
    if days_since_filing <= 3:
        score += 20  # Filed this week — maximum urgency
    elif days_since_filing <= 7:
        score += 15
    elif days_since_filing <= 14:
        score += 10
    elif days_since_filing <= 30:
        score += 5
    else:
        score += 0

    # === ADDRESS QUALITY (max 15 points) ===
    if filing.get("principal_address") and not is_po_box(filing["principal_address"]):
        score += 10  # Has a physical business address (storefront/office)
    if filing.get("principal_address") != filing.get("owner_address"):
        score += 5  # Different business and personal address = dedicated location

    # === OWNER INFORMATION (max 15 points) ===
    if filing.get("owner_name"):
        score += 10  # Has identifiable owner (can personalize outreach)
    if filing.get("mailing_address"):
        score += 5  # Has mailing address (can send direct mail)

    # === NICHE VALUE BONUS (max 10 points) ===
    high_value_niches = [
        r"dental|dentist", r"law|attorney|legal",
        r"med\s*spa|aestheti", r"real\s*estate",
    ]
    name_lower = filing["entity_name"].lower()
    if any(re.search(p, name_lower) for p in high_value_niches):
        score += 10  # High-value niche detected

    return min(score, 100)

def is_po_box(address: str) -> bool:
    return bool(re.search(r"p\.?o\.?\s*box", address, re.IGNORECASE))
```

### 11.3 LLC Lead Tiers

| Tier | Score Range | Action | Expected Volume |
|---|---|---|---|
| **HOT** | 70-100 | Direct mail + LinkedIn immediately | ~10-15% of filings |
| **WARM** | 45-69 | Direct mail within 1 week | ~15-20% of filings |
| **COOL** | 20-44 | Batch direct mail, lower priority | ~10-15% of filings |
| **SKIP** | 0-19 | Don't contact (holding cos, etc.) | ~50-65% of filings |

---

## 12. LLC Enrichment (Skip Tracing & LinkedIn)

### What It Does
LLC filings don't include email addresses or phone numbers. This layer finds the owner's email and LinkedIn profile using the data you DO have (name + address + entity name).

### 12.1 Google Maps Cross-Reference

Before doing anything else, check if the new LLC already has a Google Maps listing (some businesses file LLCs for already-operating ventures):

```python
async def cross_reference_google_maps(entity_name: str, city: str, state: str) -> dict | None:
    """Check if this LLC already has a Google Maps listing."""
    query = f"{entity_name} {city} {state}"
    # Use Google Places Text Search API
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": query,
        "key": GOOGLE_PLACES_API_KEY,
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as resp:
            data = await resp.json()

    results = data.get("results", [])
    if results:
        best = results[0]
        return {
            "has_maps_listing": True,
            "place_id": best.get("place_id"),
            "name": best.get("name"),
            "address": best.get("formatted_address"),
            "rating": best.get("rating"),
            "website": best.get("website"),  # May need Place Details API
        }
    return {"has_maps_listing": False}
```

### 12.2 Owner Email Discovery

```python
async def find_owner_email(owner_name: str, entity_name: str, domain: str | None) -> dict:
    """Find owner's email through multiple methods."""

    # Method 1: If we found a website through Maps cross-ref, check the domain
    if domain:
        hunter_result = await find_email_hunter(domain, HUNTER_API_KEY)
        if hunter_result.get("email"):
            return {
                "email": hunter_result["email"],
                "source": "hunter_domain_search",
                "confidence": hunter_result.get("confidence", 0),
            }

    # Method 2: Snov.io email finder (by name + company)
    snov_result = await snov_find_email(owner_name, entity_name)
    if snov_result:
        return {
            "email": snov_result,
            "source": "snov_name_search",
            "confidence": 70,
        }

    # Method 3: Email pattern generation + verification
    if domain:
        first, last = parse_name(owner_name)
        patterns = [
            f"{first}@{domain}",
            f"{first}.{last}@{domain}",
            f"{first[0]}{last}@{domain}",
            f"{first}{last[0]}@{domain}",
            f"info@{domain}",
        ]
        for email in patterns:
            is_valid = await verify_email_smtp(email)
            if is_valid:
                return {
                    "email": email,
                    "source": "pattern_guess_verified",
                    "confidence": 60,
                }

    return {"email": None, "source": None, "confidence": 0}

async def snov_find_email(name: str, company: str) -> str | None:
    """Use Snov.io to find email by person name + company."""
    url = "https://api.snov.io/v1/get-emails-from-names"
    payload = {
        "firstName": name.split()[0] if name else "",
        "lastName": " ".join(name.split()[1:]) if name and len(name.split()) > 1 else "",
        "domain": "",  # We may not have a domain
        "company": company,
    }
    headers = {"Authorization": f"Bearer {SNOV_API_KEY}"}
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, headers=headers) as resp:
            data = await resp.json()

    emails = data.get("data", {}).get("emails", [])
    return emails[0].get("email") if emails else None
```

### 12.3 LinkedIn Owner Lookup

```python
async def find_linkedin_profile(owner_name: str, city: str, state: str) -> str | None:
    """Search for the business owner's LinkedIn profile.
    NOTE: LinkedIn blocks automated scraping. This is designed for
    manual-assist or using LinkedIn Sales Navigator search URLs.
    """
    # Generate a LinkedIn search URL for manual outreach
    query = f"{owner_name} {city} {state} owner"
    search_url = f"https://www.linkedin.com/search/results/people/?keywords={quote(query)}"

    return {
        "linkedin_search_url": search_url,
        "suggested_connection_note": generate_linkedin_note(owner_name, city),
    }

def generate_linkedin_note(owner_name: str, city: str) -> str:
    first_name = owner_name.split()[0] if owner_name else "there"
    return (
        f"Hi {first_name} — congratulations on the new business! "
        f"I help new {city} businesses get online. Would love to connect."
    )
```

### 12.4 Combined LLC Enrichment Pipeline

```python
async def enrich_llc_lead(filing: dict) -> dict:
    """Full enrichment pipeline for an LLC filing lead."""
    entity_name = filing["entity_name"]
    owner_name = filing.get("owner_name", "")
    city = extract_city(filing.get("principal_address", ""))
    state = filing["state"]

    # Step 1: Cross-reference Google Maps
    maps_data = await cross_reference_google_maps(entity_name, city, state)

    # Step 2: Find email
    domain = extract_domain(maps_data.get("website")) if maps_data.get("website") else None
    email_data = await find_owner_email(owner_name, entity_name, domain)

    # Step 3: Generate LinkedIn search URL
    linkedin_data = await find_linkedin_profile(owner_name, city, state)

    return {
        "filing_number": filing["filing_number"],
        "maps_cross_ref": maps_data,
        "email": email_data.get("email"),
        "email_source": email_data.get("source"),
        "email_confidence": email_data.get("confidence"),
        "linkedin": linkedin_data,
        "outreach_channels": determine_outreach_channels(filing, email_data, maps_data),
    }

def determine_outreach_channels(filing: dict, email_data: dict, maps_data: dict) -> list[str]:
    """Determine which outreach channels are available for this lead."""
    channels = []

    # Direct mail is always available (we have a mailing address)
    if filing.get("mailing_address") or filing.get("owner_address"):
        channels.append("direct_mail")

    # Cold email if we found an email
    if email_data.get("email") and email_data.get("confidence", 0) >= 50:
        channels.append("cold_email")

    # LinkedIn if we have owner name
    if filing.get("owner_name"):
        channels.append("linkedin")

    # Phone if Maps listing had a phone number
    if maps_data and maps_data.get("phone"):
        channels.append("phone")

    return channels
```

---

## 13. LLC Outreach — Direct Mail + LinkedIn

### What It Does
LLC filing leads typically don't have email addresses, so outreach relies on **direct mail** (physical postcards and letters) and **LinkedIn connection requests** — two channels with near-zero competition from other agencies.

### 13.1 Direct Mail Strategy

#### Why Direct Mail Works for LLC Leads

- **Zero inbox competition**: Business owners get 100+ emails/day but only 5-10 pieces of mail. Your postcard stands out.
- **Response rates**: Direct mail averages 2-5% response rate vs. 1-3% for cold email to unknown recipients.
- **You have their mailing address**: LLC filings guarantee a mailing address. No other data source gives you this for free.
- **Tangible and persistent**: A postcard sits on a desk for days. An email gets deleted in seconds.

#### Postcard Design (Front)

```
┌──────────────────────────────────────────┐
│                                          │
│   Congratulations on launching           │
│   {{ entity_name }}!                     │
│                                          │
│   Every new business needs               │
│   a website that works as                │
│   hard as you do.                        │
│                                          │
│   ┌────────────────────┐                 │
│   │  FREE WEBSITE      │                 │
│   │  CONSULTATION      │                 │
│   │  [QR CODE]         │                 │
│   └────────────────────┘                 │
│                                          │
│   Scan to book your free call            │
│   or visit nwsmedia.com/welcome          │
│                                          │
│                        — NWS Media       │
└──────────────────────────────────────────┘
```

#### Postcard Design (Back)

```
┌──────────────────────────────────────────┐
│                                          │
│   {{ owner_name }}                       │
│   {{ mailing_address }}                  │
│                                          │
│   ─────────────────────                  │
│                                          │
│   Did you know?                          │
│   • 97% of people search online          │
│     before visiting a local business     │
│   • Businesses with websites get         │
│     2.5x more customer inquiries         │
│   • Your competitors already             │
│     have one                             │
│                                          │
│   We build websites for new              │
│   {{ city }} businesses starting         │
│   at $XXX. First consultation free.      │
│                                          │
│   NWS Media | nwsmedia.com               │
│   (555) 000-0000                         │
└──────────────────────────────────────────┘
```

### 13.2 Automated Direct Mail via Lob.com API

```python
import lob

lob.api_key = LOB_API_KEY

async def send_welcome_postcard(filing: dict, enriched: dict) -> dict:
    """Send a branded welcome postcard to a new LLC owner."""
    owner_name = filing.get("owner_name", "Business Owner")
    address = filing.get("mailing_address") or filing.get("owner_address")
    city = extract_city(address)

    postcard = lob.Postcard.create(
        description=f"Welcome postcard for {filing['entity_name']}",
        to_address={
            "name": owner_name,
            "address_line1": parse_address_line1(address),
            "address_city": city,
            "address_state": filing["state"],
            "address_zip": parse_zip(address),
        },
        from_address={
            "name": "NWS Media",
            "address_line1": "YOUR_BUSINESS_ADDRESS",
            "address_city": "YOUR_CITY",
            "address_state": "YOUR_STATE",
            "address_zip": "YOUR_ZIP",
        },
        front=render_postcard_front(filing, city),   # HTML template
        back=render_postcard_back(filing, owner_name, city),  # HTML template
        size="6x9",
        mail_type="usps_first_class",
        # merge_variables for dynamic content are handled in HTML templates
    )

    return {
        "postcard_id": postcard.id,
        "expected_delivery": postcard.expected_delivery_date,
        "cost": 0.63,  # Lob.com pricing for 6x9 postcard
    }
```

### 13.3 Follow-Up Letter (For HOT Leads)

For LLC leads scored 70+, send a one-page letter in addition to the postcard:

```python
async def send_welcome_letter(filing: dict) -> dict:
    """Send a detailed welcome letter to high-score LLC leads."""
    owner_name = filing.get("owner_name", "Business Owner")
    first_name = owner_name.split()[0] if owner_name else "there"

    letter_html = f"""
    <p>Dear {first_name},</p>

    <p>Congratulations on launching <strong>{filing['entity_name']}</strong> — that's
    a big step, and I know how much goes into getting a new business off the ground.</p>

    <p>I'm reaching out because I run NWS Media, a web design studio here in
    {extract_city(filing.get('principal_address', ''))}. We specialize in building
    websites for new local businesses, and I wanted to offer you a <strong>free
    30-minute consultation</strong> to discuss your online presence.</p>

    <p>Here's what we typically help new businesses with:</p>
    <ul>
        <li>A professional website that shows up on Google</li>
        <li>Mobile-friendly design (70% of local searches are on phones)</li>
        <li>Online booking/contact forms that turn visitors into customers</li>
        <li>Google Business Profile setup and optimization</li>
    </ul>

    <p>No pressure, no hard sell — just a conversation about what would
    actually help {filing['entity_name']} get found online.</p>

    <p>You can book a free call at <strong>nwsmedia.com/welcome</strong>
    or call me directly at <strong>(555) 000-0000</strong>.</p>

    <p>Wishing you all the best with the new business!</p>

    <p>— Your Name<br>Founder, NWS Media</p>
    """

    letter = lob.Letter.create(
        description=f"Welcome letter for {filing['entity_name']}",
        to_address=build_address(filing),
        from_address=NWS_RETURN_ADDRESS,
        file=letter_html,
        color=True,
        mail_type="usps_first_class",
    )

    return {"letter_id": letter.id, "cost": 1.08}
```

### 13.4 LinkedIn Outreach Sequence

For LLC leads where you have the owner's name, send a LinkedIn connection request + follow-up messages. This is semi-automated (you generate the messages, send manually):

```
DAY 1 — Connection Request
  Note: "Hi {{ first_name }} — congratulations on launching
  {{ entity_name }}! I help new {{ city }} businesses get
  online. Would love to connect."
  Goal: Get accepted

DAY 3 — First Message (after connection accepted)
  "Thanks for connecting, {{ first_name }}! Quick question —
  do you have a website set up for {{ entity_name }} yet?
  I build sites for local businesses and would love to help
  if you're looking for one."
  Goal: Start conversation

DAY 7 — Follow-Up Message
  "Hey {{ first_name }} — just following up. I actually put
  together a quick mockup of what a site for {{ entity_name }}
  could look like. Want me to send it over?"
  Goal: Offer tangible value (even a rough mockup)

DAY 14 — Soft Close
  "No worries if the timing isn't right! If you ever need a
  website down the road, I'm just a message away. Best of
  luck with {{ entity_name }}!"
  Goal: Leave door open
```

### 13.5 Cold Email (When Email Is Found)

For the ~30-40% of LLC leads where enrichment finds an email address, use cold email as an additional channel:

```
Subject: Congrats on {{ entity_name }} — quick question

Hi {{ first_name }},

I saw that you just launched {{ entity_name }} in {{ city }}
— congrats! Starting a business is no small thing.

Quick question: do you have a website up yet?

I run a small web design studio here in {{ city }} and we
specialize in getting new businesses online fast. We've
helped [X] local businesses launch their first sites this year.

If you're interested, I'd love to offer you a free 30-minute
consultation — no strings attached.

Just reply to this email or grab a time here:
[booking link]

Best,
{{ sender_name }}
NWS Media
```

### 13.6 LLC Outreach Cadence (Multi-Channel)

```
DAY 0  — LLC filing detected, scored, enriched
DAY 1  — Postcard mailed (arrives Day 3-5)
DAY 1  — LinkedIn connection request sent
DAY 2  — Cold email #1 (if email found)
DAY 5  — LinkedIn message #1 (if connected)
DAY 7  — Cold email #2 follow-up
DAY 10 — LinkedIn message #2 (mockup offer)
DAY 14 — Welcome letter mailed (HOT leads only)
DAY 14 — LinkedIn message #3 (soft close)
DAY 18 — Cold email #3 (breakup)
```

---

## 14. Database Schema

```sql
-- Core tables for the lead engine

CREATE TABLE businesses (
    id              BIGSERIAL PRIMARY KEY,
    place_id        VARCHAR(255) UNIQUE NOT NULL,
    source_channel  VARCHAR(20) DEFAULT 'google_maps',  -- google_maps, llc_crossref
    name            VARCHAR(500) NOT NULL,
    category        VARCHAR(255),
    address         TEXT,
    city            VARCHAR(255),
    state           VARCHAR(50),
    zip_code        VARCHAR(20),
    phone           VARCHAR(50),
    website         TEXT,
    rating          DECIMAL(2,1),
    review_count    INTEGER DEFAULT 0,
    photos_count    INTEGER DEFAULT 0,
    latitude        DECIMAL(10,7),
    longitude       DECIMAL(10,7),
    hours           JSONB,
    maps_url        TEXT,
    scraped_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE triage_results (
    id              BIGSERIAL PRIMARY KEY,
    business_id     BIGINT REFERENCES businesses(id),
    status          VARCHAR(50) NOT NULL,
    -- NO_WEBSITE, DEAD_WEBSITE, FREE_SUBDOMAIN, PAGE_BUILDER, HAS_WEBSITE
    http_status     INTEGER,
    redirect_url    TEXT,
    is_free_subdomain BOOLEAN DEFAULT FALSE,
    triaged_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(business_id)
);

CREATE TABLE website_audits (
    id                  BIGSERIAL PRIMARY KEY,
    business_id         BIGINT REFERENCES businesses(id),
    url_audited         TEXT NOT NULL,
    -- PageSpeed scores
    performance_score   INTEGER,
    seo_score           INTEGER,
    accessibility_score INTEGER,
    best_practices_score INTEGER,
    -- Core Web Vitals
    lcp_seconds         DECIMAL(5,2),
    fid_ms              DECIMAL(8,2),
    cls_score           DECIMAL(5,3),
    fcp_seconds         DECIMAL(5,2),
    speed_index_seconds DECIMAL(5,2),
    total_blocking_ms   DECIMAL(8,2),
    -- SSL
    has_ssl             BOOLEAN,
    ssl_valid           BOOLEAN,
    ssl_expires         TIMESTAMP,
    -- Mobile
    is_mobile_friendly  BOOLEAN,
    has_viewport_meta   BOOLEAN,
    has_horizontal_scroll BOOLEAN,
    small_tap_targets   INTEGER,
    -- Technology
    technologies        JSONB,
    is_page_builder     BOOLEAN,
    is_wordpress        BOOLEAN,
    -- Freshness
    copyright_year      INTEGER,
    is_outdated         BOOLEAN,
    -- Raw Lighthouse JSON (for detailed reports)
    raw_lighthouse      JSONB,
    audited_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(business_id)
);

CREATE TABLE lead_scores (
    id              BIGSERIAL PRIMARY KEY,
    business_id     BIGINT REFERENCES businesses(id),
    score           INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    tier            VARCHAR(10) NOT NULL,
    -- HOT, WARM, COOL, COLD, SKIP
    score_breakdown JSONB,
    scored_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE(business_id)
);

CREATE TABLE enrichment_data (
    id              BIGSERIAL PRIMARY KEY,
    business_id     BIGINT REFERENCES businesses(id),
    best_email      VARCHAR(255),
    all_emails      JSONB,
    owner_name      VARCHAR(255),
    owner_position  VARCHAR(255),
    social_profiles JSONB,
    enrichment_source VARCHAR(50), -- website_scrape, hunter, snov
    enriched_at     TIMESTAMP DEFAULT NOW(),
    UNIQUE(business_id)
);

CREATE TABLE outreach_log (
    id              BIGSERIAL PRIMARY KEY,
    business_id     BIGINT REFERENCES businesses(id),
    llc_filing_id   BIGINT REFERENCES llc_filings(id),  -- set if lead came from Channel 2
    source_channel  VARCHAR(20) NOT NULL,  -- google_maps, llc_filing
    outreach_type   VARCHAR(20) NOT NULL,  -- email, postcard, letter, linkedin
    email_sent_to   VARCHAR(255),
    campaign_id     VARCHAR(255),
    status          VARCHAR(50) NOT NULL,
    -- queued, sent, opened, clicked, replied, bounced, delivered, returned
    sent_at         TIMESTAMP,
    opened_at       TIMESTAMP,
    replied_at      TIMESTAMP,
    follow_up_count INTEGER DEFAULT 0,
    notes           TEXT
);

CREATE TABLE lead_lifecycle (
    id              BIGSERIAL PRIMARY KEY,
    business_id     BIGINT REFERENCES businesses(id),
    status          VARCHAR(50) NOT NULL,
    -- new, triaged, audited, scored, enriched, queued, contacted,
    -- replied, meeting, proposal, won, lost, disqualified
    changed_at      TIMESTAMP DEFAULT NOW(),
    notes           TEXT
);

CREATE TABLE search_configs (
    id              BIGSERIAL PRIMARY KEY,
    niche           VARCHAR(255) NOT NULL,
    locations       JSONB NOT NULL,
    radius_miles    INTEGER DEFAULT 25,
    max_results     INTEGER DEFAULT 200,
    is_active       BOOLEAN DEFAULT TRUE,
    last_run_at     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ====================================================
-- CHANNEL 2: LLC Filing Tables
-- ====================================================

CREATE TABLE llc_filings (
    id                  BIGSERIAL PRIMARY KEY,
    filing_number       VARCHAR(100) NOT NULL,
    state               VARCHAR(5) NOT NULL,
    entity_name         VARCHAR(500) NOT NULL,
    entity_type         VARCHAR(50),        -- LLC, Corp, LP, etc.
    filing_date         DATE NOT NULL,
    status              VARCHAR(50),        -- Active, Inactive, etc.
    -- Owner information
    owner_name          VARCHAR(255),
    owner_address       TEXT,
    -- Registered agent
    registered_agent    VARCHAR(255),
    agent_address       TEXT,
    -- Business addresses
    mailing_address     TEXT,
    principal_address   TEXT,
    -- Classification
    classification      VARCHAR(50),        -- CUSTOMER_FACING, UNKNOWN, SKIP
    detected_niches     JSONB,
    classification_confidence VARCHAR(20),
    -- Scoring
    llc_score           INTEGER CHECK (llc_score >= 0 AND llc_score <= 100),
    llc_tier            VARCHAR(10),        -- HOT, WARM, COOL, SKIP
    -- Cross-reference
    linked_business_id  BIGINT REFERENCES businesses(id),  -- if found on Google Maps
    maps_cross_ref      JSONB,
    -- Enrichment
    found_email         VARCHAR(255),
    email_source        VARCHAR(50),
    email_confidence    INTEGER,
    linkedin_url        VARCHAR(500),
    -- Outreach tracking
    postcard_sent       BOOLEAN DEFAULT FALSE,
    postcard_sent_at    TIMESTAMP,
    postcard_id         VARCHAR(255),       -- Lob.com postcard ID
    letter_sent         BOOLEAN DEFAULT FALSE,
    letter_sent_at      TIMESTAMP,
    linkedin_requested  BOOLEAN DEFAULT FALSE,
    linkedin_connected  BOOLEAN DEFAULT FALSE,
    email_campaign_id   VARCHAR(255),
    -- Lifecycle
    lead_status         VARCHAR(50) DEFAULT 'new',
    -- new, classified, scored, enriched, outreach_sent, replied,
    -- meeting, proposal, won, lost, disqualified
    scraped_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(filing_number, state)
);

CREATE TABLE llc_filing_configs (
    id              BIGSERIAL PRIMARY KEY,
    state           VARCHAR(5) NOT NULL,
    source          VARCHAR(50) NOT NULL,   -- cobalt, apify, direct_scrape
    days_back       INTEGER DEFAULT 3,
    entity_types    JSONB DEFAULT '["LLC"]',
    is_active       BOOLEAN DEFAULT TRUE,
    last_run_at     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE direct_mail_log (
    id              BIGSERIAL PRIMARY KEY,
    llc_filing_id   BIGINT REFERENCES llc_filings(id),
    mail_type       VARCHAR(20) NOT NULL,   -- postcard, letter
    lob_id          VARCHAR(255),           -- Lob.com tracking ID
    status          VARCHAR(50),            -- created, mailed, delivered, returned
    sent_at         TIMESTAMP,
    delivered_at    TIMESTAMP,
    cost_cents      INTEGER,
    notes           TEXT
);

-- Indexes for common queries (Channel 1)
CREATE INDEX idx_businesses_place_id ON businesses(place_id);
CREATE INDEX idx_businesses_category ON businesses(category);
CREATE INDEX idx_businesses_city ON businesses(city);
CREATE INDEX idx_lead_scores_tier ON lead_scores(tier);
CREATE INDEX idx_lead_scores_score ON lead_scores(score DESC);
CREATE INDEX idx_lead_lifecycle_status ON lead_lifecycle(status);
CREATE INDEX idx_outreach_log_status ON outreach_log(status);

-- Indexes for common queries (Channel 2)
CREATE INDEX idx_llc_filings_state ON llc_filings(state);
CREATE INDEX idx_llc_filings_filing_date ON llc_filings(filing_date DESC);
CREATE INDEX idx_llc_filings_classification ON llc_filings(classification);
CREATE INDEX idx_llc_filings_llc_tier ON llc_filings(llc_tier);
CREATE INDEX idx_llc_filings_llc_score ON llc_filings(llc_score DESC);
CREATE INDEX idx_llc_filings_lead_status ON llc_filings(lead_status);
-- Note: UNIQUE(filing_number, state) on the table already creates an index, no separate one needed
```

---

## 15. API Reference & Rate Limits

### Channel 1 APIs (Google Maps + Audit)

| API | Free Tier | Paid Tier | Rate Limit | Used For |
|---|---|---|---|---|
| **Google PageSpeed Insights** | 25,000/day | N/A (free) | 400/100s | Website auditing |
| **Hunter.io** | 25 searches/mo | $49/mo = 500 searches | 10/sec | Email finding |
| **Outscraper** (optional) | 100 free | $2/1K results | 1 req/sec | Maps scraping |
| **2Captcha** | N/A | $2.99/1K CAPTCHAs | — | CAPTCHA solving |
| **Bright Data Proxies** | N/A | ~$10/GB residential | — | IP rotation |
| **Instantly.ai** | N/A | $30/mo (Growth) | 100/day sends | Cold email |
| **BuiltWith** (optional) | 1 lookup free | $295/mo | 50/min | Tech detection |

### Channel 2 APIs (LLC Filings + Direct Mail)

| API | Free Tier | Paid Tier | Rate Limit | Used For |
|---|---|---|---|---|
| **Cobalt Intelligence** | Free trial | Custom pricing (~$0.10-$0.30/lookup) | Varies by state | Multi-state LLC filing data |
| **Apify FL Business Leads** | N/A | $5/1K results | 1 req/sec | Florida-specific filing data |
| **Google Places Text Search** | $0 (first $200/mo credit) | $32/1K requests | 100 req/sec | Cross-referencing LLCs to Maps |
| **Snov.io** | 50 credits/mo free | $39/mo = 1K credits | 60/min | Skip tracing (email by name) |
| **Lob.com** | N/A | $0.63/postcard, $1.08/letter | 300/min | Automated direct mail |
| **CA Bizfile API** (optional) | Free (state-run) | N/A | Varies | California filings direct |

### Free Alternatives for Cost Reduction

| Paid Service | Free Alternative | Trade-off |
|---|---|---|
| Hunter.io | Website scraping for emails | Lower hit rate but zero cost |
| Outscraper | Custom Playwright scraper | More maintenance, but free |
| BuiltWith | Wappalyzer open-source / regex detection | Fewer technologies detected |
| Bright Data | Free proxy lists + rotating | Less reliable, more blocks |
| Cobalt Intelligence | Direct state website scraping | Per-state maintenance, inconsistent formats |
| Snov.io | Manual LinkedIn + email pattern guessing | Lower hit rate, more manual effort |
| Lob.com | Print postcards yourself + USPS bulk mail | Manual labor, but much cheaper at scale |

---

## 16. Niche Targeting Strategy

### Tier 1 — Highest Value (Start Here)

These industries have high average project values ($3K-$15K+), frequent need for websites, and are Google Maps-dense:

| Niche | Why | Avg Project Value | Maps Density |
|---|---|---|---|
| **Dentists** | Every city has dozens, often bad sites | $5K-$15K | Very High |
| **Lawyers** | High-value clients, need credibility | $5K-$20K | Very High |
| **Med Spas / Dermatology** | Aesthetic industry, brand-focused | $5K-$15K | High |
| **Contractors (HVAC, Plumbing, Roofing)** | Huge local search volume | $3K-$8K | Very High |
| **Real Estate Agents** | Personal branding, IDX sites | $3K-$8K | Very High |

### Tier 2 — High Volume

| Niche | Why | Avg Project Value | Maps Density |
|---|---|---|---|
| **Restaurants** | Massive volume, many bad sites | $2K-$5K | Extremely High |
| **Auto Repair / Body Shops** | Local-dependent, often outdated | $2K-$5K | Very High |
| **Salons / Barbershops** | Brand-focused, booking integration | $2K-$5K | Very High |
| **Gyms / Fitness Studios** | Membership-driven, need conversions | $3K-$8K | High |
| **Veterinarians** | Trust-dependent, bad sites common | $3K-$8K | High |

### Tier 3 — Expansion

| Niche | Why | Avg Project Value |
|---|---|---|
| Chiropractors | Similar to dentists, high Maps density | $3K-$8K |
| Accountants / CPAs | Seasonal demand, credibility-driven | $3K-$8K |
| Wedding Venues | High emotion purchase, visual-heavy | $5K-$15K |
| Photography Studios | Should have great sites, often don't | $2K-$5K |
| Cleaning Services | High volume, mostly no websites | $1.5K-$4K |

### Geographic Expansion Order

1. **Start local** — Your city + surrounding 25 miles
2. **Expand regionally** — Top 3-5 cities in your state
3. **Go state-wide** — All cities with 50K+ population
4. **Neighboring states** — Same time zone, easy to service remotely
5. **National** — Top 100 US metros by population

---

## 17. Financial Model

### 17.1 Monthly Operating Costs — Itemized

#### Channel 1: Google Maps + Audit

| Item | Cost | Notes |
|---|---|---|
| VPS / Cloud Server | $20-$50/mo | DigitalOcean or Railway for running both pipelines |
| PostgreSQL (managed) | $15/mo | Or free tier on Supabase/Neon |
| Redis | $0-$10/mo | Free tier on Upstash, or self-hosted |
| Residential Proxies | $30-$80/mo | Bright Data, ~5-10GB/mo for Maps scraping |
| 2Captcha | $10-$20/mo | ~3K-7K CAPTCHAs solved |
| Hunter.io | $0-$49/mo | Free tier for 25/mo, Starter for 500/mo |
| Instantly.ai | $30/mo | Growth plan: 5K active contacts, warmup |
| Domain + Email Sending | $5-$15/mo | Separate sending domain for cold email |
| **Channel 1 TOTAL** | **$110-$260/mo** | |

#### Channel 2: LLC Filings + Direct Mail

| Item | Cost | Notes |
|---|---|---|
| Cobalt Intelligence API | $30-$100/mo | ~300-1,000 lookups/mo across target states |
| OR Apify state scrapers | $5-$20/mo | Cheaper per-state alternative |
| Google Places Text Search | $0-$15/mo | Cross-referencing LLCs ($200 free credit/mo) |
| Snov.io (skip tracing) | $0-$39/mo | Free tier for 50/mo, Starter for 1K/mo |
| Lob.com postcards | $60-$200/mo | 100-300 postcards @ $0.63 each |
| Lob.com letters (HOT only) | $15-$50/mo | 15-50 letters @ $1.08 each |
| Postage (included in Lob) | $0 | Lob includes USPS First Class postage |
| **Channel 2 TOTAL** | **$110-$425/mo** | |

#### Combined Monthly Cost by Tier

| Scenario | Channel 1 | Channel 2 | Total |
|---|---|---|---|
| **Starter** (1 state, conservative) | $150/mo | $110/mo | **$260/mo** |
| **Growth** (3 states, moderate) | $200/mo | $250/mo | **$450/mo** |
| **Scale** (5+ states, aggressive) | $260/mo | $425/mo | **$685/mo** |

### 17.2 One-Time / Startup Costs

| Item | Cost | Notes |
|---|---|---|
| Google Cloud API Key | $0 | For PageSpeed Insights + Places |
| Lob.com account setup | $0 | Pay-per-use, no upfront |
| Cobalt Intelligence trial | $0 | Free trial to test |
| Instantly.ai email warmup period | $30 | 2-3 weeks of warmup before sending at scale |
| Sending domain registration | $12 | 1 domain, separate from nwsmedia.com |
| Google Workspace for sending | $7/mo | Professional email on sending domain |
| **Total startup cash needed** | **~$50** | Everything else is pay-as-you-go or free trial |

### 17.3 Unit Economics

These are the numbers that matter most — what each lead, email, and client actually costs you:

#### Channel 1 — Cost Per Lead / Cost Per Acquisition

| Metric | Starter | Growth | Scale |
|---|---|---|---|
| Monthly spend | $150 | $200 | $260 |
| Leads scraped | 5,000 | 15,000 | 30,000 |
| **Cost per scraped lead** | **$0.03** | **$0.013** | **$0.009** |
| Qualified leads (score 40+) | 2,500 | 7,500 | 15,000 |
| **Cost per qualified lead** | **$0.06** | **$0.027** | **$0.017** |
| Emails sent | 1,250 | 3,750 | 7,500 |
| **Cost per email sent** | **$0.12** | **$0.053** | **$0.035** |
| Meetings booked | 20 | 65 | 130 |
| **Cost per meeting** | **$7.50** | **$3.08** | **$2.00** |
| Clients closed | 3 | 10 | 20 |
| **Cost per acquisition (CPA)** | **$50** | **$20** | **$13** |
| Avg project value | $4,000 | $5,000 | $5,000 |
| **CPA as % of project value** | **1.25%** | **0.4%** | **0.26%** |

#### Channel 2 — Cost Per Lead / Cost Per Acquisition

| Metric | Starter | Growth | Scale |
|---|---|---|---|
| Monthly spend | $110 | $250 | $425 |
| LLC filings pulled | 1,500 | 5,000 | 15,000 |
| **Cost per filing pulled** | **$0.073** | **$0.05** | **$0.028** |
| Qualified LLC leads (score 45+) | 200 | 700 | 2,100 |
| **Cost per qualified LLC lead** | **$0.55** | **$0.36** | **$0.20** |
| Postcards mailed | 200 | 700 | 2,100 |
| **Cost per postcard sent** | **$0.55** | **$0.36** | **$0.20** |
| Responses received | 6 | 25 | 75 |
| **Cost per response** | **$18.33** | **$10.00** | **$5.67** |
| Meetings booked | 3 | 12 | 37 |
| **Cost per meeting** | **$36.67** | **$20.83** | **$11.49** |
| Clients closed | 1 | 3 | 7 |
| **Cost per acquisition (CPA)** | **$110** | **$83** | **$61** |
| Avg project value | $3,500 | $4,000 | $4,500 |
| **CPA as % of project value** | **3.1%** | **2.1%** | **1.4%** |

#### Combined CPA

| Scenario | Total Spend | Total Clients | **Blended CPA** | Avg Revenue/Client | **Profit per Client** |
|---|---|---|---|---|---|
| Starter | $260/mo | 4 | **$65** | $3,800 | **$3,735** |
| Growth | $450/mo | 13 | **$35** | $4,600 | **$4,565** |
| Scale | $685/mo | 27 | **$25** | $4,800 | **$4,775** |

**For context**: Most web design agencies spend $200-$500 per lead on Google Ads or $500-$2,000 per acquisition through paid advertising. This system delivers clients at **$25-$65 per acquisition** — 10-80x cheaper than paid ads.

### 17.4 Revenue Funnel — Full Breakdown

#### Channel 1 (Google Maps)

| Metric | Conservative | Moderate | Aggressive |
|---|---|---|---|
| Leads scraped/month | 5,000 | 15,000 | 30,000 |
| Pass triage (have issues) | 3,500 (70%) | 10,500 (70%) | 21,000 (70%) |
| Score 40+ (worth contacting) | 2,500 (50%) | 7,500 (50%) | 15,000 (50%) |
| Email found (contactable) | 1,250 (50%) | 3,750 (50%) | 7,500 (50%) |
| Emails sent | 1,250 | 3,750 | 7,500 |
| Replies (5-8%) | 63-100 | 188-300 | 375-600 |
| Meetings booked (30% of replies) | 19-30 | 56-90 | 113-180 |
| Proposals sent (80% of meetings) | 15-24 | 45-72 | 90-144 |
| Clients closed (20% of proposals) | 3-5 | 9-14 | 18-29 |
| **Avg project value** | **$4,000** | **$5,000** | **$5,000** |
| **Channel 1 Monthly Revenue** | **$12K-$20K** | **$45K-$70K** | **$90K-$145K** |

#### Channel 2 (LLC Filings)

| Metric | Conservative | Moderate | Aggressive |
|---|---|---|---|
| Filings pulled/month | 1,500 | 5,000 | 15,000 |
| Pass filter (not holding cos) | 600 (40%) | 2,000 (40%) | 6,000 (40%) |
| Score 45+ (worth contacting) | 200 (33%) | 700 (35%) | 2,100 (35%) |
| Postcards mailed | 200 | 700 | 2,100 |
| Emails sent (where found) | 70 (35%) | 245 (35%) | 735 (35%) |
| LinkedIn requests sent | 140 (70%) | 490 (70%) | 1,470 (70%) |
| Total responses (all channels) | 6-10 | 21-35 | 63-105 |
| Meetings booked (50% of responses) | 3-5 | 11-18 | 32-53 |
| Proposals sent (70% of meetings) | 2-4 | 8-13 | 22-37 |
| Clients closed (25% of proposals) | 1-1 | 2-3 | 6-9 |
| **Avg project value** | **$3,500** | **$4,000** | **$4,500** |
| **Channel 2 Monthly Revenue** | **$3.5K-$3.5K** | **$8K-$12K** | **$27K-$41K** |

#### Combined Monthly P&L

| | Conservative | Moderate | Aggressive |
|---|---|---|---|
| **REVENUE** | | | |
| Channel 1 (Maps) | $12,000-$20,000 | $45,000-$70,000 | $90,000-$145,000 |
| Channel 2 (LLC) | $3,500-$3,500 | $8,000-$12,000 | $27,000-$41,000 |
| **Total Revenue** | **$15,500-$23,500** | **$53,000-$82,000** | **$117,000-$186,000** |
| | | | |
| **COSTS** | | | |
| Channel 1 operating | ($150) | ($200) | ($260) |
| Channel 2 operating | ($110) | ($250) | ($425) |
| **Total Costs** | **($260)** | **($450)** | **($685)** |
| | | | |
| **GROSS PROFIT** | **$15,240-$23,240** | **$52,550-$81,550** | **$116,315-$185,315** |
| **Profit Margin** | **98.3%-98.9%** | **99.2%-99.5%** | **99.4%-99.6%** |

> Note: These margins don't include your time to build websites for the clients you close. Actual net profit depends on your project delivery costs (your time, contractors, hosting, etc.). The numbers above represent the lead generation system's ROI — what it costs to GET the client, not to SERVE the client.

### 17.5 Break-Even Analysis

**How fast does this system pay for itself?**

| Scenario | Monthly Cost | Revenue from 1 Client | Clients Needed to Break Even | Time to First Client |
|---|---|---|---|---|
| Starter | $260/mo | $3,500-$4,000 | **< 1 client** | Week 6-8 (after build + warmup) |
| Growth | $450/mo | $4,000-$5,000 | **< 1 client** | Week 6-8 |
| Scale | $685/mo | $4,500-$5,000 | **< 1 client** | Week 6-8 |

**You break even with a single closed client.** Every client after that is pure profit from the system's perspective.

**Month-by-month ramp-up (realistic Starter scenario):**

| Month | What Happens | Cost | Revenue | Cumulative P/L |
|---|---|---|---|---|
| **Month 1** | Build Phase 1-3 (scraper, audit, enrichment). No outreach yet. | $50 (startup) | $0 | -$50 |
| **Month 2** | Build Phase 4 (automation). Start email warmup. First test emails sent late in month. | $260 | $0 | -$310 |
| **Month 3** | Pipeline running daily. 1,250 emails/mo at scale. Replies start coming. 1-2 meetings. | $260 | $0-$4,000 | -$570 to +$3,430 |
| **Month 4** | Pipeline optimized. Scoring tuned. 15-20 meetings. Close 2-3 clients. | $260 | $8,000-$12,000 | +$7,430 to +$15,170 |
| **Month 5** | Add Channel 2 (LLC filings). Maps pipeline producing steadily. Close 3-4 clients. | $370 | $12,000-$16,000 | +$19,060 to +$30,800 |
| **Month 6** | Both channels running. Close 4-5 clients. | $370 | $15,000-$20,000 | +$33,690 to +$50,430 |
| **Month 7-12** | Steady state. Expand niches + states. | $370/mo | $15,000-$23,000/mo | +$120K-$185K cumulative |

**Break-even month**: Month 3 (one client pays for 14+ months of operating costs)
**Year 1 total investment**: ~$4,000 (operating costs)
**Year 1 projected revenue**: $100,000-$180,000
**Year 1 projected profit from lead gen**: $96,000-$176,000

### 17.6 Cost Comparison vs. Other Lead Gen Methods

| Method | Cost Per Lead | Cost Per Meeting | Cost Per Acquisition | Monthly Spend for 5 Clients |
|---|---|---|---|---|
| **This System (Maps + LLC)** | **$0.03-$0.55** | **$7-$37** | **$25-$65** | **$260-$450** |
| Google Ads (PPC) | $15-$50 | $150-$500 | $500-$2,000 | $2,500-$10,000 |
| Facebook/Instagram Ads | $10-$30 | $100-$300 | $400-$1,500 | $2,000-$7,500 |
| Upwork/Fiverr (bidding) | $0 (time) | N/A | $0 (but race to bottom) | $0 (but low margins) |
| Thumbtack/Bark leads | $15-$75/lead | $100-$300 | $300-$750 | $1,500-$3,750 |
| Networking/BNI | $500-$1,000/yr | Hard to measure | $200-$500 | $80/mo + time |
| Hiring a salesperson | N/A | N/A | N/A | $4,000-$8,000/mo salary |
| Cold calling (manual) | $0 (time) | Your time | Your time | $0 + 20-40 hrs/mo |

**This system is 10-80x cheaper per acquisition than paid advertising and runs unattended while you sleep.**

### 17.7 What's Free vs. What Costs Money

| Free (Zero Cost) | Costs Money |
|---|---|
| Google PageSpeed API (25K audits/day) | Residential proxies ($30-$80/mo) |
| SSL certificate checking | 2Captcha ($10-$20/mo) |
| Mobile responsiveness analysis | Instantly.ai ($30/mo) |
| Tech stack detection (regex) | Lob.com postcards ($0.63 each) |
| Lead scoring algorithm | Hunter.io if you exceed 25 free/mo |
| Entity name classification | Cobalt Intelligence ($30-$100/mo) |
| Email template rendering | Sending domain ($12/year) |
| All Google Cloud API key setup | Snov.io if you exceed 50 free/mo |
| PostgreSQL on Supabase/Neon free tier | VPS hosting ($20-$50/mo) |
| Redis on Upstash free tier | |

**You could run a bare-minimum version of Channel 1 for under $80/month** by using free tiers for everything possible, free proxy lists, and manual CAPTCHA solving. It would be less reliable but functional for testing.

---

## 18. Legal & Compliance

### Google Maps Scraping (Channel 1)

- **Is it legal?** Scraping publicly available business data is not illegal under US law. The hiQ Labs v. LinkedIn (2022) ruling established that scraping public data does not violate the CFAA.
- **Does it violate Google ToS?** Yes — Google's ToS prohibits automated data extraction. This is a **contract violation, not a criminal act**. Consequences are technical (IP blocks, account suspension), not legal prosecution.
- **Risk mitigation**: Use Google Maps as a discovery layer only. Don't store or resell raw Google data. Transform it into your own lead database with your own audit data added.

### Secretary of State LLC Data (Channel 2)

- **Is it legal?** Yes — **this is the most legally clean data source in the entire pipeline.** LLC filings are government public records published explicitly for public access. There are zero terms-of-service restrictions. This data is analogous to property records or court filings.
- **Can you use it for marketing?** Yes. Business entity filings are public records. The owner names and addresses filed are public information. Using them for commercial outreach is legal in all 50 states.
- **GDPR/CCPA considerations**: LLC owner names and business addresses are public records filed voluntarily with the government. They are not subject to consumer privacy opt-out rights when used for B2B commercial outreach. However, if an owner's HOME address is listed (which happens with home-based businesses), treat it with care — use it for mailing only, don't publish it.
- **State-specific rules**: Some states charge fees for bulk data access. California, Florida, and Texas have the most accessible data. Always check the specific state's data use terms before scraping.

### Direct Mail Compliance (Channel 2)

Direct mail is governed by USPS regulations, not CAN-SPAM:

- [ ] Include your return address on all mail pieces
- [ ] Do not use misleading or deceptive mailers (no "official government notice" styling)
- [ ] Honor opt-out requests if a recipient contacts you to stop mailing
- [ ] Comply with USPS size, weight, and formatting requirements
- [ ] Use proper address formatting (Lob.com handles this automatically)

**Key advantage**: Direct mail has NO equivalent of CAN-SPAM. There is no legal requirement to include an unsubscribe link in physical mail, though honoring stop requests is a best practice.

### Cold Email (CAN-SPAM Compliance — Both Channels)

All outreach emails must comply with the CAN-SPAM Act:

- [ ] Include your physical mailing address
- [ ] Include a clear unsubscribe mechanism
- [ ] Honor unsubscribe requests within 10 business days
- [ ] Don't use deceptive subject lines
- [ ] Identify the message as an advertisement (first email)
- [ ] Include your real name and business name

### LinkedIn Outreach (Channel 2)

- LinkedIn outreach via manual connection requests is fully compliant with LinkedIn's ToS.
- Do NOT automate LinkedIn connection requests or messages — LinkedIn aggressively detects and bans automation tools.
- The system generates suggested messages that you send manually (5-10 per day).

### Data Protection

- **Business data** (name, address, phone, website) is publicly listed and non-personal. Safe to collect and use.
- **LLC filing data** (entity name, owner name, business address) is public government record. Safe to collect and use.
- **Personal email addresses** of business owners may be subject to state privacy laws (CCPA in California). Include opt-out in all communications.
- **Do not scrape or store**: personal mobile numbers, SSNs, or any data not publicly listed by the business itself.
- **Home addresses**: If an LLC filing lists a residential address, use it only for mailing, not for any public display or resale.

### Best Practices

1. Use a separate sending domain (not nwsmedia.com) for cold outreach to protect your main domain reputation.
2. Warm up sending domains for 2-3 weeks before scaling.
3. Keep daily send volume under 50/day per sending account.
4. Use 3-5 sending accounts to distribute volume.
5. Stop emailing anyone who unsubscribes or asks to stop — immediately.
6. For direct mail, limit to 1-2 mailings per LLC lead to avoid waste and annoyance.
7. Track direct mail returns (bad addresses) and remove from future mailings.

---

## 19. Implementation Phases & Timeline

### Phase 1: Foundation (Week 1-2)

**Goal**: Get the scraper running and producing raw leads.

| Task | Details | Days |
|---|---|---|
| Project setup | Python project, Poetry/pip, folder structure, Git repo | 0.5 |
| Database setup | PostgreSQL + schema migration with Alembic | 0.5 |
| Google Maps scraper | Playwright-based scraper with proxy rotation | 3 |
| Deduplication logic | place_id-based dedup, upsert on re-scrape | 0.5 |
| Search config system | DB-driven niche + location configs | 0.5 |
| Basic CLI runner | `python run.py scrape --niche dentist --location "Austin, TX"` | 0.5 |
| **Testing**: Run first batch of 500 leads | Verify data quality, fix edge cases | 1 |

**Deliverable**: CLI tool that scrapes Google Maps and stores business data in PostgreSQL.

### Phase 2: Triage + Audit (Week 2-3)

**Goal**: Automatically check and score every website.

| Task | Details | Days |
|---|---|---|
| URL health checker | Reachability, redirect following, status codes | 0.5 |
| Free subdomain detection | Pattern matching against known free platforms | 0.5 |
| PageSpeed API integration | Async calls, response parsing, score extraction | 1 |
| SSL checker | Certificate validation, expiry detection | 0.5 |
| Mobile responsiveness check | Playwright viewport rendering + analysis | 1 |
| Tech stack detection | Regex-based + header analysis | 0.5 |
| Content freshness check | Copyright year extraction, Last-Modified header | 0.5 |
| Combined audit pipeline | Run all checks in parallel per business | 0.5 |
| Lead scoring algorithm | Composite score calculation, tier assignment | 1 |
| **Testing**: Audit 200 leads end-to-end | Validate scoring accuracy, tune weights | 1 |

**Deliverable**: Full audit pipeline that scores leads 0-100 and assigns tiers.

### Phase 3: Enrichment + Outreach Prep (Week 3-4)

**Goal**: Find contact info and prepare personalized outreach.

| Task | Details | Days |
|---|---|---|
| Website contact scraper | Crawl /contact, /about for emails and names | 1.5 |
| Hunter.io API integration | Fallback email finding by domain | 0.5 |
| Social profile extraction | Facebook, Instagram, LinkedIn URL scraping | 0.5 |
| Email template system | Jinja2 templates with dynamic audit variables | 1 |
| Audit PDF generator | WeasyPrint HTML-to-PDF branded report | 1.5 |
| Instantly.ai integration | API setup, campaign creation, lead upload | 1 |
| Follow-up sequence design | 5-email sequence with timing logic | 0.5 |
| **Testing**: Full pipeline run on 50 leads | Verify enrichment quality, email deliverability | 1 |

**Deliverable**: End-to-end pipeline from scrape to outreach-ready.

### Phase 4: Automation + Scheduling (Week 4-5)

**Goal**: Make it run unattended on a schedule.

| Task | Details | Days |
|---|---|---|
| Celery + Redis setup | Task queue for async processing | 1 |
| Celery Beat scheduler | Nightly cron jobs for full pipeline | 0.5 |
| Pipeline orchestrator | Chain tasks: scrape → triage → audit → score → enrich → queue | 1 |
| Error handling + retries | Graceful failure, retry logic, alerting | 1 |
| Daily summary email | Send yourself a report: new leads, top scores, outreach stats | 0.5 |
| Monitoring + logging | Structured logging, error tracking | 0.5 |
| Deploy to VPS | DigitalOcean/Railway deployment, systemd services | 1 |
| **Testing**: Run automated for 5 days, monitor | Fix issues, tune performance | 2 |

**Deliverable**: Fully automated system running nightly, producing outreach-ready leads.

### Phase 5: Channel 2 — LLC Filing Pipeline (Week 5-7)

**Goal**: Add the LLC filing interception channel alongside the running Google Maps pipeline.

| Task | Details | Days |
|---|---|---|
| Cobalt Intelligence API integration | Auth, search endpoint, response parsing | 1 |
| State-specific scrapers (FL, TX, CA) | Playwright scrapers for high-volume states as Cobalt alternative | 2 |
| Entity name classifier | NLP/regex to classify customer-facing vs. holding co | 1 |
| LLC scoring algorithm | Score 0-100 based on entity name, recency, address, niche | 0.5 |
| Google Maps cross-reference | Check if new LLC already has a Maps listing | 0.5 |
| Skip tracing integration | Snov.io API for finding owner email by name | 1 |
| LinkedIn search URL generator | Auto-generate search URLs + connection note templates | 0.5 |
| Lob.com postcard integration | API setup, HTML template, automated sending | 1.5 |
| Lob.com letter integration | Template for HOT leads, API integration | 1 |
| LLC outreach orchestrator | Chain tasks: fetch → classify → score → enrich → mail | 1 |
| Celery tasks for Channel 2 | Nightly jobs for LLC pipeline alongside Maps pipeline | 0.5 |
| Dedup cross-channel | Prevent contacting same business through both channels | 0.5 |
| **Testing**: Run on 100 filings end-to-end | Verify classification accuracy, mail delivery, enrichment quality | 2 |

**Deliverable**: Fully automated LLC filing pipeline that mails postcards and LinkedIn suggestions daily.

### Phase 6: Dashboard + Optimization (Week 7-9) — Optional

**Goal**: Visual interface to monitor and manage leads from both channels.

| Task | Details | Days |
|---|---|---|
| Next.js dashboard | Lead list, search, filters, score display | 3 |
| Lead detail page | Full audit results, enrichment data, outreach history | 2 |
| LLC filing view | Filing details, classification, mail status, LinkedIn status | 1.5 |
| Pipeline stats | Charts: leads/day, scores distribution, reply rates, channel breakdown | 1.5 |
| Search config editor | Add/edit niches, locations, and LLC state configs via UI | 1 |
| Score weight tuning | Adjust scoring weights for both channels via UI | 0.5 |
| Direct mail tracker | View postcard/letter statuses, delivery confirmations | 1 |

**Deliverable**: Admin dashboard for managing both lead channels.

---

## 20. File & Folder Structure

```
nwsmedia_clients/
├── README.md
├── pyproject.toml                    # Dependencies (Poetry)
├── .env                              # API keys, DB URL, secrets
├── .env.example                      # Template for .env
├── alembic/                          # Database migrations
│   ├── alembic.ini
│   └── versions/
├── src/
│   ├── __init__.py
│   ├── config.py                     # Settings from .env
│   ├── database.py                   # SQLAlchemy engine + session
│   │
│   ├── models/                       # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── business.py               # Google Maps business model
│   │   ├── triage.py
│   │   ├── audit.py
│   │   ├── score.py
│   │   ├── enrichment.py
│   │   ├── outreach.py
│   │   ├── search_config.py
│   │   ├── llc_filing.py             # LLC filing model (Channel 2)
│   │   ├── llc_filing_config.py      # LLC state config model
│   │   └── direct_mail.py            # Direct mail tracking model
│   │
│   │── ─── CHANNEL 1: GOOGLE MAPS + AUDIT ───
│   │
│   ├── scraper/                      # Layer 1A: Google Maps scraping
│   │   ├── __init__.py
│   │   ├── google_maps.py            # Playwright-based Maps scraper
│   │   ├── parsers.py                # HTML parsing helpers
│   │   ├── anti_detection.py         # Proxy rotation, fingerprinting
│   │   └── deduplication.py          # place_id dedup logic
│   ├── triage/                       # Layer 2: Website triage
│   │   ├── __init__.py
│   │   ├── url_checker.py            # HTTP reachability checks
│   │   ├── subdomain_detector.py     # Free subdomain patterns
│   │   └── classifier.py             # Triage classification logic
│   ├── audit/                        # Layer 3: Website auditing
│   │   ├── __init__.py
│   │   ├── pagespeed.py              # PageSpeed Insights API client
│   │   ├── ssl_checker.py            # SSL certificate validation
│   │   ├── mobile_check.py           # Mobile responsiveness analysis
│   │   ├── tech_detector.py          # Technology stack detection
│   │   ├── freshness.py              # Content freshness checks
│   │   └── runner.py                 # Combined audit orchestrator
│   ├── scoring/                      # Layer 4: Lead scoring
│   │   ├── __init__.py
│   │   └── calculator.py             # Scoring formula + tier assignment
│   ├── enrichment/                   # Layer 5: Contact enrichment
│   │   ├── __init__.py
│   │   ├── website_scraper.py        # Email/name/social from website
│   │   ├── hunter.py                 # Hunter.io API client
│   │   └── pipeline.py               # Combined enrichment pipeline
│   ├── outreach/                     # Layer 6 + 7: Outreach
│   │   ├── __init__.py
│   │   ├── templates.py              # Jinja2 email template rendering
│   │   ├── pdf_generator.py          # WeasyPrint audit PDF creation
│   │   ├── instantly.py              # Instantly.ai API client
│   │   └── campaign_manager.py       # Campaign creation + lead upload
│   │
│   │── ─── CHANNEL 2: LLC FILING INTERCEPTION ───
│   │
│   ├── llc/                          # Layer 1B: LLC filing pipeline
│   │   ├── __init__.py
│   │   ├── cobalt_client.py          # Cobalt Intelligence API client
│   │   ├── state_scrapers/           # Per-state Playwright scrapers
│   │   │   ├── __init__.py
│   │   │   ├── florida.py            # Sunbiz daily feed parser
│   │   │   ├── texas.py              # SOSDirect scraper
│   │   │   └── california.py         # Bizfile API client
│   │   ├── entity_classifier.py      # NLP/regex entity name analysis
│   │   ├── llc_scorer.py             # LLC-specific scoring algorithm
│   │   ├── maps_crossref.py          # Google Places cross-reference
│   │   ├── skip_tracer.py            # Snov.io email finder by name
│   │   ├── linkedin_lookup.py        # LinkedIn search URL + note generator
│   │   └── deduplication.py          # Cross-channel dedup logic
│   ├── direct_mail/                  # LLC outreach via physical mail
│   │   ├── __init__.py
│   │   ├── lob_client.py             # Lob.com API integration
│   │   ├── postcard_renderer.py      # HTML postcard template rendering
│   │   ├── letter_renderer.py        # HTML letter template rendering
│   │   └── mail_manager.py           # Orchestrate postcard + letter sending
│   │
│   │── ─── SHARED INFRASTRUCTURE ───
│   │
│   ├── pipeline/                     # Orchestration for both channels
│   │   ├── __init__.py
│   │   ├── maps_orchestrator.py      # Channel 1: scrape → outreach
│   │   ├── llc_orchestrator.py       # Channel 2: fetch → classify → mail
│   │   └── tasks.py                  # Celery task definitions (both channels)
│   └── utils/                        # Shared utilities
│       ├── __init__.py
│       ├── proxy.py                  # Proxy pool management
│       ├── rate_limiter.py           # API rate limiting
│       └── logging.py                # Structured logging setup
│
├── templates/                        # Email + PDF + mail templates
│   ├── emails/                       # Channel 1 cold email templates
│   │   ├── initial_outreach.jinja2
│   │   ├── follow_up_1.jinja2
│   │   ├── follow_up_2.jinja2
│   │   ├── follow_up_3.jinja2
│   │   └── breakup.jinja2
│   ├── llc_emails/                   # Channel 2 cold email templates
│   │   ├── llc_welcome.jinja2
│   │   ├── llc_follow_up_1.jinja2
│   │   └── llc_breakup.jinja2
│   ├── direct_mail/                  # Channel 2 physical mail templates
│   │   ├── postcard_front.html
│   │   ├── postcard_back.html
│   │   └── welcome_letter.html
│   ├── linkedin/                     # Channel 2 LinkedIn message templates
│   │   ├── connection_request.txt
│   │   ├── first_message.txt
│   │   ├── follow_up.txt
│   │   └── soft_close.txt
│   └── reports/
│       └── audit_report.html         # PDF report HTML template
│
├── reports/                          # Generated audit PDFs (gitignored)
├── scripts/
│   ├── run_scraper.py                # CLI: run Maps scraper
│   ├── run_audit.py                  # CLI: run website audits
│   ├── run_maps_pipeline.py          # CLI: run full Channel 1 pipeline
│   ├── run_llc_pipeline.py           # CLI: run full Channel 2 pipeline
│   ├── run_both.py                   # CLI: run both channels
│   ├── seed_search_configs.py        # Seed initial niches + locations
│   └── seed_llc_configs.py           # Seed initial LLC state configs
├── tests/
│   ├── test_scraper.py
│   ├── test_triage.py
│   ├── test_audit.py
│   ├── test_scoring.py
│   ├── test_enrichment.py
│   ├── test_llc_classifier.py        # Entity name classification tests
│   ├── test_llc_scorer.py            # LLC scoring tests
│   ├── test_llc_enrichment.py        # Skip tracing + Maps cross-ref tests
│   └── test_direct_mail.py           # Lob.com integration tests
├── docker-compose.yml                # PostgreSQL + Redis for local dev
├── Dockerfile                        # Production container
└── celeryconfig.py                   # Celery worker configuration
```

---

## 21. Projected Performance Metrics

### Channel 1 Pipeline Throughput (Google Maps)

| Stage | Time Per Lead | Daily Capacity (24hr) | Bottleneck |
|---|---|---|---|
| Maps Scraping | 3-5 sec | 500-1,000 | Anti-detection delays |
| Triage | 0.5-2 sec | 10,000+ | URL timeout waits |
| Website Audit | 15-30 sec | 2,800-5,700 | PageSpeed API latency |
| Scoring | <0.01 sec | Unlimited | CPU-bound, instant |
| Enrichment | 3-8 sec | 5,000-10,000 | Website crawl time |
| Outreach Queue | <0.5 sec | Unlimited | API call |

**End-to-end per lead**: ~25-45 seconds (parallel processing cuts this to ~15-20s)
**Daily throughput**: 500-1,000 fully processed leads per 24hr cycle

### Channel 2 Pipeline Throughput (LLC Filings)

| Stage | Time Per Lead | Daily Capacity (24hr) | Bottleneck |
|---|---|---|---|
| LLC Filing Fetch | 0.5-2 sec | 5,000-10,000 | API rate limits |
| Entity Classification | <0.01 sec | Unlimited | CPU-bound, instant |
| LLC Scoring | <0.01 sec | Unlimited | CPU-bound, instant |
| Maps Cross-Reference | 1-3 sec | 2,000-5,000 | Google Places API quota |
| Skip Tracing (email) | 2-5 sec | 1,000-3,000 | Snov.io rate limit |
| LinkedIn URL Gen | <0.01 sec | Unlimited | CPU-bound, instant |
| Direct Mail (Lob API) | 0.5-1 sec | 10,000+ | Lob.com rate limit (300/min) |

**End-to-end per lead**: ~5-12 seconds
**Daily throughput**: 200-500 LLC leads processed per day (limited by filing volume, not speed)

### Channel 1 Conversion Funnel

```
1,000 businesses scraped from Google Maps
  └─ 700 pass triage (have issues or no website)
      └─ 500 score 40+ (worth contacting)
          └─ 300 have email found (contactable)
              └─ 300 emails sent
                  └─ 15-24 replies (5-8% reply rate)
                      └─ 5-8 meetings booked
                          └─ 1-2 clients closed
                              └─ $4,000-$10,000 revenue
```

### Channel 2 Conversion Funnel

```
500 LLC filings pulled (per state per week)
  └─ 175 pass filter (customer-facing, not holding cos)
      └─ 100 score 45+ (worth contacting)
          └─ 100 postcards mailed (always have mailing address)
          └─ 35 emails sent (found via skip tracing)
          └─ 60 LinkedIn requests sent
              └─ Postcards: 2-5 responses (2-5% response rate)
              └─ Emails: 1-2 replies (3-5% reply rate)
              └─ LinkedIn: 2-4 conversations started
                  └─ 5-11 total conversations
                      └─ 3-6 meetings booked (higher conversion — warm)
                          └─ 1-2 clients closed
                              └─ $3,000-$8,000 revenue
```

### Combined Funnel (Both Channels per Month)

```
Channel 1: 5,000 Maps leads → 1,250 emails → 50-100 replies → 15-30 meetings → 2-5 clients
Channel 2: 2,000 LLC filings → 400 postcards + 140 emails + 240 LinkedIn → 20-44 conversations → 12-24 meetings → 2-5 clients
─────────────────────────────────────────────────────────────────────────────────
COMBINED: 7,000 leads processed → 27-54 meetings → 4-10 clients → $16K-$50K revenue
Monthly cost: $260-$450
```

**Per 1,000 Maps leads**: Revenue $4,000-$10,000, Cost ~$5-$15
**Per 500 LLC filings**: Revenue $3,000-$8,000, Cost ~$80-$150 (includes postage)
**Combined ROI**: 5,000-15,000%

---

## 22. Maintenance & Scaling

### Weekly Maintenance Tasks

| Task | Time | Frequency |
|---|---|---|
| Check Maps scraper health (blocked IPs, CAPTCHA rate) | 15 min | Weekly |
| Check LLC filing pipeline (API errors, new state formats) | 10 min | Weekly |
| Review lead quality samples (both channels) | 15 min | Weekly |
| Review direct mail delivery/return rates | 10 min | Weekly |
| Tune scoring weights based on reply/close data | 15 min | Monthly |
| Update free subdomain patterns | 10 min | Monthly |
| Update entity name classifier patterns | 10 min | Monthly |
| Rotate sending domains if deliverability drops | 15 min | Monthly |
| Update Playwright / browser version | 10 min | Monthly |
| Review LLC skip tracing hit rates | 10 min | Monthly |

### Scaling Strategies

| Bottleneck | Solution |
|---|---|
| Maps scraping speed | Add more proxy IPs, run parallel browser instances |
| Audit throughput | Multiple PageSpeed API keys (25K each/day) |
| Email sending limits | Add more sending accounts + domains |
| LLC filing coverage | Add more states to config (no code changes) |
| Direct mail volume | Lob.com scales automatically, or switch to bulk USPS |
| Skip tracing hit rate | Add additional email sources (Voila Norbert, Clearbit) |
| Database size | Partition tables by date, archive old leads |
| Geographic coverage | Add more search/LLC configs, no code changes needed |

### When to Upgrade

| Milestone | Action |
|---|---|
| 10K leads in DB | Add database indexes, optimize queries |
| 50K leads in DB | Consider read replicas or Supabase pro |
| 5+ sending domains | Dedicated email infrastructure (Amazon SES) |
| 500+ postcards/mo | Negotiate bulk rate with Lob.com or switch to PostcardMania |
| 10+ states tracked | Consider Cobalt Intelligence annual plan for volume discounts |
| $10K+/mo revenue from pipeline | Hire VA to handle meeting booking + follow-ups |
| $30K+/mo revenue from pipeline | Build the Next.js dashboard, hire closer |
| $50K+/mo revenue from pipeline | Add cold calling channel for highest-score leads |

---

## 23. Risks & Mitigations

Every system has failure points. Here's what can go wrong and how to handle it:

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Google blocks scraping** — Maps changes their DOM structure, CAPTCHAs increase, or IPs get banned faster | HIGH | HIGH | Use Outscraper API as fallback ($2/1K results). Keep custom scraper as primary but have a managed backup ready. Rotate proxies more aggressively. Monitor block rate weekly. |
| **PageSpeed API rate limit hit** — You exceed 25K calls/day | LOW | MEDIUM | Create multiple Google Cloud projects for separate API keys. Batch audits during off-peak hours. Cache audit results (don't re-audit same URL within 30 days). |
| **Email deliverability drops** — Emails land in spam | MEDIUM | HIGH | Use Instantly.ai's built-in warmup. Keep volume under 50/day per sending account. Use 3-5 sending accounts. Rotate sending domains every 3-6 months. Monitor open rates — if they drop below 30%, pause and investigate. |
| **Lob.com postcards returned** — Bad addresses from LLC filings | MEDIUM | LOW | Lob.com validates addresses before mailing. Budget for 5-10% return rate. Use USPS Address Verification API for pre-screening. Track returns and auto-blacklist bad addresses. |
| **State SOS website changes format** — Custom scrapers break | MEDIUM | MEDIUM | Use Cobalt Intelligence API as primary (they maintain the scrapers). Only build custom scrapers for cost savings on highest-volume states. Monitor daily for parse errors. |
| **Database grows too large** — Slow queries after 50K+ leads | LOW | MEDIUM | Indexes already defined in schema. Partition tables by date after 100K rows. Archive leads older than 12 months to a separate table. |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Low reply rates** — Emails/postcards don't convert as projected | MEDIUM | HIGH | A/B test subject lines, email copy, and postcard designs. Increase personalization (add screenshots, mention specific review quotes). Focus on HOT leads first. If reply rate is below 2% after 1,000 emails, revisit your messaging and scoring weights. |
| **Leads don't close** — Meetings happen but deals don't sign | MEDIUM | HIGH | This is a sales problem, not a lead gen problem. Create a standardized discovery call script. Offer a free mockup or mini-audit as a closer. Consider hiring a salesperson/closer when pipeline is strong but close rate is low. |
| **Clients churn after first project** — One-time revenue only | MEDIUM | MEDIUM | Offer monthly maintenance/hosting packages ($50-$200/mo). Build upsell paths: SEO, Google Ads management, social media. Design a referral program from day 1. |
| **Legal action from Google** — Cease & desist for Maps scraping | VERY LOW | HIGH | No precedent for Google suing small-scale scrapers of public business data. hiQ v. LinkedIn protects public data scraping. Worst case: switch to 100% Outscraper/managed API (fully legal, just costs more). |
| **Market saturation** — Other agencies start using this method | LOW | MEDIUM | Your advantage is that you're doing it NOW, before it's common. First-mover advantage in each local market is huge. Also, your audit data and scoring make your outreach unique — even if others scrape Maps, they won't have your system. |

### Mitigation Priority Order

1. **Set up Outscraper as fallback on day 1** — takes 10 minutes, costs nothing until you use it
2. **Use Instantly.ai's warmup from the start** — never send cold without warmup
3. **A/B test email templates by week 3** — don't run one template for months
4. **Monitor block rate and deliverability weekly** — 15 minutes of prevention saves days of recovery
5. **Design a close process before leads start flowing** — the pipeline is useless without a sales process

---

## 24. KPIs & Success Metrics

### What to Track Daily (Automated in Dashboard)

| KPI | Target | Red Flag |
|---|---|---|
| Leads scraped (Ch1) | 200-500/day | <100/day (scraper may be blocked) |
| LLC filings pulled (Ch2) | 50-150/day | <30/day (API issue or state site down) |
| Audit completion rate | >90% | <70% (PageSpeed API issues or timeout errors) |
| Emails queued | 50-150/day | <30/day (enrichment pipeline bottleneck) |
| Postcards queued (Ch2) | 5-25/day | <3/day (scoring too restrictive or filing volume low) |

### What to Track Weekly

| KPI | Target (Starter) | Target (Growth) | Red Flag |
|---|---|---|---|
| Email open rate | >45% | >50% | <30% (deliverability problem) |
| Email reply rate | >4% | >6% | <2% (messaging problem) |
| Postcard response rate | >2% | >3% | <1% (design or targeting problem) |
| LinkedIn connection acceptance | >25% | >35% | <15% (note quality problem) |
| Meetings booked | 4-8/week | 12-20/week | <2/week (funnel leak) |
| Scoring filter rate | 40-60% pass | 40-60% pass | >80% pass (scoring too lenient) |
| Email bounce rate | <3% | <3% | >5% (bad data or list quality) |

### What to Track Monthly

| KPI | Target | What It Tells You |
|---|---|---|
| **Cost per acquisition (CPA)** | <$75 | How efficiently the system generates clients |
| **Close rate** (meetings → clients) | >15% | How effective your sales process is |
| **Average project value** | >$3,500 | Whether you're targeting the right niches |
| **Revenue per 1,000 leads scraped** | >$3,000 | Overall pipeline efficiency |
| **Channel 1 vs Channel 2 ROI** | Both positive | Whether both channels are worth running |
| **LLC entity classification accuracy** | >85% | Whether the NLP filter is working correctly |
| **Skip tracing hit rate** | >30% | Whether enrichment sources are performing |
| **Direct mail return rate** | <10% | Address quality from LLC filings |
| **Pipeline velocity** (lead → client days) | <30 days (Ch1), <45 days (Ch2) | How fast leads convert |

### Monthly Reporting Template

Generate this automatically and email to yourself on the 1st of each month:

```
NWS MEDIA — LEAD ENGINE MONTHLY REPORT
Month: [Month Year]

═══ PIPELINE VOLUME ═══
Channel 1 (Maps):     [X] scraped → [X] qualified → [X] emailed
Channel 2 (LLC):      [X] pulled  → [X] qualified → [X] contacted

═══ OUTREACH PERFORMANCE ═══
Emails sent:          [X]     Open rate: [X]%    Reply rate: [X]%
Postcards mailed:     [X]     Response rate: [X]%
LinkedIn requests:    [X]     Acceptance: [X]%

═══ SALES RESULTS ═══
Meetings booked:      [X]     (Ch1: [X], Ch2: [X])
Proposals sent:       [X]
Clients closed:       [X]     Close rate: [X]%

═══ FINANCIALS ═══
Operating cost:       $[X]
Revenue generated:    $[X]
Profit:               $[X]
CPA:                  $[X]
ROI:                  [X]%

═══ TOP LEADS THIS MONTH ═══
1. [Business Name] — Score: [X] — [Status]
2. [Business Name] — Score: [X] — [Status]
3. [Business Name] — Score: [X] — [Status]

═══ ACTION ITEMS ═══
- [Anything that needs manual attention]
```

---

## 25. Prerequisites & Setup Checklist

Everything you need before writing the first line of code:

### Accounts to Create (All Free)

- [ ] **Google Cloud Console** account — for PageSpeed + Places API keys
  - Create project → Enable PageSpeed Insights API → Enable Places API → Generate API key
  - URL: https://console.cloud.google.com
- [ ] **Bright Data** account — residential proxy access
  - URL: https://brightdata.com
- [ ] **2Captcha** account — CAPTCHA solving service
  - URL: https://2captcha.com
- [ ] **Hunter.io** account — email finder (25 free/month)
  - URL: https://hunter.io
- [ ] **Instantly.ai** account — cold email sending + warmup
  - URL: https://instantly.ai
- [ ] **Cobalt Intelligence** account — LLC filing data (free trial)
  - URL: https://cobaltintelligence.com
- [ ] **Snov.io** account — skip tracing (50 free/month)
  - URL: https://snov.io
- [ ] **Lob.com** account — direct mail API (pay-per-use)
  - URL: https://lob.com
- [ ] **DigitalOcean** or **Railway** account — VPS hosting
  - URL: https://digitalocean.com or https://railway.app
- [ ] **Supabase** or **Neon** account — managed PostgreSQL (free tier)
  - URL: https://supabase.com or https://neon.tech
- [ ] **GitHub** repository — version control for the codebase
  - Create repo: `nwsmedia-lead-engine` (private)

### Domains & Email Setup

- [ ] Register a **sending domain** (NOT nwsmedia.com) for cold email
  - Example: `nwswebdesign.com` or `nwsdigital.com`
  - Cost: $12/year on Namecheap, Cloudflare, or Google Domains
- [ ] Set up **Google Workspace** on sending domain ($7/mo)
  - Create 3-5 email accounts: `firstname@sendingdomain.com`
- [ ] Configure **SPF, DKIM, and DMARC** records on sending domain
  - Required for email deliverability — Instantly.ai provides setup guides
- [ ] Connect sending accounts to **Instantly.ai** and start warmup
  - Warmup takes 2-3 weeks — start this ASAP, even before building the pipeline

### Local Development Setup

- [ ] **Python 3.12+** installed
- [ ] **Poetry** or **pip** for dependency management
- [ ] **Docker** installed (for local PostgreSQL + Redis)
- [ ] **Playwright** browsers installed: `playwright install chromium`
- [ ] **Git** configured and repo cloned

### Business Prep (Do While Building)

- [ ] Define your **top 3 niches** to target first (dentists, contractors, restaurants, etc.)
- [ ] Define your **geographic focus** (your city + surrounding area)
- [ ] Create a **booking link** for discovery calls (Calendly free tier works)
  - URL: https://calendly.com
- [ ] Prepare a **discovery call script** (what to ask, what to offer)
- [ ] Set your **pricing** for web design projects (know your floor and target)
- [ ] Create a **portfolio page** with 3-5 example sites (even mockups count)
- [ ] Prepare a **case study** or before/after example for outreach emails
- [ ] Set up a **CRM column/board** for tracking leads through the sales process
  - Can be as simple as a Notion board or Trello board while the pipeline DB is being built
- [ ] Decide on your **physical return address** for direct mail (required on postcards)

### Pre-Launch Checklist (Before First Outreach)

- [ ] Email warmup running for at least **14 days** (21 preferred)
- [ ] Test run: scrape **100 businesses**, audit them, generate **5 sample emails**
- [ ] Review sample emails for tone, accuracy, and personalization quality
- [ ] Send **10 test emails** to yourself and friends — check inbox placement
- [ ] Create a **test postcard** on Lob.com (they have a test mode) — verify formatting
- [ ] Verify all **API keys** are working and rate limits are understood
- [ ] Set up **error alerting** (email notification if pipeline fails)
- [ ] Confirm **unsubscribe mechanism** works in email templates

---

## Appendix A: Environment Variables

```bash
# .env file — NEVER commit this to git

# ============================================
# SHARED INFRASTRUCTURE
# ============================================

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/nwsmedia_leads

# Redis
REDIS_URL=redis://localhost:6379/0

# ============================================
# CHANNEL 1: GOOGLE MAPS + AUDIT
# ============================================

# Google APIs
GOOGLE_PAGESPEED_API_KEY=your_key_here
GOOGLE_PLACES_API_KEY=your_key_here

# Proxies (for Maps scraping)
BRIGHT_DATA_PROXY_URL=http://user:pass@brd.superproxy.io:22225
CAPTCHA_API_KEY=your_2captcha_key

# Email Enrichment
HUNTER_API_KEY=your_hunter_key

# Cold Email Outreach
INSTANTLY_API_KEY=your_instantly_key
INSTANTLY_CAMPAIGN_ID_MAPS=your_maps_campaign_id

# ============================================
# CHANNEL 2: LLC FILINGS + DIRECT MAIL
# ============================================

# LLC Filing Data
COBALT_API_KEY=your_cobalt_key
CA_BIZFILE_API_KEY=your_california_key    # Optional: CA direct access

# Skip Tracing
SNOV_API_KEY=your_snov_key

# Direct Mail
LOB_API_KEY=your_lob_key
LOB_API_KEY_TEST=your_lob_test_key        # Use test key during development

# LLC Cold Email (separate campaign)
INSTANTLY_CAMPAIGN_ID_LLC=your_llc_campaign_id

# ============================================
# SENDER IDENTITY (Both Channels)
# ============================================

SENDER_NAME="Your Name"
SENDER_TITLE="Founder"
SENDER_PHONE="+1 (555) 000-0000"
SENDER_COMPANY="NWS Media"

# Return address for direct mail
RETURN_ADDRESS_LINE1="123 Your Street"
RETURN_ADDRESS_CITY="Your City"
RETURN_ADDRESS_STATE="TX"
RETURN_ADDRESS_ZIP="78701"
```

---

*This document is the complete technical blueprint for the NWS Media dual-channel automated lead generation engine. It covers system architecture, implementation code, database design, financial projections, legal compliance, risk assessment, KPI tracking, and a pre-launch checklist. Channel 1 (Google Maps + Website Audit) and Channel 2 (LLC Filing Interception + Direct Mail) will both be implemented as working code in the `nwsmedia_clients` repository.*
