# NWS Media Lead Engine — Master Checklist

> Every item maps to a section in `LEAD_ENGINE_PLAN.md`. Check them off as you go.

---

## Prerequisites (Section 25)

### Accounts
- [ ] Google Cloud Console (PageSpeed + Places API keys)
- [ ] Bright Data (residential proxies)
- [ ] 2Captcha (CAPTCHA solving)
- [ ] Hunter.io (email finder)
- [ ] Instantly.ai (cold email)
- [ ] Cobalt Intelligence (LLC filing data)
- [ ] Snov.io (skip tracing)
- [ ] Lob.com (direct mail)
- [ ] DigitalOcean or Railway (VPS hosting)
- [ ] Supabase or Neon (managed PostgreSQL)
- [ ] GitHub private repo created

### Domains & Email
- [ ] Sending domain registered (separate from nwsmedia.com)
- [ ] Google Workspace set up on sending domain
- [ ] 3-5 sending email accounts created
- [ ] SPF, DKIM, DMARC records configured
- [ ] Sending accounts connected to Instantly.ai
- [ ] Email warmup started (needs 2-3 weeks)

### Local Dev
- [ ] Python 3.12+ installed
- [ ] Poetry or pip configured
- [ ] Docker installed
- [ ] Playwright browsers installed
- [ ] Git configured and repo cloned

### Business Prep
- [ ] Top 3 niches defined
- [ ] Geographic focus defined
- [ ] Calendly booking link created
- [ ] Discovery call script prepared
- [ ] Pricing set (floor + target)
- [ ] Portfolio page with 3-5 examples
- [ ] Case study / before-after prepared
- [ ] CRM board set up (Notion/Trello)
- [ ] Physical return address decided

---

## Phase 1: Foundation — Week 1-2 (Sections 3, 14)

- [ ] Python project initialized (Poetry/pip, folder structure)
- [ ] Git repo set up with `.env.example` and `.gitignore`
- [ ] Docker Compose for local PostgreSQL + Redis
- [ ] Database schema migrated with Alembic
- [ ] `businesses` table created
- [ ] `search_configs` table created
- [ ] Google Maps Playwright scraper built
- [ ] Anti-detection: proxy rotation, user agent pool, viewport randomization
- [ ] CAPTCHA handling integrated (2Captcha)
- [ ] `playwright-stealth` plugin configured
- [ ] place_id deduplication logic implemented
- [ ] Search config system (niche + location, DB-driven)
- [ ] Basic CLI runner (`python run.py scrape --niche --location`)
- [ ] **TEST**: First batch of 500 leads scraped and stored
- [ ] **TEST**: Data quality verified (name, phone, website, reviews present)

---

## Phase 2: Triage + Audit — Week 2-3 (Sections 4, 5, 6)

### Triage (Section 4)
- [ ] URL health checker (reachability, redirects, status codes)
- [ ] Free subdomain detection (Wix, Squarespace, GoDaddy, etc.)
- [ ] Triage classifier (NO_WEBSITE / DEAD_WEBSITE / FREE_SUBDOMAIN / PAGE_BUILDER / HAS_WEBSITE)
- [ ] `triage_results` table populated

### Audit (Section 5)
- [ ] PageSpeed Insights API integration (async, response parsing)
- [ ] SSL certificate checker
- [ ] Mobile responsiveness check (Playwright viewport)
- [ ] Technology stack detection (regex + header analysis)
- [ ] Content freshness check (copyright year, Last-Modified)
- [ ] Combined audit function (all checks in parallel)
- [ ] `website_audits` table populated

### Scoring (Section 6)
- [ ] Lead scoring algorithm implemented (0-100 composite)
- [ ] Tier assignment logic (HOT / WARM / COOL / COLD / SKIP)
- [ ] `lead_scores` table populated
- [ ] **TEST**: 200 leads audited end-to-end
- [ ] **TEST**: Scoring accuracy reviewed and weights tuned

---

## Phase 3: Enrichment + Outreach Prep — Week 3-4 (Sections 7, 8, 9)

### Enrichment (Section 7)
- [ ] Website contact page scraper (/contact, /about, /team)
- [ ] Email extraction from HTML
- [ ] Social profile extraction (Facebook, Instagram, LinkedIn, Twitter/X)
- [ ] Hunter.io API integration (fallback email finder)
- [ ] Combined enrichment pipeline (website scrape → Hunter fallback)
- [ ] `enrichment_data` table populated

### Outreach Prep (Section 8)
- [ ] Jinja2 email template system with dynamic audit variables
- [ ] Initial outreach email template
- [ ] 4 follow-up email templates (value add, social proof, soft close, breakup)
- [ ] Audit PDF generator (WeasyPrint HTML-to-PDF)
- [ ] Branded PDF report template designed
- [ ] Optional: video audit screenshot capture

### Delivery (Section 9)
- [ ] Instantly.ai API integration (add leads to campaign)
- [ ] Custom variables mapped (rating, review_count, issues, score)
- [ ] Follow-up sequence configured in Instantly.ai (5 emails, Days 1-18)
- [ ] `outreach_log` table tracking
- [ ] `lead_lifecycle` table tracking
- [ ] **TEST**: Full pipeline run on 50 leads
- [ ] **TEST**: Emails delivered to inbox (not spam)

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

## Phase 6: Dashboard + Optimization — Week 7-9 (Optional)

- [ ] Next.js project initialized with Tailwind CSS
- [ ] Auth (NextAuth.js)
- [ ] Lead list view (search, filter by tier/channel/niche/city)
- [ ] Lead detail page (audit results, enrichment, outreach history)
- [ ] LLC filing view (classification, mail status, LinkedIn status)
- [ ] Pipeline stats dashboard (leads/day, scores, reply rates)
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
