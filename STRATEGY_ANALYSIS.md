# NWS Media — Deep Strategy Analysis

## Is There Something Better Than Google Maps + Website Audit?

After researching every viable automated lead generation approach — including several strategies most agencies have never heard of — here's the honest answer:

**Google Maps + Website Audit is still the best primary strategy.** But I found one strategy that genuinely competes as a *complementary* channel, and two others worth understanding even though they fall short.

This document covers:
1. Every alternative I evaluated
2. Why each one wins or loses against Google Maps
3. The one strategy that creates a genuine timing advantage Google Maps can't match
4. The final recommended approach (and why it's a hybrid)

---

## The 8 Alternative Strategies Evaluated

### Strategy 1: Secretary of State New LLC Filings (THE CONTENDER)

**What it is**: Every state requires new businesses to file formation documents (LLC, Corp, LP) with the Secretary of State. These filings are public record. Many states publish daily feeds of new filings. You can scrape or API-pull these daily and contact new business owners before they even appear on Google Maps.

**Data you get per filing**:
- Business entity name
- Owner/organizer name(s) and physical address(es)
- Registered agent name and street address
- Principal place of business address
- Mailing address
- Filing date
- Entity type (LLC, Corp, LP, etc.)
- State of formation

**Data you DON'T get**:
- Email address (not public record in most states)
- Phone number
- Website (they usually don't have one yet)
- Industry/category (just the entity name, e.g. "Bright Smile Dental LLC")

**Available sources**:
| Source | Coverage | Cost | Format |
|---|---|---|---|
| Cobalt Intelligence API | All 50 states + DC | Custom pricing (free trial) | REST API, JSON |
| Apify Corporate Registry Scraper | Multi-state | ~$5 per 1,000 results | API + CSV |
| Apify Florida Business Leads | Florida only | $5 per 1,000 results | API + CSV |
| Direct state websites | Per-state | Free (manual) | Varies wildly |
| State bulk data feeds | Some states (WV, FL, CA, etc.) | Free-$50/mo | CSV/XML |

**Volume**: Roughly 1,000-1,500 new LLCs per day per large state (FL, TX, CA). Nationally, 4-5 million new business entities are filed per year. That's ~15,000 new businesses per day across the US.

#### Why It's Compelling

1. **Timing advantage**: You reach business owners 2-8 weeks BEFORE they appear on Google Maps, Yelp, or any other directory. You are literally the first agency to contact them. No competition.

2. **Legal and clean**: LLC filings are public government records. There are zero terms-of-service concerns. This is as legally clean as it gets.

3. **Owner name is guaranteed**: Unlike Google Maps where you often contact "info@" or a generic receptionist, LLC filings give you the actual owner's legal name and address.

4. **High intent signal**: Someone who just filed an LLC is in active "building my business" mode. They're making decisions about branding, operations, and online presence RIGHT NOW.

5. **Physical mail option**: You have their mailing address, which opens up direct mail — a channel with almost zero competition in 2026. A well-designed postcard or welcome letter with a QR code to a free audit has response rates of 2-5% (10x cold email).

#### Why It Falls Short of Google Maps

1. **No website to audit**: The entire power of the Google Maps approach is that you can show SPECIFIC problems with their web presence. With LLC filings, you're pitching blind — "you probably need a website" instead of "your website has these 7 problems."

2. **No industry/category data**: An LLC named "Bright Holdings LLC" tells you nothing. You can't filter by niche. You'd need to cross-reference or use NLP on entity names to guess the industry — unreliable.

3. **No email address**: Email isn't public record on most state filings. You'd need to find it through other means (skip tracing, LinkedIn lookup, or... physical mail).

4. **Many filings are NOT customer-facing businesses**: Holding companies, real estate LLCs, investment vehicles, single-member LLCs for liability protection — a large percentage of filings will never need a website. Noise ratio is high.

5. **Lower close rate per lead**: Because you can't personalize the pitch with specific audit data, the message is more generic and less compelling. Expected reply rate drops from 4-8% (audit-based) to 1-3% (generic "new business" outreach).

#### Verdict: STRONG COMPLEMENT, NOT A REPLACEMENT

LLC filings win on **timing** but lose on **signal strength and personalization**. The best use is as a complementary channel:

- **Google Maps** = "Your website has these problems" (evidence-based, high conversion)
- **LLC Filings** = "Welcome to business, let me build your first website" (timing-based, first mover)

**Should you build it?** Yes — as a Phase 2 add-on after the Google Maps pipeline is running. It's a different outreach motion (direct mail + LinkedIn) rather than cold email, and catches leads Google Maps misses entirely.

---

### Strategy 2: Google Ads Transparency Center + Landing Page Audit

**What it is**: The Google Ads Transparency Center (adstransparency.google.com) is a public database showing every ad a verified business runs across Google Search, YouTube, and Display. You can scrape this to find local businesses that are ACTIVELY SPENDING MONEY on Google Ads, then audit their landing pages. If they're sending paid traffic to a bad page, you can quantify exactly how much money they're wasting.

**The pitch**: "You're paying for Google Ads but sending visitors to a page that loads in 12 seconds, isn't mobile-friendly, and has no clear call to action. You're burning money. Let me fix that."

#### Why It's Compelling

1. **Strongest buying signal possible**: These businesses are already spending money on digital marketing. Budget exists. They believe in online customers. You're not convincing them to care about the web — they already do.

2. **Quantifiable pain**: "Your landing page converts at ~1% based on industry benchmarks, but a properly built page converts at 5-8%. If you're spending $2,000/mo on ads, you're wasting ~$1,500/mo on lost conversions." Money talks.

3. **Upsell potential**: Website redesign + landing page optimization + ongoing conversion rate optimization. These clients have higher lifetime value because they're already in a "spending on marketing" mindset.

4. **Low competition**: Almost no web design agencies are doing this. It's a differentiated approach.

5. **Public data**: The Ads Transparency Center is designed to be publicly accessible. No scraping gray areas.

#### Why It Falls Short

1. **Much lower volume**: Not every local business runs Google Ads. Maybe 5-15% of businesses in a given niche are active advertisers. This dramatically reduces your lead pool compared to Google Maps (which has EVERY business).

2. **No direct contact info**: The Ads Transparency Center shows ads and landing pages, not phone numbers or emails. You'd need to cross-reference with Google Maps data or scrape the landing page for contact info — adding steps.

3. **More sophisticated prospects**: Businesses running Google Ads are already doing digital marketing. They may already have an agency. You're selling into a more competitive situation.

4. **Ad spend data is hidden**: The Transparency Center shows WHICH ads are running but not HOW MUCH they're spending. You can infer budget from ad volume and keywords, but you can't show them an exact dollar amount of waste.

5. **Scraping complexity**: The Ads Transparency Center is JavaScript-heavy and requires browser automation. Pagination is complex. Available APIs (Apify, SearchAPI) are $2.50+ per 1,000 results.

#### Verdict: NICHE PLAY, HIGH VALUE BUT LOW VOLUME

This is a premium strategy for high-value clients ($5K-$20K projects) but can't be your primary pipeline due to low volume. Best used as a **targeting filter on top of Google Maps**: find businesses on Google Maps → check if they're running ads → if yes, audit their landing page → premium personalized outreach.

---

### Strategy 3: BuiltWith Technology Database

**What it is**: BuiltWith tracks 111,770+ web technologies across 673+ million websites. You can query their database to find every website in a specific area using Wix, Squarespace, GoDaddy Website Builder, outdated WordPress, expired SSL, etc. — essentially mass-identifying upgrade prospects.

**The pitch**: "Your site is built on Wix Free Plan. Here's what you're missing: custom design, SEO control, page speed, and professional credibility."

#### Why It's Compelling

1. **Massive scale**: 673M+ websites tracked. You can pull lists of thousands of Wix/Squarespace sites filtered by location, traffic, and industry.

2. **Precise targeting**: Filter by exact technology (Wix Free vs. Wix Premium vs. Squarespace Business), traffic tier, tech spend, and geography.

3. **"Actionable Insights" feature**: BuiltWith detects when companies are experimenting with new technologies or appear to be rebuilding their site — signaling they're actively looking to change.

4. **API + bulk export**: Data can be pulled programmatically for pipeline integration.

#### Why It Falls Short

1. **Expensive**: Full access is $295/mo (Basic) to $495/mo (Pro). That's 2-5x the cost of the entire Google Maps pipeline.

2. **Missing context**: BuiltWith tells you WHAT technology a site uses, but not WHO owns the business, their phone number, reviews, or rating. You'd need to cross-reference with Google Maps anyway for business context and contact info.

3. **Redundant with Google Maps audit**: The Google Maps pipeline already detects Wix/Squarespace/WordPress through the tech detection step (Layer 3). BuiltWith would just be a more expensive version of something you're already doing.

4. **No "need" signal**: Just because a business uses Wix doesn't mean they want to change. Many small businesses are perfectly happy with their Wix site. Without an audit showing specific problems, the pitch falls flat.

#### Verdict: EXPENSIVE AND REDUNDANT

The Google Maps pipeline already covers 80% of what BuiltWith offers through the tech detection audit step. The remaining 20% (technology change signals, traffic data) isn't worth $295-$495/mo. Skip this.

---

### Strategy 4: Newly Registered Domains (WHOIS Data)

**What it is**: Every day, ~70,000 new domain names are registered globally. Services like WhoisDownload.com and WhoisDataDownload.com sell daily feeds of these registrations with whatever WHOIS data is available. You could filter for domains that look like business names, check if they have a website built yet, and contact the registrant.

#### Why It Falls Short

1. **WHOIS privacy kills it**: Since ICANN mandated WHOIS privacy in 2018 (GDPR), the vast majority of new domain registrations have redacted contact information. You get the domain name and registrar, but NOT the owner's name, email, or phone. This guts the entire approach.

2. **Extreme noise**: 70,000 new domains/day includes domain speculators, parked domains, test projects, personal blogs, and spam sites. Maybe 1-5% are legitimate local businesses. Signal-to-noise ratio is terrible.

3. **No geographic targeting**: Domain names don't contain location data. "brightsmiledental.com" could be in any city. You'd need to wait until the site is live and check for address information.

4. **Costly**: $50-$349/mo for daily feeds of mostly useless data.

#### Verdict: DEAD ON ARRIVAL

WHOIS privacy made this strategy unviable. The data is too redacted, too noisy, and too disconnected from local business targeting. Not worth pursuing.

---

### Strategy 5: Crunchbase / Funded Startups

**What it is**: Use Crunchbase to find companies that recently raised Seed or Series A funding. They have fresh capital, are building their brand, and often need new or redesigned websites.

#### Why It Falls Short

1. **Wrong market segment**: Crunchbase tracks VC-backed startups, which are mostly tech companies. They tend to hire in-house designers or use premium agencies, not local web shops. Your $3K-$8K price point is too low for their expectations, or they'll build it themselves.

2. **Extremely competitive**: Every agency, freelancer, and design tool targets recently funded startups. The inbox of a freshly funded founder is already overflowing with pitches.

3. **Low volume**: Hundreds of funded companies per month nationally, not thousands. And they're concentrated in SF, NYC, Austin — not necessarily your market.

4. **Expensive data**: Crunchbase API access starts at $999/mo for meaningful access. Far too expensive for the volume you'd get.

#### Verdict: WRONG MARKET FOR NWS MEDIA

This strategy works for agencies charging $50K+ for enterprise-grade websites. At the local business price point, it's the wrong audience, too competitive, and too expensive to access.

---

### Strategy 6: Facebook/Instagram Business Pages Without Websites

**What it is**: Find businesses that are active on social media (posting regularly, have followers, running their business through Facebook/Instagram) but either have no website linked or link to a dead/bad site.

#### Why It's Interesting

1. **Proven businesses**: They're actively marketing themselves, which means they have customers and revenue.
2. **Clear gap**: Running a business through Instagram DMs is painful and limiting. You can articulate this pain clearly.
3. **Contact info available**: Facebook pages often have phone, email, and address listed.

#### Why It Falls Short

1. **Automation is very limited**: Facebook and Instagram aggressively block scraping. Their API access for business page data is restricted to page owners/admins. Third-party scrapers (Apify, IGLeads) exist but are unreliable and risk account bans.

2. **"No website" is hard to detect at scale**: You can't easily filter Facebook pages by "has no website linked." You'd need to scrape each page individually and check.

3. **Different buyer psychology**: Business owners who run everything through Instagram often *prefer* not having a website. They see it as unnecessary overhead. Convincing them is harder than convincing someone whose existing website is broken.

4. **Lower deal value**: Instagram-centric businesses tend to be smaller (individual creators, micro-businesses) with lower budgets.

#### Verdict: GOOD SIGNAL, BAD AUTOMATION

The signal is there, but the automation ceiling is too low. This is a manual prospecting strategy, not a pipeline you can automate. Better suited for a VA doing 30 min/day of manual research than a scraping system.

---

### Strategy 7: Job Board Scraping (Hiring Web/Marketing)

**What it is**: Scrape job boards (Indeed, LinkedIn Jobs, Glassdoor) for companies posting roles like "Web Developer," "Digital Marketing Manager," "Marketing Coordinator," etc. The signal: they have budget for web/marketing and are actively investing.

#### Why It Falls Short

1. **Inverted signal**: Companies hiring in-house web people are specifically building internal capability. They're LESS likely to hire an agency, not more. The best signal would be "company posted a marketing role, then deleted it" (they couldn't find someone and might outsource instead) — but that's nearly impossible to track.

2. **Low volume per market**: Maybe 10-30 relevant job postings per city per week. Not enough to build a pipeline.

3. **Enterprise-skewed**: Most companies posting web/marketing roles on job boards are mid-to-large businesses with $50K+ budgets or established agencies — not the local small businesses that are NWS Media's sweet spot.

4. **Decent automation, bad signal**: You CAN scrape Indeed easily, but the leads you get are poor quality for a local web design shop.

#### Verdict: WRONG SIGNAL FOR THIS BUSINESS

Works for marketing agencies selling $10K+/mo retainers. Doesn't work for project-based web design at the local business level.

---

### Strategy 8: Competitor Backlink Analysis

**What it is**: Use Ahrefs or SEMrush to analyze your competitors' backlink profiles. Sites linking to competitor web agencies are either clients, partners, or directories. You can find potential clients this way.

#### Why It Falls Short

1. **Tells you who ALREADY HAS an agency**: If a business links to a competitor's portfolio or has a "Designed by XYZ" footer link, they already have a web provider. You're selling against an incumbent — the hardest sale.

2. **Low volume**: Typical local web agencies have 20-100 portfolio links. That's not a pipeline.

3. **Requires expensive tools**: Ahrefs ($99/mo) or SEMrush ($130/mo) for backlink analysis.

4. **No automation advantage**: This is a research strategy, not a scraping pipeline. Useful for competitive intelligence, not daily lead generation.

#### Verdict: COMPETITIVE RESEARCH, NOT LEAD GEN

Good for understanding your market landscape. Bad for building an automated pipeline.

---

## The Final Comparison Matrix

| Strategy | Signal Strength | Automation | Volume | Data Quality | Contact Info | Cost | Legal Safety | Outreach Power | **TOTAL** |
|---|---|---|---|---|---|---|---|---|---|
| **Google Maps + Audit** | 5 | 5 | 5 | 5 | 4 | 5 | 4 | 5 | **38** |
| **LLC Filings** | 4 | 4 | 4 | 3 | 3 | 4 | 5 | 3 | **30** |
| **Ads Transparency + Audit** | 5 | 3 | 2 | 4 | 2 | 4 | 5 | 5 | **30** |
| BuiltWith | 3 | 4 | 5 | 3 | 1 | 2 | 5 | 3 | **26** |
| Facebook/Instagram Pages | 4 | 1 | 3 | 3 | 3 | 4 | 2 | 3 | **23** |
| Newly Registered Domains | 2 | 3 | 4 | 1 | 1 | 3 | 5 | 1 | **20** |
| Job Board Scraping | 2 | 4 | 1 | 2 | 2 | 4 | 5 | 2 | **22** |
| Competitor Backlinks | 2 | 2 | 1 | 3 | 2 | 2 | 5 | 2 | **19** |
| Crunchbase/Funding | 3 | 3 | 1 | 4 | 2 | 1 | 5 | 3 | **22** |

**Google Maps + Audit remains #1 by a clear margin (38 vs. 30).**

---

## The Recommended Hybrid: Google Maps + LLC Filings

After all this analysis, the strongest possible system is a **two-channel hybrid** that covers both ends of the business lifecycle:

### Channel 1: Google Maps + Website Audit (Primary — 80% of pipeline)
**Catches**: Established businesses with bad or no websites
**Pitch**: Evidence-based ("here are your specific problems")
**Outreach**: Cold email with personalized audit
**Timeline**: Contact businesses that have been operating for months/years
**Expected close rate**: 1-2 clients per 1,000 emails (higher quality)

### Channel 2: Secretary of State LLC Filings (Secondary — 20% of pipeline)
**Catches**: Brand-new businesses that don't exist online yet
**Pitch**: Timing-based ("welcome to business, let me get you set up")
**Outreach**: Direct mail + LinkedIn connection (no email available)
**Timeline**: Contact businesses within days of formation
**Expected close rate**: Lower per-lead, but ZERO competition

### Why This Hybrid Beats Any Single Strategy

```
BUSINESS LIFECYCLE COVERAGE:

  Day 0          Week 2-4           Month 2-6           Month 6+
    │                │                   │                   │
    ▼                ▼                   ▼                   ▼
 LLC Filed     Getting set up     Google Maps listing    Established
    │                │              appears here             │
    │                │                   │                   │
    └── LLC FILING ──┘                   └── GOOGLE MAPS ───┘
        CHANNEL                              CHANNEL
    (you're first)                     (you have evidence)
```

- **LLC Filings** catch businesses in the 0-8 week window before they have any web presence
- **Google Maps** catches everything from week 8 onward, with evidence-based outreach
- Together, they cover the ENTIRE lifecycle with zero blind spots

### What This Means Practically

| Metric | Google Maps Only | Hybrid (Maps + LLC) |
|---|---|---|
| Total addressable leads/month | 5,000 | 7,000-8,000 |
| Leads with zero competition | ~30% | ~50% |
| Outreach channels | Email only | Email + Direct Mail + LinkedIn |
| Business lifecycle coverage | Established only | New + Established |
| Monthly cost increase | $0 | +$30-$80 (API + postage) |
| Expected additional revenue | — | +$4K-$12K/month |

---

## Other Approaches: Not Worth Building, But Worth Doing Manually

These don't justify an automated pipeline, but take 15-30 minutes per week:

### Manual Quick Wins (No Automation Needed)

1. **Google Ads Transparency spot-checks**: Before sending an outreach email to a high-score lead from your Google Maps pipeline, spend 30 seconds checking if they run Google Ads. If they do, mention it in your email — "I noticed you're running Google Ads but your landing page loads in 14 seconds." This costs nothing and dramatically increases reply rates for those specific leads.

2. **LinkedIn manual outreach for LLC leads**: When your LLC filing pipeline surfaces a new business in a high-value niche, spend 2 minutes finding the owner on LinkedIn and sending a connection request with a personalized note. No automation needed — 5-10 per day.

3. **Referral program tracking**: This wasn't in the automation analysis because it can't be scraped, but referrals have the highest close rate of any source (30-50%). Build a simple referral page and offer existing clients $200-$500 per referral that closes. Track it in the same database.

---

## Final Answer

**Is there a strategy better than Google Maps + Website Audit?**

No. After evaluating 8 alternatives across 9 dimensions, Google Maps + Website Audit remains the highest-scoring strategy by a significant margin (38 vs. 30 for the next best).

**Is there a strategy worth ADDING to it?**

Yes — Secretary of State LLC Filings. It's the only alternative that offers something Google Maps fundamentally can't: a timing advantage. It catches businesses before they exist online. Build it as your Phase 2 channel after the Google Maps pipeline is operational.

**Everything else?**

Not worth building an automated system for. BuiltWith is expensive and redundant. WHOIS data is dead due to privacy laws. Crunchbase is the wrong market. Facebook/Instagram can't be automated reliably. Job boards have the wrong signal. Competitor backlinks are a research tool, not a pipeline. Google Ads Transparency is useful as a manual enrichment step on high-value leads, not as a standalone source.

**The final recommended build order:**

1. **Phase 1** (Weeks 1-5): Build the Google Maps + Website Audit pipeline (see `LEAD_ENGINE_PLAN.md`)
2. **Phase 2** (Weeks 6-7): Add LLC Filing channel with direct mail outreach
3. **Phase 3** (Ongoing): Manual enrichment — check Google Ads, LinkedIn, referral tracking
4. **Never**: BuiltWith, WHOIS domains, Crunchbase, Facebook scraping
