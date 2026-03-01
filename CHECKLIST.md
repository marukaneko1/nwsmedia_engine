# NWS Media Lead Engine — Master Checklist

> Every item maps to a section in `LEAD_ENGINE_PLAN.md`. Check them off as you go.

---

## Prerequisites (Section 25)

### Accounts
- [x] Google Cloud Console (PageSpeed + Places API keys) — single key used for both
- [x] Bright Data (residential proxies) — account created, API key set, proxy URL configured (port 33335)
- [x] 2Captcha (CAPTCHA solving) — API key configured
- [x] Hunter.io (email finder) — API key configured (Free plan: 50 searches + 100 verifications/mo)
- [x] Instantly.ai (cold email) — API key + Maps campaign ID configured
- [ ] Cobalt Intelligence (LLC filing data) — *Phase 5, not yet needed*
- [ ] Snov.io (skip tracing) — *Phase 5, not yet needed*
- [ ] Lob.com (direct mail) — *Phase 5, not yet needed*
- [ ] DigitalOcean or Railway (VPS hosting) — *Phase 4, not yet needed*
- [x] Supabase (managed PostgreSQL) — connected via Session Pooler, all tables migrated
- [x] GitHub private repo created

### Domains & Email
- [x] Sending domain registered — `nwsmediaoutreach.com` on Namecheap
- [x] Email hosting set up (Namecheap Private Email)
- [x] 6 sending email accounts created (design@, general@, info@, service@, team@, website@)
- [x] DKIM record configured
- [x] SPF record configured — `include:spf.privateemail.com ip4:198.54.127.64/27`
- [x] DMARC record configured
- [x] Mail-tester score: **10/10**
- [x] Sending accounts connected to Instantly.ai *(design@ + general@ added; add rest when plan allows)*
- [x] Email warmup started for connected accounts (design@ + general@ both on)

### Local Dev
- [x] Python 3.12+ installed (pyenv 3.12.6)
- [x] pip configured with `pyproject.toml` (dependencies installed in `.venv`)
- [x] Docker installed (Docker Desktop for Mac)
- [x] Playwright browsers installed (`chromium`)
- [x] Git configured and repo cloned

### Business Prep
- [x] Sender identity configured (name, title, phone, company in `.env`)
- [x] Physical return address configured (135 W 50th St, Manhattan, NY 10020)
- [x] Top 3 niches defined (see `LEAD_ENGINE_PLAN.md` Section 16):
  1. **Home Service Contractors** (HVAC, plumbing, roofing, electrical) — worst websites, owner = decision-maker, $3K–$8K projects
  2. **Dental Practices** — consistently bad sites, high project value $5K–$15K, recurring revenue
  3. **Med Spas / Aesthetic Clinics** — brand-dependent, luxury positioning, $5K–$15K+ projects
- [x] Geographic focus defined — Phase 1 metros: Houston TX, Dallas TX, Atlanta GA, Phoenix AZ, Austin TX
- [x] Calendly booking link created — `https://calendly.com/shunya-nwsmedia/30min` (included in follow-up emails 1 & 3)
- [x] Discovery call script prepared — see `DISCOVERY_CALL_SCRIPT.md` (full script, objection handling, 13 common Q&As, red flags, cheat sheet)
- [x] Pricing set (floor + target) — see `PRICING_AND_MOAT_RESEARCH.md`: floor $3.5k–4k, target $5.5k–8k, high end $9k–12k; ongoing $50–150/mo
- [ ] Portfolio page with 3-5 examples
- [ ] Case study / before-after prepared
- [ ] **CRM pipeline** — delivered as part of **Phase 6: Dashboard + CRM** (unified web app on subdomain, e.g. `app.nwsmedia.com`). Columns: **Lead → Replied → Meeting → Proposal → Won → Lost**; segment tag (ESTABLISHED / NEW_SMALL) on each card; reply/close rate by segment. Until Phase 6 is live, use a simple Notion/Trello board if needed.

---

## Infrastructure Setup (complete)

### Configuration
- [x] `pyproject.toml` — all dependencies declared (SQLAlchemy, asyncpg, Alembic, Playwright, playwright-stealth, aiohttp, Pydantic, Click, Rich, Celery, Redis, Jinja2, structlog)
- [x] `.env.example` — template with all variables documented
- [x] `.env` — configured with real credentials (Google API, Bright Data, 2Captcha, Instantly, Supabase, sender identity)
- [x] `.gitignore` — Python, Docker, IDE, env files excluded
- [x] `src/config.py` — Pydantic Settings loader for all environment variables

### Database
- [x] Docker Compose — PostgreSQL 16 (port 5433) + Redis 7 (port 6379) for local dev
- [x] Supabase Session Pooler connected (`aws-1-us-east-2.pooler.supabase.com:5432`)
- [x] `src/database.py` — async SQLAlchemy engine + session factory
- [x] Alembic configured (`alembic.ini`, `alembic/env.py` with async support)
- [x] Initial migration applied (`ec9230cc677a`) — 8 tables created on Supabase:
  - `businesses` (place_id, name, category, address, phone, email, website, rating, reviews, coords, hours)
  - `search_configs` (niche, locations, radius, max_results, scheduling)
  - `triage_results` (business_id, status, http_status, redirect_url, is_free_subdomain)
  - `website_audits` (business_id, Lighthouse scores, SSL, mobile, tech stack, content freshness)
  - `lead_scores` (business_id, score 0-100, tier, segment, breakdown)
  - `enrichment_data` (business_id, emails, owner, social profiles)
  - `outreach_log` (business_id, channel, type, segment, email, campaign, status, timestamps)
  - `lead_lifecycle` (business_id, status, timestamps, notes)

### ORM Models
- [x] `src/models/business.py` — Business model with indexes on place_id, category, city
- [x] `src/models/search_config.py` — SearchConfig model
- [x] `src/models/triage.py` — TriageResult model
- [x] `src/models/audit.py` — WebsiteAudit model (full Lighthouse + SSL + mobile + tech fields)
- [x] `src/models/score.py` — LeadScore model (0-100 with tier, segment, breakdown)
- [x] `src/models/enrichment.py` — EnrichmentData model
- [x] `src/models/outreach.py` — OutreachLog model (includes segment for reply/close tracking)
- [x] `src/models/lifecycle.py` — LeadLifecycle model
- [x] `src/models/__init__.py` — all 8 models exported

### Utilities
- [x] `src/utils/logging.py` — structlog with timestamped console output
- [x] `src/utils/proxy.py` — Bright Data proxy config parser, user agent pool (7), viewport pool (6), random headers
- [x] `src/utils/rate_limiter.py` — async token-bucket rate limiter (built, not yet integrated)

### CLI
- [x] `src/cli.py` — Click CLI: `scrape`, `scrape-batch`, `db-status`, `stats`, `leads`, `triage`, `audit`, `score`, `rescore`, `enrich`, `outreach`, `generate-pdfs`, `pipeline`, `segment-stats`, `backfill-emails`
- [x] `run.py` — entry point (`python run.py <command>`)

### Documentation
- [x] `LEAD_ENGINE_PLAN.md` — full technical blueprint (3,163 lines)
- [x] `CHECKLIST.md` — this file
- [x] `DELIVERABILITY_FIXES.md` — SPF/DKIM/DMARC troubleshooting log
- [x] `SUBSCRIPTION_COSTS.md` — all service costs documented
- [x] `STRATEGY_ANALYSIS.md` — business strategy analysis

---

## Phase 1: Foundation — Week 1-2 (Sections 3, 14)

### Google Maps Scraper
- [x] `src/scraper/google_maps.py` — full scrape orchestrator (navigate, consent, search, scroll, detail extraction, save)
- [x] `src/scraper/anti_detection.py` — stealth browser context (playwright-stealth, random UA/viewport/headers, proxy support, `ignore_https_errors`)
- [x] `src/scraper/parsers.py` — listing panel extraction + detail panel extraction (name, category, address, phone, website, rating, reviews, place_id, coords)
- [x] `src/scraper/deduplication.py` — DB-backed place_id dedup + batch dedup
- [x] Consent dialog handling (multiple button texts + Google form fallback)
- [x] Results feed scrolling with stale-detection and end-of-results marker
- [x] Detail click with fallback (aria-label click → href navigation)
- [x] place_id extraction: 5 regex patterns (ftid, !1s hex, ChIJ, cid, /place/ path) + hash fallback
- [x] Address parsing into city/state/zip components
- [x] `save_businesses()` — batch insert with deduplication
- [x] Bright Data KYC completed — *waiting to be contacted for full permission (Google Maps); scrape works without proxy in the meantime*
- [ ] **LATER**: Bright Data full permission — *when contacted & access granted: uncomment BRIGHT_DATA_PROXY_URL in .env, run a 5-result test scrape to confirm*
- [ ] 2Captcha integration tested with live CAPTCHA — *API key set, code wired, needs real CAPTCHA trigger to verify*
- [x] **TEST**: First batch scraped and stored (10 dentists Austin; stress test 30–50 run manually)
- [x] **TEST**: Data quality verified (name, phone, website, reviews present)

### Folder Structure (placeholder packages created for future phases)
- [x] `src/triage/` — **implemented** (URL health, free subdomain, classifier, `run_triage`)
- [x] `src/audit/` — **implemented** (PageSpeed, SSL, tech stack, freshness, `run_audits`)
- [x] `src/scoring/` — **implemented** (0-100 score, tier assignment, `run_scoring`)
- [x] `src/enrichment/` — **implemented** (website scrape, Hunter.io, combined pipeline, `run_enrichment`)
- [x] `src/outreach/` — **implemented** (templates, PDF gen, Instantly API, tracking, `run_outreach`)
- [x] `src/pipeline/` — empty, ready for Phase 4
- [x] `src/llc/` + `src/llc/state_scrapers/` — empty, ready for Phase 5
- [x] `src/direct_mail/` — empty, ready for Phase 5
- [x] `tests/` — empty, ready for tests

---

## Phase 2: Triage + Audit + Scoring — Week 2-3 (Sections 4, 5, 6)

### Triage (Section 4)
- [x] URL health checker (reachability, redirects, status codes) — `src/triage`: `check_url`, `triage_business`
- [x] Free subdomain detection (Wix, Squarespace, GoDaddy, etc.) — `FREE_SUBDOMAIN_PATTERNS`, `PAGE_BUILDER_DOMAINS`
- [x] Triage classifier (NO_WEBSITE / DEAD_WEBSITE / FREE_SUBDOMAIN / PAGE_BUILDER / HAS_WEBSITE)
- [x] `triage_results` table populated — CLI: `python run.py triage`

### Audit (Section 5)
- [x] PageSpeed Insights API integration (async, response parsing) — `src/audit`: `run_pagespeed`
- [x] SSL certificate checker — `check_ssl` (sync, run in thread)
- [x] Technology stack detection (regex + header analysis) — `detect_tech_stack`
- [x] Content freshness check (copyright year) — `check_content_freshness`
- [x] Combined audit function (PageSpeed, SSL, tech, freshness in parallel) — `full_audit`
- [x] `website_audits` table populated — CLI: `python run.py audit`
- [ ] Mobile responsiveness check (Playwright viewport) — *optional enhancement; tech detection used as proxy for now*

### Scoring (Section 6)
- [x] Lead scoring algorithm implemented (0-100 composite) — `src/scoring`: `calculate_lead_score`
- [x] Tier assignment logic (HOT / WARM / COOL / COLD / SKIP) — `score_to_tier`
- [x] `lead_scores` table populated — CLI: `python run.py score`
- [x] **TEST**: 148 leads triaged, 114 audited, 148 scored (COOL: 62, COLD: 86)
- [x] **Pipeline**: `python run.py pipeline` runs triage → audit → score in sequence

### Segments (NEW)
- [x] Segment assignment: `ESTABLISHED` (21+ reviews) vs `NEW_SMALL` (0-20 reviews or NO_WEBSITE)
- [x] `segment` column on `lead_scores` table (migration `a3f8b1c9d2e5`)
- [x] `segment` column on `outreach_log` table (for reply/close rate tracking per segment)
- [x] Scoring weights adjusted for NEW_SMALL: website absence = opportunity, not penalty
- [x] `rescore` CLI command — clears + re-runs scoring with current logic
- [x] `segment-stats` CLI command — shows segment × tier breakdown + outreach reply rates
- [x] **TEST**: Re-scored 148 leads → ESTABLISHED: 139, NEW_SMALL: 9 (5 WARM, 1 COOL, 3 COLD)
- [ ] **Track**: After 2-3 months of outreach, compare reply/close rates ESTABLISHED vs NEW_SMALL
- [ ] **Optional**: Scoring weights tuned after reply/close data

---

## Phase 3: Enrichment + Outreach Prep — Week 3-4 (Sections 7, 8, 9)

### Enrichment (Section 7)
- [x] Website contact page scraper (/contact, /about, /team) — `src/enrichment`: `scrape_contact_info`
- [x] Email extraction from HTML — regex with junk filter (hex-hash, image extensions, long strings)
- [x] Social profile extraction (Facebook, Instagram, LinkedIn, Twitter/X, Yelp) — `SOCIAL_PATTERNS`
- [x] Hunter.io API integration (fallback email finder) — `find_email_hunter`, sorts by confidence, prefers owner titles
- [x] Combined enrichment pipeline (website scrape → Hunter fallback) — `enrich_lead`, `run_enrichment`
- [x] `enrichment_data` table populated — CLI: `python run.py enrich`
- [x] **TEST**: 62 COOL+ leads enriched → 39 emails found (63%), 21 via Hunter.io, 18 via website scrape

### Outreach Prep (Section 8)
- [x] Jinja2 email template system with dynamic audit variables — `templates/` dir, segment-aware
- [x] Initial outreach email template — `templates/email_initial.txt` (NO_WEBSITE, DEAD, FREE_SUBDOMAIN, HAS_WEBSITE branches + NEW_SMALL angle)
- [x] 4 follow-up email templates — `email_followup_1.txt` through `email_followup_4.txt` (value add, social proof, soft close, breakup)
- [x] Audit PDF generator (WeasyPrint HTML-to-PDF) — `src/outreach`: `generate_audit_pdf`
- [x] Branded PDF report template designed — `templates/audit_report.html` (score gauges, issues, CTA, **"What You'll Gain" section** with personalized revenue projections, traffic estimates, before/after comparison, ROI timeline, Calendly link)
- [x] Personalized projections engine — `_compute_projections()` in `src/outreach/__init__.py` (vertical-aware avg job value, search volume, lead estimates, ROI math)
- [x] WeasyPrint installed — in `pyproject.toml`; on macOS run `brew install pango cairo gdk-pixbuf libffi` if PDF generation fails
- [ ] Optional: video audit screenshot capture — *deferred*

### Delivery (Section 9)
- [x] Instantly.ai API integration (add leads to campaign) — `src/outreach`: `add_lead_to_instantly`
- [x] Custom variables mapped (rating, review_count, category, city, lead_score, segment, tier, triage_status, issues_found, performance_score, seo_score)
- [x] `outreach_log` table tracking — `queue_lead` writes status (queued/dry_run/no_email/api_error) + segment
- [x] CLI: `python run.py outreach` (queue to Instantly) and `python run.py generate-pdfs`
- [x] **TEST**: Dry-run on 3 enriched leads — all logged correctly
- [ ] Follow-up sequence configured in Instantly.ai (5 emails, Days 1-18) — *configure in Instantly dashboard using templates*
- [ ] `lead_lifecycle` table tracking — *Phase 4: automatic status transitions*
- [ ] **TEST**: Emails delivered to inbox (not spam) — *wait for warmup to complete (14+ days), then send test batch*

---

## Phase 4: Automation + Scheduling — Week 4-5 (Sections 1, 19)

- [ ] Celery + Redis installed and configured
- [ ] Celery Beat scheduler set up
- [ ] Pipeline orchestrator: scrape → triage → audit → score → enrich → queue
- [ ] Error handling and retry logic on every task
- [ ] Daily summary email (new leads, top scores, outreach stats)
- [ ] Structured logging (JSON logs, error tracking)
- [ ] Deployed to VPS (DigitalOcean/Railway)
- [ ] systemd services configured for Celery worker + beat
- [ ] **TEST**: Automated run for 5 consecutive days
- [ ] **TEST**: All errors caught and logged, no silent failures

---

## Phase 5: Channel 2 — LLC Filing Pipeline — Week 5-7 (Sections 10, 11, 12, 13)

### Discovery (Section 10)
- [ ] Cobalt Intelligence API integration (auth, search, parsing)
- [ ] Florida scraper (Sunbiz daily feed)
- [ ] Texas scraper (SOSDirect)
- [ ] California scraper (Bizfile API)
- [ ] Filing deduplication (filing_number + state)
- [ ] Cross-channel dedup (don't contact if already in Channel 1)
- [ ] `llc_filings` table populated
- [ ] `llc_filing_configs` table populated

### Scoring & Filtering (Section 11)
- [ ] Entity name classifier (customer-facing vs. holding co vs. unknown)
- [ ] CUSTOMER_FACING_PATTERNS list complete
- [ ] NON_CUSTOMER_PATTERNS list complete
- [ ] LLC scoring algorithm implemented (0-100)
- [ ] LLC tier assignment (HOT / WARM / COOL / SKIP)

### Enrichment (Section 12)
- [ ] Google Maps cross-reference (Places Text Search API)
- [ ] Owner email discovery (Hunter → Snov.io → pattern guess)
- [ ] LinkedIn search URL generator
- [ ] LinkedIn connection note generator
- [ ] Combined LLC enrichment pipeline
- [ ] Outreach channel determination (mail / email / LinkedIn / phone)

### Outreach (Section 13)
- [ ] Postcard front HTML template designed
- [ ] Postcard back HTML template designed
- [ ] Lob.com postcard API integration
- [ ] Welcome letter HTML template designed
- [ ] Lob.com letter API integration (HOT leads only)
- [ ] LLC cold email template (for leads where email found)
- [ ] LinkedIn outreach sequence written (4 messages)
- [ ] LLC outreach orchestrator: fetch → classify → score → enrich → mail
- [ ] Celery tasks for Channel 2 nightly jobs
- [ ] `direct_mail_log` table tracking
- [ ] **TEST**: 100 filings processed end-to-end
- [ ] **TEST**: Classification accuracy >85%
- [ ] **TEST**: Test postcard received (Lob test mode)
- [ ] **TEST**: Skip tracing hit rate measured

---

## Phase 6: Dashboard + CRM (Unified Web App) — Week 7-9

**Goal**: One web app on a subdomain of nwsmedia.com (e.g. `app.nwsmedia.com` or `leads.nwsmedia.com`) that replaces a separate CRM board and provides the ops dashboard. See `LEAD_ENGINE_PLAN.md` Phase 6 for full plan and integration details.

### Core (CRM + Dashboard)
- [ ] Next.js project initialized (Tailwind CSS), deployed and reachable at chosen subdomain
- [ ] Auth (NextAuth.js) — login for you (and optional team)
- [ ] **CRM pipeline board**: columns **Lead → Replied → Meeting → Proposal → Won → Lost**; cards show company name, segment (ESTABLISHED / NEW_SMALL), channel; move leads between columns (updates `lead_lifecycle` in DB)
- [ ] Lead list view (search, filter by tier/channel/niche/city/segment)
- [ ] Lead detail page (business, audit summary, enrichment, outreach history, lifecycle status with update controls)
- [ ] Pipeline stats dashboard (leads/day, score distribution, reply rates, breakdown by segment)

### Integration
- [ ] Backend/API reads from `businesses`, `lead_scores`, `outreach_log`, `lead_lifecycle`; writes to `lead_lifecycle` for status changes
- [ ] Pipeline: when outreach queues a lead to Instantly, ensure `lead_lifecycle` has a row (e.g. status `contacted` or `queued`) so the lead appears in the CRM

### Optional (config & Channel 2)
- [ ] LLC filing view (classification, mail status, LinkedIn status)
- [ ] Search config editor (niches + locations via UI)
- [ ] LLC state config editor
- [ ] Score weight tuning via UI
- [ ] Direct mail tracker (postcard/letter status from Lob)

---

## Pre-Launch Checklist (Section 25)

- [ ] Email warmup running for 14+ days
- [ ] Test scrape: 100 businesses audited, 5 sample emails generated
- [ ] Sample emails reviewed for tone and accuracy
- [ ] 10 test emails sent to self/friends — inbox placement confirmed
- [ ] Test postcard created on Lob.com — formatting verified
- [ ] All API keys verified working
- [ ] Error alerting configured (email on pipeline failure)
- [ ] Unsubscribe mechanism confirmed working
- [ ] Outscraper set up as fallback scraping source

---

## Ongoing Operations (Sections 22, 24)

### Weekly
- [ ] Check Maps scraper health (block rate, CAPTCHA rate)
- [ ] Check LLC filing pipeline (API errors, format changes)
- [ ] Review lead quality samples (both channels)
- [ ] Review direct mail delivery/return rates
- [ ] Review KPIs: open rate, reply rate, meetings booked

### Monthly
- [ ] Tune scoring weights based on reply/close data
- [ ] Update free subdomain patterns
- [ ] Update entity name classifier patterns
- [ ] Rotate sending domains if deliverability drops
- [ ] Update Playwright / browser version
- [ ] Review skip tracing hit rates
- [ ] Generate monthly P&L report
- [ ] Review CPA and ROI across both channels
