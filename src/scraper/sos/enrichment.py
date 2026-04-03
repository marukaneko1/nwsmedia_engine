"""Apollo.io enrichment for Secretary of State filings.

SoS filings rarely include email, so we use Apollo's people search API
to find the owner email from name + company name.
"""

import aiohttp
import structlog

from src.config import settings
from src.models.enrichment import EnrichmentData
from src.utils.time import utcnow

logger = structlog.get_logger()

APOLLO_PEOPLE_SEARCH = "https://api.apollo.io/v1/mixed_people/search"


async def apollo_lookup(person_name: str, company_name: str) -> dict:
    """Search Apollo.io for a person at a company and return contact info."""
    api_key = settings.apollo_api_key
    if not api_key:
        return {"email": None, "owner_name": None, "owner_position": None}

    parts = person_name.strip().split(maxsplit=1)
    first_name = parts[0] if parts else ""
    last_name = parts[1] if len(parts) > 1 else ""

    payload = {
        "api_key": api_key,
        "q_organization_name": company_name,
        "page": 1,
        "per_page": 5,
    }
    if first_name:
        payload["person_titles"] = ["owner", "founder", "ceo", "president", "managing member"]
    if first_name:
        payload["q_keywords"] = f"{first_name} {last_name}".strip()

    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(APOLLO_PEOPLE_SEARCH, json=payload) as resp:
                if resp.status != 200:
                    logger.warning("apollo_error", status=resp.status)
                    return {"email": None, "owner_name": None, "owner_position": None}
                data = await resp.json()
    except Exception as e:
        logger.warning("apollo_request_failed", error=str(e))
        return {"email": None, "owner_name": None, "owner_position": None}

    people = data.get("people", [])
    if not people:
        return {"email": None, "owner_name": None, "owner_position": None}

    best = people[0]
    return {
        "email": best.get("email"),
        "owner_name": f"{best.get('first_name', '')} {best.get('last_name', '')}".strip() or None,
        "owner_position": best.get("title"),
        "linkedin": best.get("linkedin_url"),
    }


BATCH_SIZE = 25


async def enrich_sos_leads(session, businesses: list) -> dict:
    """Run Apollo enrichment on SoS businesses that lack email.

    Args:
        session: SQLAlchemy async session.
        businesses: list of Business ORM objects with officer_names populated.

    Returns:
        Dict with enrichment counts.
    """
    from sqlalchemy import select

    counts = {"enriched": 0, "no_email": 0, "skipped": 0, "apollo_calls": 0}
    pending = 0

    for biz in businesses:
        existing = (await session.execute(
            select(EnrichmentData).where(EnrichmentData.business_id == biz.id)
        )).scalar_one_or_none()
        if existing:
            counts["skipped"] += 1
            continue

        person_name = ""
        if biz.officer_names and isinstance(biz.officer_names, list):
            for officer in biz.officer_names:
                if isinstance(officer, dict) and officer.get("name"):
                    person_name = officer["name"]
                    break

        if not person_name and biz.registered_agent:
            person_name = biz.registered_agent

        result = await apollo_lookup(person_name, biz.name)
        counts["apollo_calls"] += 1

        record = EnrichmentData(
            business_id=biz.id,
            best_email=result.get("email"),
            all_emails=[result["email"]] if result.get("email") else None,
            owner_name=result.get("owner_name"),
            owner_position=result.get("owner_position"),
            social_profiles={"linkedin": result["linkedin"]} if result.get("linkedin") else None,
            enrichment_source="apollo" if result.get("email") else None,
            enriched_at=utcnow(),
        )
        session.add(record)
        pending += 1

        if result.get("email"):
            counts["enriched"] += 1
            logger.info("sos_enriched", business=biz.name, email=result["email"][:30])
        else:
            counts["no_email"] += 1

        if pending >= BATCH_SIZE:
            await session.commit()
            pending = 0

    if pending > 0:
        await session.commit()

    return counts
