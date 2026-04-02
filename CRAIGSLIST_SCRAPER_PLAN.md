# Craigslist Services Scraper — Implementation Plan

## Overview

Add a **Craigslist services listing scraper** as a second lead source alongside the existing Google Maps scraper. Craigslist "services" posts (`/search/bbb`) are placed by local businesses actively advertising — painters, landscapers, cleaners, handymen, etc. These are high-intent leads: they're already spending effort to find customers but almost never have a proper web presence.

Once scraped, Craigslist leads land in the same `businesses` table and flow through the existing pipeline (triage → audit → score → enrich → outreach) with zero changes to downstream logic.

---

## 1. Craigslist Services URL Structure

Craigslist services live at:

```
https://{city}.craigslist.org/search/{category_code}
```

### City Subdomains (examples)

| City               | Subdomain       |
|--------------------|-----------------|
| San Antonio, TX    | `sanantonio`    |
| Denver, CO         | `denver`        |
| Tampa, FL          | `tampa`         |
| Austin, TX         | `austin`        |
| Nashville, TN      | `nashville`     |
| Orlando, FL        | `orlando`       |
| Houston, TX        | `houston`       |
| Phoenix, AZ        | `phoenix`       |

### Service Category Codes

| Code  | Category                |
|-------|-------------------------|
| `bbb` | All services            |
| `bbs` | Small biz ads           |
| `cps` | Computer services       |
| `crs` | Creative services       |
| `cys` | Cycle services          |
| `evs` | Event services          |
| `fgs` | Farm & garden services  |
| `fns` | Financial services      |
| `hss` | Household services      |
| `lbs` | Legal services          |
| `lgs` | Lessons & tutoring      |
| `mas` | Marine services         |
| `pas` | Pet services            |
| `rts` | Real estate services    |
| `sks` | Skilled trade services  |
| `trs` | Travel/vacation         |

### Search Parameters

- `query=landscaping` — keyword filter
- `s=120` — pagination offset (results per page ≈ 120)
- `sort=date` — sort by newest
- `postedToday=1` — only today's posts

**Example full URL:**
```
https://sanantonio.craigslist.org/search/bbb?query=landscaping&sort=date
```

---

## 2. New Module Structure

```
src/scraper/craigslist/
├── __init__.py          # scrape_craigslist() + save logic — main orchestration
├── parsers.py           # parse_listing_index(), parse_listing_detail()
├── deduplication.py     # CL-specific dedup (post ID + name+phone cross-source)
├── urls.py              # City subdomain mapping + URL builder
```

No separate `anti_detection.py` — we reuse the existing `src/scraper/anti_detection.py` module (Playwright stealth, proxy, delays) and `src/utils/proxy.py` (Bright Data, UA rotation).

---

## 3. Scraper Flow (Step-by-Step)

### Step 1 — Build Search URLs (`urls.py`)

- Map each target city to its CL subdomain (e.g. `"San Antonio, TX" → "sanantonio"`)
- Build URL: `https://{subdomain}.craigslist.org/search/{category}?query={keyword}&sort=date`
- Support optional `postedToday=1` flag to only get fresh posts

### Step 2 — Scrape Listing Index Pages (`__init__.py` + `parsers.py`)

Use Playwright (reuse `create_stealth_browser()` from `src/scraper/anti_detection.py`):

1. Navigate to search URL
2. Wait for results container to load
3. Parse each listing row to extract:
   - **Title** (the ad headline)
   - **Listing URL** (link to detail page)
   - **Post date** (relative or absolute)
   - **Neighborhood/area** (if shown)
   - **CL post ID** (from the URL, e.g. `/d/landscaping/7890123456.html` → `7890123456`)
4. Handle pagination — increment `s=` offset, stop at configured max pages or when no more results
5. Respect configured delays between page loads (3–8 seconds, random)

### Step 3 — Scrape Individual Listing Detail Pages (`parsers.py`)

For each listing URL, navigate and extract:

| Field              | Where to Find It                                          |
|--------------------|-----------------------------------------------------------|
| **Description**    | `<section id="postingbody">` — full ad text               |
| **Phone number**   | Regex on description body (`\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b`) |
| **Email**          | `mailto:` links, or email regex in body text              |
| **Posted date**    | `<time class="date timeago">` element                     |
| **Location/map**   | `<div id="map">` data attributes (lat/lng), or text area  |
| **Images**         | `<div id="thumbs">` image count                          |
| **CL reply link**  | The anonymized `reply@` address (fallback contact method)  |
| **Business name**  | Heuristic: first line of body, or extract from title       |

**Business name extraction heuristic:**
CL listings don't have a structured "business name" field. Strategy:
1. Check if the title starts with a company-sounding name (e.g. "ABC Landscaping - ...")
2. Look for patterns like "Call [Name]" or "[Company] LLC" in the body
3. Fall back to the listing title as the name

### Step 4 — Normalize & Deduplicate (`deduplication.py`)

Two layers of dedup (mirrors the Google Maps pattern):

1. **CL post ID dedup** — `place_id = "cl:{post_id}"` checked against existing `businesses.place_id`
2. **Cross-source name+phone / name+city dedup** — reuse `normalize_name()` and `normalize_phone()` from `src/scraper/deduplication.py` to catch businesses already found via Google Maps

Within-batch dedup: same poster often re-posts the same ad daily. Deduplicate by phone number or normalized title within the current scrape batch.

### Step 5 — Save to Database

Save to existing `businesses` table via the same pattern as `save_businesses()` in `google_maps.py`:

```python
Business(
    place_id="cl:{post_id}",          # CL post ID prefixed to avoid collision with Maps IDs
    source_channel="craigslist",       # distinguishes from "google_maps"
    name=extracted_name,               # from heuristic extraction
    category=service_category,         # e.g. "Household services" or the keyword
    address=neighborhood,              # from CL area tag
    city=city,                         # from the target city config
    state=state,                       # from the target city config
    zip_code=None,                     # CL rarely provides zip
    phone=phone,                       # extracted from body text
    email=email,                       # extracted from body text or mailto
    website=website,                   # if found in body text
    rating=None,                       # CL has no ratings
    review_count=0,                    # CL has no reviews
    maps_url=listing_url,              # repurpose for the CL listing URL
    scraped_at=now,
)
```

---

## 4. Database Schema Changes

The current `Business` model (`src/models/business.py`) needs minor adjustments:

### Option A: Add New Columns (Recommended)

| Column                | Type       | Purpose                                              |
|-----------------------|------------|------------------------------------------------------|
| `source_url`          | `Text`     | The original listing URL (CL, Maps, etc.)            |
| `source_listing_id`   | `String`   | Raw source ID (CL post ID, Maps place ID) for dedup  |
| `listing_description` | `Text`     | Full ad body text (useful for scoring/qualifying)     |

### Option B: Reuse Existing Columns (Minimal Change)

- `maps_url` → store the CL listing URL (already `Text`, nullable)
- `place_id` → store `"cl:{post_id}"` (already works, just a string)
- Skip description storage for now

**Recommendation:** Go with **Option A** for `source_url` and `listing_description` — they'll be valuable for lead qualification and scoring. The `source_listing_id` is nice-to-have but `place_id` with a `cl:` prefix already handles dedup.

### Migration

Create Alembic migration: `alembic revision --autogenerate -m "add_craigslist_fields"`

```python
# New nullable columns — no impact on existing rows
op.add_column("businesses", sa.Column("source_url", sa.Text(), nullable=True))
op.add_column("businesses", sa.Column("listing_description", sa.Text(), nullable=True))
```

### place_id Constraint

The current model has `place_id: unique=True, nullable=False`. CL posts will use `"cl:{post_id}"` as the place_id, so no constraint changes needed. The `cl:` prefix guarantees no collision with Google Maps place IDs (which start with `0x` or `ChIJ`).

---

## 5. Anti-Detection Strategy

Craigslist is **more aggressive about blocking scrapers** than Google Maps. Plan:

| Measure                   | Implementation                                                       |
|---------------------------|----------------------------------------------------------------------|
| **Proxy rotation**        | Reuse Bright Data via `src/utils/proxy.py` — already configured      |
| **Browser stealth**       | Reuse `create_stealth_browser()` — Playwright + playwright-stealth   |
| **Rate limiting**         | 3–8 sec random delay between detail pages, 5–15 sec between index pages |
| **Session rotation**      | New browser context every ~20 requests                               |
| **UA rotation**           | Already handled by `random_user_agent()` in proxy.py                 |
| **Viewport rotation**     | Already handled by `random_viewport()` in proxy.py                   |
| **Respect cooldowns**     | If CL returns a CAPTCHA/block page, back off for 60–120 seconds      |
| **Cookie acceptance**     | Handle any CL consent banners on first load                          |

### CL-Specific Gotchas

- **IP bans:** CL blocks IPs after relatively few requests (~50–100 without proxy). Bright Data residential proxies are essential.
- **CAPTCHAs:** CL shows CAPTCHAs after suspicious activity. Detect the CAPTCHA page (`<div id="recaptcha">`) and either wait/rotate or integrate a CAPTCHA solver (e.g. using existing `captcha_api_key` in config).
- **Rate limit headers:** CL may return 429 status. Detect and exponentially back off.

---

## 6. Configuration

### New Settings in `src/config.py`

Add to the `Settings` class:

```python
# Channel 3: Craigslist Services
craigslist_max_pages: int = 3
craigslist_delay_min: float = 3.0
craigslist_delay_max: float = 8.0
craigslist_page_delay_min: float = 5.0
craigslist_page_delay_max: float = 15.0
craigslist_session_rotate_every: int = 20
```

### New .env Variables (optional overrides)

```env
CRAIGSLIST_MAX_PAGES=3
CRAIGSLIST_DELAY_MIN=3.0
CRAIGSLIST_DELAY_MAX=8.0
CRAIGSLIST_PAGE_DELAY_MIN=5.0
CRAIGSLIST_PAGE_DELAY_MAX=15.0
CRAIGSLIST_SESSION_ROTATE_EVERY=20
```

### Batch Config: Cities + Categories

Add `CL_BATCH_SEARCH_CONFIGS` in `src/cli.py` (mirroring existing `BATCH_SEARCH_CONFIGS`):

```python
CL_CITIES = {
    "San Antonio, TX": "sanantonio",
    "Denver, CO": "denver",
    "Tampa, FL": "tampa",
    "Orlando, FL": "orlando",
    "Nashville, TN": "nashville",
    "Austin, TX": "austin",
    "Houston, TX": "houston",
    "Dallas, TX": "dallas",
    "Phoenix, AZ": "phoenix",
    "Charlotte, NC": "charlotte",
    # ... map all _ALL_LOCATIONS to CL subdomains
}

CL_BATCH_SEARCH_CONFIGS = [
    {"category": "bbb", "keywords": ["landscaping", "painting", "cleaning", "plumbing", "roofing", "electrical", "handyman", "pressure washing", "tree service", "junk removal"]},
    {"category": "hss", "keywords": []},  # household services, no keyword filter needed
    {"category": "sks", "keywords": []},  # skilled trades, no keyword filter needed
]
```

---

## 7. CLI Commands

Add to `src/cli.py`:

### `scrape-craigslist` — Single city + category

```
python run.py scrape-craigslist --city "San Antonio, TX" --category bbb --keyword landscaping --max-pages 3
```

**Options:**
- `--city` (required) — target city
- `--category` (default `bbb`) — CL service category code
- `--keyword` (optional) — search keyword filter
- `--max-pages` (default 3) — max pagination pages
- `--headless/--no-headless` (default headless)

### `scrape-craigslist-batch` — All configured cities + categories

```
python run.py scrape-craigslist-batch --dry-run
python run.py scrape-craigslist-batch --max-pages 3 --limit 10
```

**Options:**
- `--max-pages` (default 3) — pages per city+category+keyword combo
- `--headless/--no-headless`
- `--dry-run` — print what would run without scraping
- `--limit` — max number of city+category+keyword combos to run

---

## 8. Dashboard API Integration

### `dashboard/app/api/scrape/route.ts`

Add the new commands to the `ALLOWED_COMMANDS` set (line 25):

```typescript
const ALLOWED_COMMANDS = new Set([
  "scrape",
  "scrape-batch",
  "scrape-craigslist",        // ← NEW
  "scrape-craigslist-batch",  // ← NEW
  "pipeline",
  "triage",
  "audit",
  "score",
  "enrich",
  "backfill-emails",
  "generate-pdfs",
  "rescore",
  "dedup",
]);
```

### Dashboard UI (Optional / Phase 2)

Add a "Craigslist" section to the dashboard scraper controls with:
- City dropdown (populated from `CL_CITIES`)
- Category dropdown (populated from category codes)
- Keyword input field
- "Run" button that POSTs to `/api/scrape` with `command: "scrape-craigslist"`
- "Batch Run" button for `scrape-craigslist-batch`

This is lower priority — the CLI works first.

---

## 9. Pipeline Integration

**Zero changes needed** to the downstream pipeline. Here's why:

| Pipeline Stage | How CL Leads Are Handled                                                |
|---------------|-------------------------------------------------------------------------|
| **Triage**    | Checks `business.website` — CL leads likely have `website=None` → `NO_WEBSITE` |
| **Audit**     | Runs PageSpeed on businesses with websites — skips CL leads without one |
| **Scoring**   | Scores based on triage + audit data. CL leads without websites score high (they need one!) |
| **Enrichment**| Scrapes contact pages for email/socials — works if website exists, Hunter.io fallback otherwise |
| **Outreach**  | Sends to Instantly campaign — picks up any enriched lead with an email  |

The only consideration: the `outreach` command currently filters by `source_channel == "google_maps"` for the `already_sent` check (line 603 in `src/cli.py`). This needs to be updated to also check `"craigslist"`, or better, remove the source_channel filter entirely so outreach is source-agnostic.

---

## 10. Outreach Source Channel Fix

In `src/cli.py`, the `_outreach()` function has:

```python
already_sent = {r[0] for r in (await session.execute(
    select(OutreachLog.business_id).where(OutreachLog.source_channel == "google_maps")
)).all()}
```

**Change to:**
```python
already_sent = {r[0] for r in (await session.execute(
    select(OutreachLog.business_id)
)).all()}
```

This makes outreach dedup source-agnostic — a lead that was already contacted via Maps won't get re-contacted if also found on Craigslist.

---

## 11. File-by-File Implementation Checklist

| #  | File                                          | Action  | What                                                 |
|----|-----------------------------------------------|---------|------------------------------------------------------|
| 1  | `src/scraper/craigslist/__init__.py`          | CREATE  | `scrape_craigslist()`, `save_cl_businesses()` — main orchestration |
| 2  | `src/scraper/craigslist/parsers.py`           | CREATE  | `parse_listing_index()`, `parse_listing_detail()`, name extraction |
| 3  | `src/scraper/craigslist/deduplication.py`     | CREATE  | `deduplicate_cl_results()` — post ID + cross-source name+phone |
| 4  | `src/scraper/craigslist/urls.py`              | CREATE  | `CL_CITY_MAP`, `build_search_url()`, `build_detail_url()` |
| 5  | `src/models/business.py`                      | MODIFY  | Add `source_url`, `listing_description` columns       |
| 6  | `alembic/versions/xxx_add_cl_fields.py`       | CREATE  | Migration for new columns                             |
| 7  | `src/config.py`                               | MODIFY  | Add `craigslist_*` settings                           |
| 8  | `src/cli.py`                                  | MODIFY  | Add `scrape-craigslist`, `scrape-craigslist-batch` commands + `CL_CITIES` + `CL_BATCH_SEARCH_CONFIGS` |
| 9  | `src/cli.py`                                  | MODIFY  | Fix outreach `already_sent` to be source-agnostic     |
| 10 | `dashboard/app/api/scrape/route.ts`           | MODIFY  | Add new commands to `ALLOWED_COMMANDS`                |

---

## 12. Implementation Order

1. **`urls.py`** — city mapping + URL builder (pure logic, easy to test)
2. **`parsers.py`** — HTML parsing for index + detail pages (can test against saved HTML fixtures)
3. **`deduplication.py`** — CL dedup logic (reuses existing normalize functions)
4. **`__init__.py`** — main scraper orchestration (wires together browser + parsers + dedup + save)
5. **`src/models/business.py`** + migration — schema changes
6. **`src/config.py`** — settings
7. **`src/cli.py`** — CLI commands + batch config
8. **`dashboard/app/api/scrape/route.ts`** — dashboard integration
9. **Outreach fix** — source-agnostic dedup
10. **Dashboard UI** — optional, phase 2

---

## 13. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **CL blocks scrapers aggressively** | HIGH | Bright Data residential proxies + aggressive delays + session rotation |
| **Legal / TOS** | MEDIUM | CL TOS prohibits scraping. Use at own risk. The hiQ v. LinkedIn precedent is favorable for public data, but CL has sued scrapers before (CL v. 3Taps). Don't hammer their servers. |
| **CAPTCHAs** | MEDIUM | Detect CAPTCHA page, back off 60–120s. Optionally integrate CAPTCHA solver via existing `captcha_api_key` |
| **Anonymized emails** | MEDIUM | CL hides poster emails behind relay addresses (`reply+xxxxx@cl.org`). Real email often in the ad body text — regex extraction handles this. Not all posts will have a reachable email. |
| **Phone in images** | LOW | Some posters embed phone numbers in images to avoid scraping. OCR (e.g. Tesseract) could extract these — future enhancement, not MVP. |
| **Post churn** | LOW | CL listings expire/delete within 7–45 days. Run scrapes on a schedule (daily or every few days) to catch new posts. |
| **Duplicate leads across sources** | LOW | Cross-source dedup (name+phone, name+city) catches businesses already found on Maps |

---

## 14. Estimated Yield

Based on typical CL services volume:

- **Per city:** ~50–200 service listings per day across all categories
- **Per scrape run (3 pages × 1 category):** ~100–360 raw listings
- **After dedup:** ~30–60% unique (many re-posts)
- **With extractable contact info:** ~40–70% have a phone or email in the ad body
- **Net new leads per city per run:** ~15–100

For 10 cities × daily runs = **150–1,000 new leads/day** from Craigslist alone, supplementing Google Maps volume.

---

## 15. Future Enhancements (Post-MVP)

- **Scheduled scraping** — Add CL batch to Celery Beat schedule (nightly, alongside Maps scrape)
- **Image OCR** — Extract phone numbers from posted images using Tesseract
- **CL reply-via-email** — Auto-send outreach to CL relay addresses (different from Instantly workflow)
- **Category auto-detection** — Classify the business type from the ad text using keyword matching or LLM
- **Sentiment/quality scoring** — Score ad text quality to filter out low-effort or spam posts
- **Multi-section scraping** — Expand beyond services to "gigs" section (gig workers looking for help = potential customers)
- **Dashboard analytics** — CL-specific metrics (posts/day by city, contact rate by category, etc.)
