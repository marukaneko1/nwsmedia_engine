# Lead Engine — Subscription & Cost List

All applications you’ll pay for (subscription or usage-based), with prices and **use case** for each. Details from `LEAD_ENGINE_PLAN.md` Section 17.

---

## Fixed monthly subscriptions

| Application | Price | Use case |
|-------------|--------|----------|
| **Instantly.ai** | **$30/mo** | **Cold email (Channel 1).** Send sequences to scraped leads, warmup inboxes, track opens/replies. You connect design@ and general@ here. *You have this.* |
| **Hunter.io** | **$0** or **$49/mo** | **Find emails from domains (Channel 1).** You have a business name + website URL; Hunter finds “most likely” email (e.g. owner@, info@). Used after triage/audit to enrich leads before sending in Instantly. |
| **Snov.io** | **$0** or **$39/mo** | **Skip tracing (Channel 2).** LLC filings give business name + address but often no email. Snov finds emails by name/company (and LinkedIn URLs). Used to contact LLC leads by email when found. |
| **VPS / cloud server** | **$20–$50/mo** | **Run the pipelines.** Hosts the Python app: Google Maps scraper, triage, PageSpeed audits, enrichment jobs, and (optionally) workers that feed Instantly/Lob. DigitalOcean or Railway. |
| **PostgreSQL (managed)** | **$0** or **$15/mo** | **Main database.** Stores businesses, triage results, audits, lead scores, enrichment data, outreach log. Supabase or Neon free tier to start; paid if you outgrow. |
| **Redis** | **$0–$10/mo** | **Queues and rate limiting.** Used for job queues (e.g. “audit this URL”, “enrich this lead”), throttling API calls, and optional caching. Upstash free or self-host on VPS. |
| **Domain + email sending** | **~$5–$15/mo** | **Sending identity for cold email.** Separate domain (nwsmediaoutreach.com) and mailboxes so nwsmedia.com isn’t used for cold outreach. Required for Instantly + deliverability. *You have this.* |
| **Cobalt Intelligence** | **$30–$100/mo** | **LLC filing data (Channel 2).** API to pull new business filings (LLC, etc.) by state. You filter to customer-facing businesses, score them, then send direct mail + email/LinkedIn. |
| **Apify** (Channel 2 alternative) | **$5–$20/mo** | **Same use case as Cobalt** — LLC/filing data by state. Pre-built scrapers (e.g. Florida) or custom; pay per run. Cheaper but more per-state setup. |

---

## Usage-based (no fixed subscription)

| Application | Typical/month | Use case |
|-------------|----------------|----------|
| **Bright Data** | **$30–$80** | **Residential proxies for scraping (Channel 1).** Google Maps can block datacenter IPs. Proxies rotate IPs so the Playwright scraper looks like normal users and avoids blocks/CAPTCHAs. |
| **2Captcha** | **$10–$20** | **Solve CAPTCHAs (Channel 1).** When Maps or a site shows a CAPTCHA, the scraper sends it to 2Captcha and gets the answer so the run can continue automatically instead of stopping. |
| **Lob.com** | **$75–$250** | **Direct mail (Channel 2).** Send postcards ($0.63) or letters ($1.08) to LLC leads by address. Lob prints, mails via USPS, and tracks. Used for “we noticed your new LLC” style outreach when email isn’t found. |
| **Google Cloud (Places API)** | **$0–$15** | **Places lookups.** Channel 1: optional for extra place details. Channel 2: cross-reference LLC names to Google Maps (get website, phone, place_id). First $200/mo free. |

---

## Optional / one-time

| Item | Cost | Use case |
|------|------|----------|
| **Google Cloud API key** | $0 | Same as Google Cloud (Places) above; also used for PageSpeed Insights (website audits). |
| **Sending domain** | ~**$12/year** | Same as “Domain + email” — you already have nwsmediaoutreach.com. |
| **Lob.com** | $0 signup | Pay only when you send; see Lob in usage-based table. |
| **BuiltWith** (optional) | **$295/mo** | Detect site tech (e.g. Wix, WordPress). Plan uses free options (Wappalyzer/regex) instead. |
| **Outscraper** (optional) | **$2/1K** results | Alternative to your own Playwright Maps scraper; pay per result. |

---

## Summary by tier (from plan)

| Tier | Channel 1 | Channel 2 | **Total/month** |
|------|-----------|-----------|------------------|
| **Starter** | $150 | $110 | **$260** |
| **Growth** | $200 | $250 | **$450** |
| **Scale** | $260 | $425 | **$685** |

---

## What you already pay

- **Instantly.ai** — $30/mo  
- **Domain + email** — nwsmediaoutreach.com + Namecheap Private Email (your current ~$5–15/mo)  

Everything else in the table above is **not yet subscribed**; add as you build Phase 1–6.
