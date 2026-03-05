"""Layer 4 — Lead scoring: composite 0-100 score, tier, and segment assignment.

Segments
--------
ESTABLISHED : 21+ reviews — "upgrade your site" angle
NEW_SMALL   : 0-20 reviews, or NO_WEBSITE regardless of reviews — "get a real
              site before competitors outrank you" / "look established" angle

Scoring adjusts per segment so NEW_SMALL leads aren't penalised for lacking
reviews; they get a "growth opportunity" bonus instead.
"""

import structlog

from src.models.score import LeadScore
from src.utils.time import utcnow

logger = structlog.get_logger()

SEGMENT_NEW_SMALL = "NEW_SMALL"
SEGMENT_ESTABLISHED = "ESTABLISHED"

NEW_SMALL_REVIEW_CEILING = 20


def assign_segment(business, triage_status: str) -> str:
    """Determine whether a lead is NEW_SMALL or ESTABLISHED."""
    review_count = business.review_count or 0
    if triage_status == "NO_WEBSITE":
        return SEGMENT_NEW_SMALL
    if review_count <= NEW_SMALL_REVIEW_CEILING:
        return SEGMENT_NEW_SMALL
    return SEGMENT_ESTABLISHED


def calculate_lead_score(
    business,
    triage_status: str,
    audit: object | None = None,
) -> tuple[int, str, dict]:
    """Compute a 0-100 lead score with segment and breakdown.

    Returns (score, segment, breakdown_dict).
    """
    segment = assign_segment(business, triage_status)
    score = 0
    breakdown = {}

    # === WEBSITE STATUS (max 40) ===
    if triage_status == "NO_WEBSITE":
        pts = 40
    elif triage_status == "DEAD_WEBSITE":
        pts = 38
    elif triage_status == "FREE_SUBDOMAIN":
        pts = 35
    elif triage_status == "PAGE_BUILDER":
        pts = 20
    elif triage_status == "HAS_WEBSITE" and audit:
        perf = audit.performance_score
        if perf is None:
            pts = 15
        elif perf < 20:
            pts = 35
        elif perf < 40:
            pts = 28
        elif perf < 60:
            pts = 18
        elif perf < 80:
            pts = 8
        else:
            pts = 0
    else:
        pts = 10
    score += pts
    breakdown["website_status"] = pts

    # === SSL (max 10) ===
    ssl_pts = 0
    if audit:
        if not audit.has_ssl:
            ssl_pts = 10
        elif not audit.ssl_valid:
            ssl_pts = 8
    score += ssl_pts
    breakdown["ssl"] = ssl_pts

    # === MOBILE (max 10) ===
    mobile_pts = 0
    if audit:
        if audit.is_mobile_friendly is False:
            mobile_pts = 10
        elif audit.small_tap_targets and audit.small_tap_targets > 10:
            mobile_pts = 5
    score += mobile_pts
    breakdown["mobile"] = mobile_pts

    # === FRESHNESS (max 8) ===
    fresh_pts = 0
    if audit and audit.is_outdated:
        years = (utcnow().year - audit.copyright_year) if audit.copyright_year else 1
        fresh_pts = max(0, min(years * 2, 8))
    score += fresh_pts
    breakdown["freshness"] = fresh_pts

    # === SEO (max 7) ===
    seo_pts = 0
    if audit and audit.seo_score is not None:
        if audit.seo_score < 50:
            seo_pts = 7
        elif audit.seo_score < 70:
            seo_pts = 4
    score += seo_pts
    breakdown["seo"] = seo_pts

    # === BUSINESS HEALTH (max 25) — segment-aware ===
    review_count = business.review_count or 0
    rating = float(business.rating or 0)
    health_pts = 0

    if segment == SEGMENT_ESTABLISHED:
        if review_count >= 100 and rating >= 4.0:
            health_pts += 15
        elif review_count >= 50 and rating >= 4.0:
            health_pts += 12
        elif review_count >= 20 and rating >= 3.5:
            health_pts += 8
        else:
            health_pts += 4
    else:
        # NEW_SMALL: fewer reviews = more opportunity, not less.
        # They need a site to start competing, so the *lack* of presence
        # is the selling point, not a disqualifier.
        if triage_status == "NO_WEBSITE":
            health_pts += 18
        elif triage_status in ("DEAD_WEBSITE", "FREE_SUBDOMAIN"):
            health_pts += 15
        elif review_count == 0:
            health_pts += 12
        elif review_count < 5:
            health_pts += 14
        elif review_count <= 20:
            health_pts += 10

    if business.phone:
        health_pts += 3
    if business.hours:
        health_pts += 2

    health_pts = min(health_pts, 25)
    score += health_pts
    breakdown["business_health"] = health_pts
    breakdown["segment"] = segment

    score = min(score, 100)
    return score, segment, breakdown


def score_to_tier(score: int) -> str:
    if score >= 80:
        return "HOT"
    elif score >= 60:
        return "WARM"
    elif score >= 40:
        return "COOL"
    elif score >= 20:
        return "COLD"
    return "SKIP"


async def run_scoring(session, businesses_with_data: list[tuple]) -> dict:
    """Score businesses and save to lead_scores.

    Args:
        session: SQLAlchemy async session.
        businesses_with_data: list of (Business, TriageResult, WebsiteAudit|None) tuples.

    Returns:
        Dict with tier counts and segment counts.
    """
    from sqlalchemy import select

    tier_counts = {"HOT": 0, "WARM": 0, "COOL": 0, "COLD": 0, "SKIP": 0, "skipped": 0}
    segment_counts = {SEGMENT_ESTABLISHED: 0, SEGMENT_NEW_SMALL: 0}

    for biz, triage, audit in businesses_with_data:
        existing = (await session.execute(
            select(LeadScore).where(LeadScore.business_id == biz.id)
        )).scalar_one_or_none()
        if existing:
            tier_counts["skipped"] += 1
            continue

        score, segment, breakdown = calculate_lead_score(biz, triage.status, audit)
        tier = score_to_tier(score)

        record = LeadScore(
            business_id=biz.id,
            score=score,
            tier=tier,
            segment=segment,
            score_breakdown=breakdown,
            scored_at=utcnow(),
        )
        session.add(record)

        tier_counts[tier] += 1
        segment_counts[segment] = segment_counts.get(segment, 0) + 1
        logger.info("scored", business=biz.name, score=score, tier=tier, segment=segment)

    await session.commit()
    tier_counts["segments"] = segment_counts
    return tier_counts
