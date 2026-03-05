"""Layer 6+7 — Outreach: render emails, generate PDF, push to Instantly.ai, track."""

from pathlib import Path

import aiohttp
import structlog
from jinja2 import Environment, FileSystemLoader

from src.config import settings
from src.models.outreach import OutreachLog
from src.utils.time import utcnow

logger = structlog.get_logger()

TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "templates"
REPORTS_DIR = Path(__file__).resolve().parent.parent.parent / "reports"

INSTANTLY_API_V2 = "https://api.instantly.ai/api/v2"


def _get_jinja_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=True,
        trim_blocks=True,
        lstrip_blocks=True,
    )


VERTICAL_ESTIMATES = {
    "hvac": {"avg_job": 1500, "monthly_searches": "3,200", "conversion": "3–5"},
    "plumber": {"avg_job": 800, "monthly_searches": "4,100", "conversion": "3–5"},
    "electrician": {"avg_job": 700, "monthly_searches": "2,800", "conversion": "3–5"},
    "contractor": {"avg_job": 2000, "monthly_searches": "2,400", "conversion": "2–4"},
    "dentist": {"avg_job": 800, "monthly_searches": "5,500", "conversion": "4–6"},
    "cosmetic_dentist": {"avg_job": 1200, "monthly_searches": "3,800", "conversion": "3–5"},
    "med_spa": {"avg_job": 900, "monthly_searches": "2,900", "conversion": "3–5"},
    "default": {"avg_job": 1000, "monthly_searches": "2,400", "conversion": "3–5"},
}


def _match_vertical(category: str) -> dict:
    """Match a business category to vertical estimates."""
    cat = (category or "").lower()
    for key, data in VERTICAL_ESTIMATES.items():
        if key.replace("_", " ") in cat or key in cat:
            return data
    if any(kw in cat for kw in ("heating", "air condition", "cooling", "ac ")):
        return VERTICAL_ESTIMATES["hvac"]
    if any(kw in cat for kw in ("plumb", "pipe", "drain", "water heater")):
        return VERTICAL_ESTIMATES["plumber"]
    if any(kw in cat for kw in ("dent", "orthodon", "oral")):
        return VERTICAL_ESTIMATES["dentist"]
    if any(kw in cat for kw in ("spa", "aesthet", "cosmetic", "botox", "laser")):
        return VERTICAL_ESTIMATES["med_spa"]
    if any(kw in cat for kw in ("electri", "wiring")):
        return VERTICAL_ESTIMATES["electrician"]
    if any(kw in cat for kw in ("roofing", "remodel", "construct", "paint")):
        return VERTICAL_ESTIMATES["contractor"]
    return VERTICAL_ESTIMATES["default"]


def _compute_projections(category: str, city: str, review_count: int, rating) -> dict:
    """Compute personalized revenue/traffic projections for audit PDF."""
    vert = _match_vertical(category)
    avg_job = vert["avg_job"]

    leads_low = 12 if review_count < 50 else 18
    leads_high = 25 if review_count < 50 else 40

    monthly_rev = avg_job * leads_low
    rev_formatted = f"{monthly_rev:,}"

    cat_lower = (category or "your service").lower()
    rating_str = str(rating) if rating else "strong"

    if avg_job >= 1200:
        roi_timeline = "1–2 months"
        rev_math = (
            f"At ~${avg_job:,} average job value, {leads_low} new customers/month = "
            f"${monthly_rev:,}/month in additional revenue."
        )
        roi_math = (
            f"Just 3–4 new customers from your website covers the entire project cost. "
            f"Everything after that is pure profit."
        )
    else:
        roi_timeline = "2–3 months"
        rev_math = (
            f"At ~${avg_job:,} average job value, {leads_low} new customers/month = "
            f"${monthly_rev:,}/month in additional revenue."
        )
        roi_math = (
            f"Within {roi_timeline}, the website pays for itself. After that, every new customer "
            f"from Google is revenue you weren't getting before."
        )

    competitor_note = (
        f"You have {review_count} reviews and a {rating_str}★ rating — that's stronger than most "
        f"{cat_lower}s in {city or 'your area'}. A professional website is the missing piece that "
        f"turns those searches into calls."
    ) if review_count and review_count > 20 else (
        f"You're building your reputation with {review_count} reviews and a {rating_str}★ rating. "
        f"A professional website now establishes credibility early and captures searches "
        f"as your business grows."
    )

    return {
        "est_monthly_searches": vert["monthly_searches"],
        "est_monthly_leads": str(leads_low),
        "est_monthly_leads_high": str(leads_high),
        "est_monthly_revenue": rev_formatted,
        "est_conversion_rate": vert["conversion"],
        "est_revenue_math": rev_math,
        "est_roi_timeline": roi_timeline,
        "est_roi_math": roi_math,
        "est_competitor_note": competitor_note,
    }


def _build_template_vars(business, triage, audit, enrichment, score_row) -> dict:
    """Build the full variable dict for email/PDF templates."""
    projections = _compute_projections(
        business.category or "",
        business.city or "",
        business.review_count or 0,
        business.rating,
    )

    owner_name = enrichment.owner_name if enrichment else None
    first_name = (owner_name or "").strip().split(" ", 1)[0] if owner_name else ""

    v = {
        "business_name": business.name,
        "company_name": business.name,
        "owner_name": owner_name,
        "first_name": first_name or None,
        "category": business.category or "",
        "city": business.city or "",
        "website": business.website or "",
        "rating": str(business.rating) if business.rating else "",
        "review_count": business.review_count or 0,
        "triage_status": triage.status if triage else "HAS_WEBSITE",
        "segment": score_row.segment if score_row else "ESTABLISHED",
        "lead_score": score_row.score if score_row else 0,
        # Audit fields
        "performance_score": audit.performance_score if audit else None,
        "seo_score": audit.seo_score if audit else None,
        "has_ssl": audit.has_ssl if audit else True,
        "ssl_valid": audit.ssl_valid if audit else True,
        "is_mobile_friendly": audit.is_mobile_friendly if audit else True,
        "is_outdated": audit.is_outdated if audit else False,
        "copyright_year": audit.copyright_year if audit else None,
        "technologies": audit.technologies if audit else [],
        # Projections
        **projections,
        # Sender
        "sender_name": settings.sender_name,
        "sender_title": settings.sender_title,
        "sender_company": settings.sender_company,
        "sender_phone": settings.sender_phone,
        "generated_date": utcnow().strftime("%B %d, %Y"),
    }
    return v


def render_email(template_name: str, variables: dict) -> tuple[str, str]:
    """Render an email template. Returns (subject, body)."""
    env = _get_jinja_env()
    raw = env.get_template(template_name).render(**variables)
    lines = raw.strip().split("\n", 1)
    subject = lines[0].replace("Subject: ", "").strip()
    body = lines[1].strip() if len(lines) > 1 else ""
    return subject, body


def generate_audit_pdf(variables: dict, output_dir: str | None = None) -> str | None:
    """Generate a branded PDF audit report. Returns file path or None on failure."""
    try:
        from weasyprint import HTML
    except ImportError:
        logger.warning("weasyprint_not_installed", msg="pip install weasyprint to enable PDF generation")
        return None

    env = _get_jinja_env()
    html_content = env.get_template("audit_report.html").render(**variables)

    out_dir = Path(output_dir) if output_dir else REPORTS_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    safe_name = "".join(c if c.isalnum() or c in "-_ " else "" for c in variables.get("business_name", "report"))
    filename = f"{safe_name.strip().replace(' ', '_')}_audit.pdf"
    output_path = out_dir / filename

    HTML(string=html_content).write_pdf(str(output_path))
    logger.info("pdf_generated", path=str(output_path))
    return str(output_path)


def build_issues_summary(triage, audit) -> str:
    """Build a short plaintext issues list for Instantly custom variables."""
    issues = []
    status = triage.status if triage else "HAS_WEBSITE"

    if status == "NO_WEBSITE":
        issues.append("No website found")
    elif status == "DEAD_WEBSITE":
        issues.append("Website unreachable")
    elif status == "FREE_SUBDOMAIN":
        issues.append("Free subdomain (not professional)")
    else:
        if audit:
            if not audit.has_ssl:
                issues.append("No SSL (Not Secure warning)")
            if audit.performance_score is not None and audit.performance_score < 50:
                issues.append(f"Slow speed ({audit.performance_score}/100)")
            if audit.seo_score is not None and audit.seo_score < 60:
                issues.append(f"Low SEO ({audit.seo_score}/100)")
            if audit.is_outdated and audit.copyright_year:
                issues.append(f"Outdated since {audit.copyright_year}")
            if audit.is_mobile_friendly is False:
                issues.append("Not mobile-friendly")

    return "; ".join(issues) if issues else "Website needs improvement"


def get_campaign_id_for_lead(triage, campaign_id_override: str | None = None) -> str:
    """Pick Instantly campaign by triage status when using multiple campaigns (richer copy per variant)."""
    if campaign_id_override:
        return campaign_id_override
    if not triage:
        return settings.instantly_campaign_id_maps or ""
    status = (triage.status or "").upper()
    if status == "NO_WEBSITE" and settings.instantly_campaign_id_no_website:
        return settings.instantly_campaign_id_no_website
    if status == "DEAD_WEBSITE" and settings.instantly_campaign_id_dead_website:
        return settings.instantly_campaign_id_dead_website
    if status in ("HAS_WEBSITE", "PAGE_BUILDER", "FREE_SUBDOMAIN") and settings.instantly_campaign_id_has_website:
        return settings.instantly_campaign_id_has_website
    return settings.instantly_campaign_id_maps or ""


async def add_lead_to_instantly(
    business,
    enrichment,
    triage,
    audit,
    score_row,
    campaign_id: str | None = None,
) -> dict | None:
    """Push a single lead to Instantly.ai campaign via API.

    Returns the API response dict or None on failure.
    """
    api_key = settings.instantly_api_key
    cid = get_campaign_id_for_lead(triage, campaign_id)
    if not api_key or not cid:
        logger.warning("instantly_not_configured", msg="Set INSTANTLY_API_KEY and INSTANTLY_CAMPAIGN_ID_MAPS in .env")
        return None

    email = enrichment.best_email if enrichment else None
    if not email:
        return None

    owner_parts = (enrichment.owner_name or "").split(" ", 1) if enrichment and enrichment.owner_name else ["", ""]
    first_name = owner_parts[0] if owner_parts else ""
    last_name = owner_parts[1] if len(owner_parts) > 1 else ""

    issues = build_issues_summary(triage, audit)

    custom_vars = {
        "rating": str(business.rating or ""),
        "review_count": str(business.review_count or 0),
        "category": business.category or "",
        "city": business.city or "",
        "lead_score": str(score_row.score if score_row else ""),
        "segment": score_row.segment if score_row else "",
        "tier": score_row.tier if score_row else "",
        "triage_status": triage.status if triage else "",
        "issues_found": issues,
        "performance_score": str(audit.performance_score if audit and audit.performance_score is not None else ""),
        "seo_score": str(audit.seo_score if audit and audit.seo_score is not None else ""),
    }

    # Instantly API v2: Bearer auth, POST /api/v2/leads
    payload = {
        "campaign": cid,
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "company_name": business.name,
        "phone": business.phone or "",
        "website": business.website or "",
        "skip_if_in_workspace": True,
        "custom_variables": custom_vars,
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(f"{INSTANTLY_API_V2}/leads", json=payload, headers=headers) as resp:
                try:
                    data = await resp.json()
                except Exception:
                    data = {}
                if resp.status >= 400:
                    logger.warning("instantly_add_failed", status=resp.status, body=data)
                    return None
                return data
    except Exception as e:
        logger.warning("instantly_api_error", error=str(e))
        return None


async def queue_lead(
    db_session,
    business,
    enrichment,
    triage,
    audit,
    score_row,
    campaign_id: str | None = None,
    dry_run: bool = False,
) -> str:
    """Add a lead to Instantly + record in outreach_log.

    Returns status: 'queued', 'no_email', 'api_error', 'dry_run'.
    """
    email = enrichment.best_email if enrichment else None
    if not email:
        return "no_email"

    status = "dry_run"
    if not dry_run:
        result = await add_lead_to_instantly(business, enrichment, triage, audit, score_row, campaign_id)
        status = "queued" if result else "api_error"

    record = OutreachLog(
        business_id=business.id,
        source_channel="google_maps",
        outreach_type="email",
        segment=score_row.segment if score_row else None,
        email_sent_to=email,
        campaign_id=get_campaign_id_for_lead(triage, campaign_id) or settings.instantly_campaign_id_maps,
        status=status,
        sent_at=utcnow() if status == "queued" else None,
    )
    db_session.add(record)
    await db_session.commit()

    return status


async def run_outreach(
    session,
    leads: list[tuple],
    campaign_id: str | None = None,
    dry_run: bool = False,
) -> dict:
    """Push enriched leads to Instantly.ai and track in outreach_log.

    Args:
        session: SQLAlchemy async session.
        leads: list of (Business, EnrichmentData, TriageResult, WebsiteAudit|None, LeadScore) tuples.
        campaign_id: Override campaign ID.
        dry_run: If True, log but don't actually call Instantly API.

    Returns:
        Dict with status counts.
    """
    from sqlalchemy import select

    counts = {"queued": 0, "no_email": 0, "api_error": 0, "dry_run": 0, "already_sent": 0}

    for biz, enrich, triage, audit, score in leads:
        existing = (await session.execute(
            select(OutreachLog).where(
                OutreachLog.business_id == biz.id,
                OutreachLog.source_channel == "google_maps",
                OutreachLog.status != "dry_run",
            )
        )).scalar_one_or_none()
        if existing:
            counts["already_sent"] += 1
            continue

        result = await queue_lead(session, biz, enrich, triage, audit, score, campaign_id, dry_run)
        counts[result] += 1
        logger.info("outreach", business=biz.name, email=enrich.best_email if enrich else None, status=result)

    return counts
