from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.business import Business


async def get_existing_place_ids(session: AsyncSession, place_ids: list[str]) -> set[str]:
    """Return set of place_ids that already exist in the database."""
    if not place_ids:
        return set()
    result = await session.execute(
        select(Business.place_id).where(Business.place_id.in_(place_ids))
    )
    return {row[0] for row in result.fetchall()}


def deduplicate_results(results: list[dict], existing_place_ids: set[str]) -> list[dict]:
    """Remove results whose place_id is already in the database or duplicated within the batch."""
    seen = set(existing_place_ids)
    unique = []
    for r in results:
        pid = r.get("place_id")
        if pid and pid not in seen:
            seen.add(pid)
            unique.append(r)
    return unique
