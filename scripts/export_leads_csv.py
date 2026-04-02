"""Export all businesses to a CSV file (UTF-8 with BOM for Excel)."""

import asyncio
import csv
import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

from src.database import async_session
from src.models.business import Business


def _cell(v: object) -> str:
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, dict):
        return json.dumps(v, ensure_ascii=False)
    return str(v)


async def main() -> None:
    desktop = Path.home() / "Desktop"
    out = desktop / "nwsmedia_leads_export.csv"
    cols = [
        "id",
        "place_id",
        "source_channel",
        "name",
        "category",
        "address",
        "city",
        "state",
        "zip_code",
        "phone",
        "email",
        "website",
        "rating",
        "review_count",
        "photos_count",
        "latitude",
        "longitude",
        "hours",
        "maps_url",
        "source_url",
        "listing_description",
        "scraped_at",
        "updated_at",
    ]

    async with async_session() as session:
        result = await session.execute(select(Business).order_by(Business.id))
        rows = result.scalars().all()

    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for b in rows:
            w.writerow([_cell(getattr(b, c)) for c in cols])

    print(f"Wrote {len(rows)} rows to {out}")


if __name__ == "__main__":
    asyncio.run(main())
