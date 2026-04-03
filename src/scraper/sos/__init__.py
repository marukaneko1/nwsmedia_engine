"""Secretary of State new-business filings scraper.

Supports bulk CSV import (FL, TX) and enrichment via Apollo.io.
"""

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.business import Business
from src.scraper.deduplication import (
    deduplicate_results,
    get_existing_name_keys,
    get_existing_place_ids,
)
from src.scraper.sos.csv_parser import parse_florida_csv, parse_texas_csv
from src.utils.time import utcnow

logger = structlog.get_logger()


async def import_filings(
    state: str,
    file_path: str,
    *,
    days_min: int = 14,
    days_max: int = 75,
    entity_types: list[str] | None = None,
) -> list[dict]:
    """Parse a state bulk CSV file and return filtered business dicts."""
    state = state.upper()

    if state == "FL":
        records = parse_florida_csv(file_path, days_min=days_min, days_max=days_max, entity_types=entity_types)
    elif state == "TX":
        records = parse_texas_csv(file_path, days_min=days_min, days_max=days_max, entity_types=entity_types)
    else:
        logger.error("unsupported_state", state=state)
        return []

    logger.info("sos_import", state=state, records=len(records))
    return records


async def save_sos_businesses(session: AsyncSession, businesses: list[dict]) -> int:
    """Deduplicate and save SoS filings to the businesses table."""
    if not businesses:
        return 0

    place_ids = [b["place_id"] for b in businesses if b.get("place_id")]
    existing_pids = await get_existing_place_ids(session, place_ids)
    existing_names = await get_existing_name_keys(session)
    unique = deduplicate_results(businesses, existing_pids, existing_names)

    for biz in unique:
        record = Business(
            place_id=biz["place_id"],
            source_channel=biz.get("source_channel", "sos"),
            name=biz["name"],
            category=biz.get("category"),
            address=biz.get("address"),
            city=biz.get("city"),
            state=biz.get("state"),
            zip_code=biz.get("zip_code"),
            phone=biz.get("phone"),
            filing_date=biz.get("filing_date"),
            entity_type=biz.get("entity_type"),
            registered_agent=biz.get("registered_agent"),
            officer_names=biz.get("officer_names"),
            scraped_at=utcnow(),
        )
        session.add(record)

    await session.commit()
    logger.info("sos_saved", new=len(unique), skipped=len(businesses) - len(unique))
    return len(unique)
