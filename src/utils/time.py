"""UTC datetime helper — returns naive datetimes for TIMESTAMP WITHOUT TIME ZONE columns."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return current UTC time as a naive datetime (no tzinfo).

    asyncpg is strict: TIMESTAMP WITHOUT TIME ZONE columns reject tz-aware
    datetimes. This helper keeps all DB timestamps consistent.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
