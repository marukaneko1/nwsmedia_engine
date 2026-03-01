# Instantly: 3 campaigns for richer copy (by triage status)

Instantly doesn't support `{% if %}` conditionals, but it **does** support **multiple campaigns** and **variants per step**. Use **3 campaigns** so each lead gets the right message:

| Campaign | When used | Set in .env |
|----------|-----------|--------------|
| **NWS Media - No Website** | `triage_status` = NO_WEBSITE | `INSTANTLY_CAMPAIGN_ID_NO_WEBSITE` |
| **NWS Media - Dead Website** | `triage_status` = DEAD_WEBSITE | `INSTANTLY_CAMPAIGN_ID_DEAD_WEBSITE` |
| **NWS Media - Has Website** | HAS_WEBSITE / PAGE_BUILDER / FREE_SUBDOMAIN | `INSTANTLY_CAMPAIGN_ID_HAS_WEBSITE` |

If you don't set the optional IDs, all leads go to `INSTANTLY_CAMPAIGN_ID_MAPS` (single campaign, generic copy).

---

## 1. Create 3 campaigns in Instantly

- Duplicate your current "NWS Media" campaign twice (or create two more).
- Name them: **NWS Media - No Website**, **NWS Media - Dead Website**, **NWS Media - Has Website**.
- Copy the Campaign ID from each URL and add to `.env` (see below).

---

## 2. Copy the sequences into each campaign

**Templates are in `templates/`** — one file per campaign per step. Copy Subject (first line after "Subject: ") and Body (rest) into Instantly.

| Campaign | Step 1 (initial) | Step 2 | Step 3 | Step 4 | Step 5 |
|----------|------------------|--------|--------|--------|--------|
| **No Website** | `NWS_MEDIA_NO_WEBSITE_initial.txt` | `NWS_MEDIA_NO_WEBSITE_followup_1.txt` | `followup_2` | `followup_3` | `followup_4` |
| **Dead Website** | `NWS_MEDIA_DEAD_WEBSITE_initial.txt` | `NWS_MEDIA_DEAD_WEBSITE_followup_1.txt` | `followup_2` | `followup_3` | `followup_4` |
| **Has Website** | `NWS_MEDIA_HAS_WEBSITE_initial.txt` | `NWS_MEDIA_HAS_WEBSITE_followup_1.txt` | `followup_2` | `followup_3` | `followup_4` |

Use **only** `{{ variable }}` — no Jinja.

**Merge tags:** `{{ first_name }}`, `{{ company_name }}`, `{{ category }}`, `{{ city }}`, `{{ review_count }}`, `{{ rating }}`, `{{ website }}`, `{{ issues_found }}`, `{{ performance_score }}`, `{{ seo_score }}`, `{{ copyright_year }}`  
Set **first_name** default to **there** in Instantly so "Hi {{ first_name }}" shows "Hi there" when empty.

---

### Campaign: No Website

**Files:** `NWS_MEDIA_NO_WEBSITE_initial.txt`, `NWS_MEDIA_NO_WEBSITE_followup_1.txt` … `followup_4.txt`

**Step 1 – Subject:** `ideas for {{ company_name }}`

**Step 1 – Body:** (copy from `NWS_MEDIA_NO_WEBSITE_initial.txt` — lines after "Subject:")

---

### Campaign: Dead Website

**Files:** `NWS_MEDIA_DEAD_WEBSITE_initial.txt`, `NWS_MEDIA_DEAD_WEBSITE_followup_1.txt` … `followup_4.txt`

**Step 1 – Subject:** `ideas for {{ company_name }}`

**Step 1 – Body:** (copy from `NWS_MEDIA_DEAD_WEBSITE_initial.txt`)

---

### Campaign: Has Website

**Files:** `NWS_MEDIA_HAS_WEBSITE_initial.txt`, `NWS_MEDIA_HAS_WEBSITE_followup_1.txt` … `followup_4.txt`

**Step 1 – Subject:** `ideas for {{ company_name }}`

**Step 1 – Body:** (copy from `NWS_MEDIA_HAS_WEBSITE_initial.txt`)

---

## 3. .env

```env
INSTANTLY_CAMPAIGN_ID_MAPS=your_default_campaign_id

# Optional: triage-specific campaigns (pipeline routes leads automatically)
INSTANTLY_CAMPAIGN_ID_NO_WEBSITE=uuid_for_no_website_campaign
INSTANTLY_CAMPAIGN_ID_DEAD_WEBSITE=uuid_for_dead_website_campaign
INSTANTLY_CAMPAIGN_ID_HAS_WEBSITE=uuid_for_has_website_campaign
```

If the optional IDs are set, `python run.py outreach` will send each lead to the campaign that matches their `triage_status`. If not set, every lead goes to `INSTANTLY_CAMPAIGN_ID_MAPS`.
