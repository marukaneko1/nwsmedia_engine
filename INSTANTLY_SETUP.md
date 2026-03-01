# Instantly.ai Setup Guide

> Step-by-step setup for the NWS Media lead engine. Your pipeline pushes leads via the API — this guide configures Instantly to receive and send them.

---

## 1. Account & API Key

1. **Sign up** at [instantly.ai](https://instantly.ai) (Growth plan: $30/mo — warmup, 5K contacts).
2. **Get your API key:**
   - Go to **Settings** (gear) → **Integrations** → **API**
   - Copy the **API Key**
3. **Add to `.env`:**
   ```
   INSTANTLY_API_KEY=your_api_key_here
   ```

---

## 2. Connect Sending Accounts

1. **Go to:** Email Accounts → **Add Account**
2. **Add your sending addresses** (from `nwsmediaoutreach.com`):
   - `design@nwsmediaoutreach.com`
   - `general@nwsmediaoutreach.com`
   - (Add `info@`, `team@`, etc. later if needed)
3. **Use IMAP/SMTP** (Namecheap Private Email):
   - IMAP: `mail.privateemail.com`, port 993 (SSL)
   - SMTP: `mail.privateemail.com`, port 465 (SSL)
   - Use the same credentials as your inbox
4. **Verify:** Instantly will send a test email; confirm it connects.
5. **Warmup:**
   - Enable warmup for each account
   - Let it run 14+ days before sending cold outreach
   - Start with ~10–15 emails/day per account and let it ramp

---

## 3. Create a Campaign (Google Maps Channel)

1. **Go to:** Campaigns → **New Campaign**
2. **Name it:** e.g. `Google Maps - HVAC/Dental/Plumbing`
3. **Settings:**
   - **Daily limit per account:** Start at 20–30 (you can raise after warmup)
   - **Sending accounts:** Select design@ + general@ (rotate between them)
   - **Timezone:** Your local (or target market)
   - **Skip weekends:** Optional (many B2B prefer Mon–Fri)
4. **Copy the Campaign ID:**
   - Open the campaign → look at the URL: `.../campaign/abc123...`
   - Or: Campaign Settings → **Integrations** → copy the campaign ID
5. **Add to `.env`:**
   ```
   INSTANTLY_CAMPAIGN_ID_MAPS=your_campaign_id_here
   ```

---

## 4. Add Custom Variables to the Campaign

Your pipeline sends these fields via API. Instantly will use them as merge tags in your emails.

| Variable         | Example       | Use in email |
|------------------|---------------|--------------|
| `first_name`     | John          | Hi {{ first_name }} |
| `last_name`      | Smith         | {{ last_name }} |
| `company_name`   | Houston HVAC  | {{ company_name }} |
| `rating`         | 4.8           | {{ rating }} stars |
| `review_count`   | 127           | {{ review_count }} reviews |
| `category`       | HVAC contractor | {{ category }} in {{ city }} |
| `city`           | Houston       | {{ city }} |
| `lead_score`     | 56            | (internal; optional in emails) |
| `segment`        | ESTABLISHED   | (internal; used for conditional copy) |
| `tier`           | WARM          | (internal) |
| `triage_status`  | NO_WEBSITE    | (internal; used for conditional copy) |
| `issues_found`   | Slow speed, low SEO | {{ issues_found }} |
| `performance_score` | 34        | {{ performance_score }}/100 |
| `seo_score`      | 52            | {{ seo_score }}/100 |

**To add custom variables in Instantly:**
- Go to **Campaign** → **Variables** (or Lead Variables)
- Create variables: `rating`, `review_count`, `category`, `city`, `lead_score`, `segment`, `tier`, `triage_status`, `issues_found`, `performance_score`, `seo_score`
- Or: they may auto-map when leads are added via API with `custom_variables` — check your Instantly docs/API version

**Merge tag format:** `{{ variable_name }}` or `{{ variable_name | default_value }}`  
Example: `{{ rating }}` → `4.8`, or `{{ owner_name | default("there") }}` — note: we send `first_name` as owner; use `{{ first_name }}` for “Hi John” style.

---

## 5. Create the 5-Email Sequence

Use your templates from `templates/`. Instantly expects Subject + Body per step.

| Step | Day | Template file      | Subject (from template) |
|------|-----|--------------------|--------------------------|
| 1    | 0   | `email_initial.txt`| ideas for {{ company_name }} |
| 2    | 3   | `email_followup_1.txt` | re: {{ company_name }} |
| 3    | 7   | `email_followup_2.txt` | quick question about {{ company_name }} |
| 4    | 14  | `email_followup_3.txt` | still interested or should I move on? |
| 5    | 28  | `email_followup_4.txt` | {{ first_name }}, one last thing |

**In Instantly:**
1. **Email 1 (Initial):** Copy subject + body from `email_initial.txt`. Replace Jinja `{{ ... }}` with Instantly merge tags:
   - `{{ business_name }}` → `{{ company_name }}`
   - `{{ owner_name | default("there") }}` → `{{ first_name | default("there") }}`
   - `{{ category }}`, `{{ city }}`, `{{ review_count }}`, `{{ rating }}`, etc. stay as-is if you created those variables
2. **Follow-ups 2–5:** Repeat for each template. Include the Calendly link in follow-up 1 and 3: `https://calendly.com/shunya-nwsmedia/30min`
3. **Timing:** Set days between steps (0 → 3 → 7 → 14 → 28)
4. **Unsubscribe:** Add an unsubscribe link (Instantly provides this) — required for compliance

**Note:** Your templates use Jinja conditionals (`{% if segment == "NEW_SMALL" %}`). Instantly doesn’t support conditionals natively. Options:
- **A)** Simplify to one version per email (e.g. generic “your site” copy)
- **B)** Create 2–3 variants and use Instantly’s A/B testing
- **C)** Keep conditionals in your own renderer and send pre-rendered HTML/plain text via API (if Instantly supports that)

Check Instantly’s API docs for “lead/add” — you may be able to pass `custom_variables` and pre-rendered content. Our current flow sends raw lead fields and relies on Instantly merge tags.

---

## 6. DKIM / SPF / DMARC (Deliverability)

You already have 10/10 on mail-tester. Ensure Instantly is allowed to send:

1. **Settings** → **Domains** → Add `nwsmediaoutreach.com`
2. Instantly will show DNS records. Add them to Namecheap (CNAME for DKIM, etc.)
3. **SPF:** If you use Namecheap Private Email, your SPF may already be set. Instantly may ask you to add an `include:` — only add it if Instantly requires it; having multiple includes is fine.
4. **DMARC:** Keep your existing policy; no change needed if you’re already passing.

---

## 7. Test the Integration

1. **Dry run (no API call):**
   ```
   python run.py outreach --min-score 50 --limit 3 --dry-run
   ```
   - Check logs: leads should be “dry_run” and logged to `outreach_log`.

2. **Live run (sends to Instantly):**
   ```
   python run.py outreach --min-score 50 --limit 3
   ```
   - Leads should appear in the campaign in Instantly.
   - Check **Leads** tab → verify `company_name`, `rating`, `review_count`, `category`, `city`, etc.

3. **Send a test to yourself:**
   - Add your own email as a test lead in Instantly (or use a small batch).
   - Confirm emails land in **inbox**, not spam.

---

## 8. Checklist Summary

- [ ] Instantly account created (Growth plan)
- [ ] API key copied → `INSTANTLY_API_KEY` in `.env`
- [ ] Campaign created → Campaign ID → `INSTANTLY_CAMPAIGN_ID_MAPS` in `.env`
- [ ] Sending accounts connected (design@, general@)
- [ ] Warmup enabled (14+ days recommended)
- [ ] Custom variables added (or confirmed API maps them)
- [ ] 5-email sequence created (initial + 4 follow-ups)
- [ ] Calendly link in follow-up 1 and 3
- [ ] Unsubscribe link in footer
- [ ] `python run.py outreach --dry-run` succeeds
- [ ] `python run.py outreach --limit 3` adds leads to campaign
- [ ] Test emails land in inbox

---

## 9. API Reference (What Our Pipeline Sends)

```
POST https://api.instantly.ai/api/v1/lead/add
{
  "api_key": "...",
  "campaign_id": "...",
  "skip_if_in_workspace": true,
  "leads": [{
    "email": "owner@business.com",
    "first_name": "John",
    "last_name": "Smith",
    "company_name": "Houston HVAC Services",
    "phone": "+1 555...",
    "website": "https://...",
    "custom_variables": {
      "rating": "4.8",
      "review_count": "127",
      "category": "HVAC contractor",
      "city": "Houston",
      "lead_score": "56",
      "segment": "ESTABLISHED",
      "tier": "WARM",
      "triage_status": "HAS_WEBSITE",
      "issues_found": "Slow speed (34/100); Low SEO (52/100)",
      "performance_score": "34",
      "seo_score": "52"
    }
  }]
}
```

Make sure your Instantly campaign variables match these names so merge tags resolve correctly.
