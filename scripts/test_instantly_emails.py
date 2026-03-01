#!/usr/bin/env python3
"""
Add 5 test leads to the 3 Instantly campaigns (No Website, Dead Website, Has Website)
so you can verify routing and email content. Uses example merge-tag data.
"""
import asyncio
import os
import sys

# Project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import settings

# Instantly API v2 (v1 deprecated; v2 uses Bearer auth)
INSTANTLY_API_V2 = "https://api.instantly.ai/api/v2"

# 5 test emails → 3 campaigns (2 + 2 + 1)
TEST_LEADS = [
    # No Website campaign (2)
    {
        "email": "mkaneko7193@gmail.com",
        "first_name": "Maru",
        "last_name": "Kaneko",
        "company_name": "Test Biz No Website",
        "campaign_id": "no_website",
        "custom_variables": {
            "rating": "4.8",
            "review_count": "24",
            "category": "HVAC contractor",
            "city": "Houston",
            "lead_score": "61",
            "segment": "NEW_SMALL",
            "tier": "WARM",
            "triage_status": "NO_WEBSITE",
            "issues_found": "No website found",
            "performance_score": "",
            "seo_score": "",
        },
    },
    {
        "email": "maru@seedpulsefund.com",
        "first_name": "Maru",
        "last_name": "",
        "company_name": "Seed Pulse Fund (Test)",
        "campaign_id": "no_website",
        "custom_variables": {
            "rating": "5.0",
            "review_count": "12",
            "category": "Plumber",
            "city": "Austin",
            "lead_score": "58",
            "segment": "NEW_SMALL",
            "tier": "WARM",
            "triage_status": "NO_WEBSITE",
            "issues_found": "No website found",
            "performance_score": "",
            "seo_score": "",
        },
    },
    # Dead Website campaign (2)
    {
        "email": "maru@vaulte.info",
        "first_name": "Maru",
        "last_name": "",
        "company_name": "Vaulte (Test Dead)",
        "campaign_id": "dead_website",
        "custom_variables": {
            "rating": "4.9",
            "review_count": "89",
            "category": "Dentist",
            "city": "Houston",
            "lead_score": "56",
            "segment": "ESTABLISHED",
            "tier": "COOL",
            "triage_status": "DEAD_WEBSITE",
            "issues_found": "Website unreachable",
            "performance_score": "",
            "seo_score": "",
            "website": "example.com",
        },
    },
    {
        "email": "koji@vaulte.info",
        "first_name": "Koji",
        "last_name": "",
        "company_name": "Vaulte Team (Test Dead)",
        "campaign_id": "dead_website",
        "custom_variables": {
            "rating": "4.7",
            "review_count": "45",
            "category": "HVAC contractor",
            "city": "Dallas",
            "lead_score": "54",
            "segment": "ESTABLISHED",
            "tier": "COOL",
            "triage_status": "DEAD_WEBSITE",
            "issues_found": "Website unreachable",
            "performance_score": "",
            "seo_score": "",
            "website": "old-site.com",
        },
    },
    # Has Website campaign (1)
    {
        "email": "shunya@nwsmedia.com",
        "first_name": "Shunya",
        "last_name": "",
        "company_name": "NWS Media (Test Has Website)",
        "campaign_id": "has_website",
        "custom_variables": {
            "rating": "5.0",
            "review_count": "150",
            "category": "Web design",
            "city": "Houston",
            "lead_score": "51",
            "segment": "ESTABLISHED",
            "tier": "WARM",
            "triage_status": "HAS_WEBSITE",
            "issues_found": "Slow speed (34/100); Low SEO (52/100)",
            "performance_score": "34",
            "seo_score": "52",
            "website": "nwsmedia.com",
        },
    },
]


def get_campaign_id(campaign_key: str) -> str:
    if campaign_key == "no_website":
        return settings.instantly_campaign_id_no_website or settings.instantly_campaign_id_maps
    if campaign_key == "dead_website":
        return settings.instantly_campaign_id_dead_website or settings.instantly_campaign_id_maps
    if campaign_key == "has_website":
        return settings.instantly_campaign_id_has_website or settings.instantly_campaign_id_maps
    return settings.instantly_campaign_id_maps


async def add_lead(lead: dict) -> tuple[str, bool]:
    import aiohttp

    cid = get_campaign_id(lead["campaign_id"])
    # API v2: Bearer auth, single lead per request
    payload = {
        "campaign": cid,
        "email": lead["email"],
        "first_name": lead.get("first_name") or "",
        "last_name": lead.get("last_name") or "",
        "company_name": lead.get("company_name") or "Test Company",
        "phone": lead["custom_variables"].get("phone", ""),
        "website": lead["custom_variables"].get("website", ""),
        "skip_if_in_workspace": False,
        "custom_variables": {k: str(v) for k, v in lead["custom_variables"].items() if k not in ("website", "phone")},
    }
    headers = {
        "Authorization": f"Bearer {settings.instantly_api_key}",
        "Content-Type": "application/json",
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{INSTANTLY_API_V2}/leads", json=payload, headers=headers) as resp:
                try:
                    data = await resp.json()
                except Exception:
                    data = {"text": await resp.text()}
                if resp.status >= 400:
                    if resp.status == 401:
                        print("    Instantly API 401: Check INSTANTLY_API_KEY in .env (use API v2 key from Settings → Integrations → API)")
                    else:
                        print(f"    API {resp.status}: {data}")
                    return lead["email"], False
                if isinstance(data, dict) and data.get("status") == "error":
                    print(f"    API error: {data}")
                    return lead["email"], False
                return lead["email"], True
    except Exception as e:
        print(f"  Error: {e}")
        return lead["email"], False


async def main():
    if not settings.instantly_api_key:
        print("Missing INSTANTLY_API_KEY in .env")
        return
    if not settings.instantly_campaign_id_maps and not get_campaign_id("no_website"):
        print("Missing Instantly campaign IDs in .env")
        return

    print("Adding 5 test leads to Instantly campaigns:\n")
    print("  No Website (2):  mkaneko7193@gmail.com, maru@seedpulsefund.com")
    print("  Dead Website (2): maru@vaulte.info, koji@vaulte.info")
    print("  Has Website (1): shunya@nwsmedia.com\n")

    for lead in TEST_LEADS:
        email, ok = await add_lead(lead)
        campaign = lead["campaign_id"]
        status = "OK" if ok else "FAILED"
        print(f"  {email} → {campaign}: {status}")

    print("\nDone. Check each campaign in Instantly for the new leads.")


if __name__ == "__main__":
    asyncio.run(main())
