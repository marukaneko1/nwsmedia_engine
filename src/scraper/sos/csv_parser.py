"""Parsers for Secretary of State bulk data files.

Florida (Sunbiz.org): pipe-delimited flat file, $50 one-time purchase.
Texas (sos.state.tx.us): standard CSV, $75 one-time purchase.
"""

import csv
from datetime import date, datetime, timedelta
from pathlib import Path

import structlog

logger = structlog.get_logger()


def _within_date_range(filing_date: date | None, days_min: int, days_max: int) -> bool:
    if not filing_date:
        return False
    today = date.today()
    delta = (today - filing_date).days
    return days_min <= delta <= days_max


def _parse_date(value: str, formats: list[str] | None = None) -> date | None:
    if not value or not value.strip():
        return None
    formats = formats or ["%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y", "%Y/%m/%d"]
    for fmt in formats:
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _normalize_entity_type(raw: str) -> str:
    raw = raw.strip().upper()
    mapping = {
        "DOMESTIC LIMITED LIABILITY COMPANY": "LLC",
        "FOREIGN LIMITED LIABILITY COMPANY": "LLC",
        "FLORIDA LIMITED LIABILITY COMPANY": "LLC",
        "DOMESTIC LIMITED LIABILITY": "LLC",
        "LLC": "LLC",
        "L.L.C.": "LLC",
        "DOMESTIC PROFIT CORPORATION": "Corporation",
        "FOREIGN PROFIT CORPORATION": "Corporation",
        "DOMESTIC NONPROFIT CORPORATION": "Nonprofit",
        "FOREIGN NONPROFIT CORPORATION": "Nonprofit",
        "LIMITED PARTNERSHIP": "LP",
        "DOMESTIC LIMITED PARTNERSHIP": "LP",
        "FOREIGN LIMITED PARTNERSHIP": "LP",
    }
    for key, val in mapping.items():
        if key in raw:
            return val
    if "LLC" in raw or "LIMITED LIABILITY" in raw:
        return "LLC"
    if "CORP" in raw:
        return "Corporation"
    if "LP" in raw or "LIMITED PARTNERSHIP" in raw:
        return "LP"
    return raw[:50]


def parse_florida_csv(
    file_path: str,
    *,
    days_min: int = 14,
    days_max: int = 75,
    entity_types: list[str] | None = None,
) -> list[dict]:
    """Parse Florida Sunbiz pipe-delimited bulk export.

    Expected columns (pipe-separated):
    Corp Number | Corp Name | Status | Filing Type | Filing Date |
    Address | City | State | Zip | Country |
    Officer Name | Officer Title | Officer Address | Officer City | Officer State | Officer Zip |
    Registered Agent | RA Address | RA City | RA State | RA Zip
    """
    path = Path(file_path)
    if not path.exists():
        logger.error("fl_file_not_found", path=file_path)
        return []

    results: list[dict] = []
    accepted_types = {t.upper() for t in (entity_types or ["LLC", "Corporation"])}

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f, delimiter="|")
        header = next(reader, None)
        if not header:
            return []

        for row in reader:
            if len(row) < 17:
                continue

            doc_number = row[0].strip()
            name = row[1].strip()
            status = row[2].strip().upper()
            filing_type = row[3].strip()
            filing_date_str = row[4].strip()
            address = row[5].strip()
            city = row[6].strip()
            state = row[7].strip()
            zip_code = row[8].strip()
            officer_name = row[10].strip() if len(row) > 10 else ""
            officer_title = row[11].strip() if len(row) > 11 else ""
            agent_name = row[16].strip() if len(row) > 16 else ""

            if status not in ("ACTIVE", "ACT"):
                continue

            entity = _normalize_entity_type(filing_type)
            if accepted_types and entity.upper() not in accepted_types and entity not in accepted_types:
                continue

            filing_date = _parse_date(filing_date_str)
            if not _within_date_range(filing_date, days_min, days_max):
                continue

            officers = []
            if officer_name:
                officers.append({"name": officer_name, "title": officer_title})

            results.append({
                "place_id": f"sos_fl:{doc_number}",
                "source_channel": "sos_fl",
                "name": name,
                "entity_type": entity,
                "address": address,
                "city": city,
                "state": state or "FL",
                "zip_code": zip_code[:10] if zip_code else None,
                "filing_date": filing_date,
                "registered_agent": agent_name or None,
                "officer_names": officers if officers else None,
            })

    logger.info("fl_parsed", total_rows=len(results), file=file_path)
    return results


def parse_texas_csv(
    file_path: str,
    *,
    days_min: int = 14,
    days_max: int = 75,
    entity_types: list[str] | None = None,
) -> list[dict]:
    """Parse Texas SoS standard CSV bulk export.

    Expected columns:
    Filing Number, Entity Name, Entity Type, Formation Date, Status,
    Registered Agent, RA Address, RA City, RA State, RA Zip,
    Principal Address, Principal City, Principal State, Principal Zip
    """
    path = Path(file_path)
    if not path.exists():
        logger.error("tx_file_not_found", path=file_path)
        return []

    results: list[dict] = []
    accepted_types = {t.upper() for t in (entity_types or ["LLC", "Corporation"])}

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)

        for row in reader:
            filing_number = (row.get("Filing Number") or row.get("filing_number") or "").strip()
            name = (row.get("Entity Name") or row.get("entity_name") or "").strip()
            raw_type = (row.get("Entity Type") or row.get("entity_type") or "").strip()
            date_str = (row.get("Formation Date") or row.get("formation_date") or "").strip()
            status = (row.get("Status") or row.get("status") or "").strip().upper()
            agent = (row.get("Registered Agent") or row.get("registered_agent") or "").strip()
            address = (row.get("Principal Address") or row.get("principal_address") or "").strip()
            city = (row.get("Principal City") or row.get("principal_city") or "").strip()
            state = (row.get("Principal State") or row.get("principal_state") or "").strip()
            zip_code = (row.get("Principal Zip") or row.get("principal_zip") or "").strip()

            if not name or not filing_number:
                continue
            if status and status not in ("ACTIVE", "IN EXISTENCE", ""):
                continue

            entity = _normalize_entity_type(raw_type)
            if accepted_types and entity.upper() not in accepted_types and entity not in accepted_types:
                continue

            filing_date = _parse_date(date_str)
            if not _within_date_range(filing_date, days_min, days_max):
                continue

            results.append({
                "place_id": f"sos_tx:{filing_number}",
                "source_channel": "sos_tx",
                "name": name,
                "entity_type": entity,
                "address": address or None,
                "city": city or None,
                "state": state or "TX",
                "zip_code": zip_code[:10] if zip_code else None,
                "filing_date": filing_date,
                "registered_agent": agent or None,
                "officer_names": None,
            })

    logger.info("tx_parsed", total_rows=len(results), file=file_path)
    return results
