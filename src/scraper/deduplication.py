import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.business import Business


def normalize_name(name: str | None) -> str:
    """Lowercase, strip accents, remove punctuation/extra whitespace for fuzzy matching."""
    if not name:
        return ""
    s = unicodedata.normalize("NFKD", name)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9 ]", "", s.lower())
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_phone(phone: str | None) -> str:
    """Strip everything but digits; keep last 10 (US numbers)."""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    return digits[-10:] if len(digits) >= 10 else digits


async def get_existing_place_ids(session: AsyncSession, place_ids: list[str]) -> set[str]:
    """Return set of place_ids that already exist in the database."""
    if not place_ids:
        return set()
    result = await session.execute(
        select(Business.place_id).where(Business.place_id.in_(place_ids))
    )
    return {row[0] for row in result.fetchall()}


async def get_existing_name_keys(session: AsyncSession) -> set[str]:
    """Build a set of 'normalized_name|normalized_phone' keys for every row in the DB.

    Used as a secondary dedup when place_id alone is unreliable.
    """
    result = await session.execute(
        select(Business.name, Business.phone, Business.city)
    )
    keys: set[str] = set()
    for name, phone, city in result.fetchall():
        nn = normalize_name(name)
        np = normalize_phone(phone)
        nc = normalize_name(city)
        if nn:
            keys.add(f"{nn}|{np}")
            if nc:
                keys.add(f"{nn}|{nc}")
    return keys


def _make_name_keys(r: dict) -> list[str]:
    """Return dedup keys for a scraped result dict."""
    nn = normalize_name(r.get("name"))
    np = normalize_phone(r.get("phone"))
    nc = normalize_name(r.get("city"))
    keys = []
    if nn:
        keys.append(f"{nn}|{np}")
        if nc:
            keys.append(f"{nn}|{nc}")
    return keys


def deduplicate_results(
    results: list[dict],
    existing_place_ids: set[str],
    existing_name_keys: set[str] | None = None,
) -> list[dict]:
    """Remove results whose place_id OR name+phone/name+city already exist."""
    seen_pids = set(existing_place_ids)
    seen_names = set(existing_name_keys or set())
    unique = []
    for r in results:
        pid = r.get("place_id")
        if pid and pid in seen_pids:
            continue
        name_keys = _make_name_keys(r)
        if name_keys and any(k in seen_names for k in name_keys):
            continue
        if pid:
            seen_pids.add(pid)
        for k in name_keys:
            seen_names.add(k)
        unique.append(r)
    return unique
