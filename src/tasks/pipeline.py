"""Celery tasks for each pipeline stage + full orchestrator.

Each task wraps the existing async pipeline functions via asyncio.run(),
adds retry logic with exponential backoff, and structured logging.
"""

import asyncio
import threading

import structlog
from celery import chain

from src.celery_app import app

logger = structlog.get_logger()

_loop_local = threading.local()


def _get_loop() -> asyncio.AbstractEventLoop:
    """Return a persistent event loop for this worker thread.

    asyncpg binds its connection pool to the loop that created it. Closing the
    loop between tasks kills the pool and subsequent tasks fail with
    "Event loop is closed".  Reusing one loop per thread avoids this.
    """
    loop = getattr(_loop_local, "loop", None)
    if loop is None or loop.is_closed():
        loop = asyncio.new_event_loop()
        _loop_local.loop = loop
    return loop


def _run_async(coro):
    """Run an async coroutine on the worker's persistent event loop."""
    return _get_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# Stage 1: Scrape
# ---------------------------------------------------------------------------

@app.task(
    bind=True,
    name="src.tasks.pipeline.run_scrape",
    max_retries=2,
    default_retry_delay=120,
    acks_late=True,
)
def run_scrape(self, max_per_run: int = 75, headless: bool = True, parallel: int = 1):
    """Scrape Google Maps for all configured niches + cities. parallel = number of browsers at once."""
    try:
        result = _run_async(_do_scrape(max_per_run, headless, parallel))
        logger.info("scrape_complete", total_saved=result)
        return {"stage": "scrape", "total_saved": result}
    except Exception as exc:
        logger.error("scrape_failed", error=str(exc), retry=self.request.retries)
        raise self.retry(exc=exc)


async def _do_scrape(max_per_run: int, headless: bool, parallel: int = 1) -> int:
    from src.cli import BATCH_SEARCH_CONFIGS
    from src.database import async_session
    from src.scraper.google_maps import save_businesses, scrape_google_maps

    pairs = []
    for cfg in BATCH_SEARCH_CONFIGS:
        for loc in cfg["locations"]:
            pairs.append((cfg["niche"], loc))

    if parallel <= 1:
        total_saved = 0
        for niche, location in pairs:
            try:
                businesses = await scrape_google_maps(
                    query=niche,
                    location=location,
                    max_results=max_per_run,
                    headless=headless,
                )
                if businesses:
                    async with async_session() as session:
                        saved = await save_businesses(session, businesses)
                        total_saved += saved
                        logger.info("scrape_batch_saved", niche=niche, location=location, saved=saved)
            except Exception as e:
                logger.warning("scrape_batch_error", niche=niche, location=location, error=str(e))
                continue
        return total_saved

    sem = asyncio.Semaphore(parallel)

    async def run_one(niche: str, location: str) -> int:
        async with sem:
            try:
                businesses = await scrape_google_maps(
                    query=niche,
                    location=location,
                    max_results=max_per_run,
                    headless=headless,
                )
                if businesses:
                    async with async_session() as session:
                        saved = await save_businesses(session, businesses)
                        logger.info("scrape_batch_saved", niche=niche, location=location, saved=saved)
                        return saved
            except Exception as e:
                logger.warning("scrape_batch_error", niche=niche, location=location, error=str(e))
            return 0

    results = await asyncio.gather(*[run_one(n, l) for n, l in pairs])
    return sum(results)


# ---------------------------------------------------------------------------
# Stage 2: Triage
# ---------------------------------------------------------------------------

@app.task(
    bind=True,
    name="src.tasks.pipeline.run_triage_task",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def run_triage_task(self, _prev_result=None):
    """Triage all untriaged businesses."""
    try:
        result = _run_async(_do_triage())
        logger.info("triage_complete", counts=result)
        return {"stage": "triage", "counts": result}
    except Exception as exc:
        logger.error("triage_failed", error=str(exc), retry=self.request.retries)
        raise self.retry(exc=exc)


async def _do_triage() -> dict:
    from sqlalchemy import select

    from src.database import async_session
    from src.models.business import Business
    from src.models.triage import TriageResult
    from src.triage import run_triage

    async with async_session() as session:
        already = {r[0] for r in (await session.execute(select(TriageResult.business_id))).all()}
        rows = (await session.execute(select(Business))).scalars().all()
        to_triage = [b for b in rows if b.id not in already]

    if not to_triage:
        return {"skipped": "all_triaged"}

    async with async_session() as session:
        counts = await run_triage(session, to_triage)

    return counts


# ---------------------------------------------------------------------------
# Stage 3: Audit
# ---------------------------------------------------------------------------

@app.task(
    bind=True,
    name="src.tasks.pipeline.run_audit_task",
    max_retries=3,
    default_retry_delay=90,
    acks_late=True,
    time_limit=1800,
    soft_time_limit=1500,
)
def run_audit_task(self, _prev_result=None):
    """Run website audits on triaged HAS_WEBSITE businesses."""
    try:
        result = _run_async(_do_audit())
        logger.info("audit_complete", count=result)
        return {"stage": "audit", "audited": result}
    except Exception as exc:
        logger.error("audit_failed", error=str(exc), retry=self.request.retries)
        raise self.retry(exc=exc)


async def _do_audit() -> int:
    from sqlalchemy import select

    from src.audit import run_audits
    from src.database import async_session
    from src.models.audit import WebsiteAudit
    from src.models.business import Business
    from src.models.triage import TriageResult

    async with async_session() as session:
        already_audited = {r[0] for r in (await session.execute(select(WebsiteAudit.business_id))).all()}

        stmt = select(Business, TriageResult).join(
            TriageResult, Business.id == TriageResult.business_id
        ).where(TriageResult.status == "HAS_WEBSITE")
        results = (await session.execute(stmt)).all()
        to_audit = [(b, t) for b, t in results if b.id not in already_audited]

    if not to_audit:
        return 0

    async with async_session() as session:
        count = await run_audits(session, to_audit)

    return count


# ---------------------------------------------------------------------------
# Stage 4: Score
# ---------------------------------------------------------------------------

@app.task(
    bind=True,
    name="src.tasks.pipeline.run_score_task",
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def run_score_task(self, _prev_result=None):
    """Score all triaged businesses."""
    try:
        result = _run_async(_do_score())
        logger.info("score_complete", tier_counts=result)
        return {"stage": "score", "tier_counts": result}
    except Exception as exc:
        logger.error("score_failed", error=str(exc), retry=self.request.retries)
        raise self.retry(exc=exc)


async def _do_score() -> dict:
    from sqlalchemy import select

    from src.database import async_session
    from src.models.audit import WebsiteAudit
    from src.models.business import Business
    from src.models.score import LeadScore
    from src.models.triage import TriageResult
    from src.scoring import run_scoring

    async with async_session() as session:
        already_scored = {r[0] for r in (await session.execute(select(LeadScore.business_id))).all()}

        triaged = (await session.execute(
            select(Business, TriageResult).join(
                TriageResult, Business.id == TriageResult.business_id
            )
        )).all()

        to_score = []
        for biz, triage in triaged:
            if biz.id in already_scored:
                continue
            audit_row = (await session.execute(
                select(WebsiteAudit).where(WebsiteAudit.business_id == biz.id)
            )).scalar_one_or_none()
            to_score.append((biz, triage, audit_row))

    if not to_score:
        return {"skipped": "all_scored"}

    async with async_session() as session:
        tier_counts = await run_scoring(session, to_score)

    serializable = {}
    for k, v in tier_counts.items():
        if isinstance(v, dict):
            serializable[k] = v
        else:
            serializable[k] = v
    return serializable


# ---------------------------------------------------------------------------
# Stage 5: Enrich
# ---------------------------------------------------------------------------

@app.task(
    bind=True,
    name="src.tasks.pipeline.run_enrich_task",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    time_limit=1200,
    soft_time_limit=1000,
)
def run_enrich_task(self, _prev_result=None, min_score: int = 40, max_leads: int | None = None):
    """Enrich scored leads with contact info."""
    try:
        result = _run_async(_do_enrich(min_score, max_leads))
        logger.info("enrich_complete", counts=result)
        return {"stage": "enrich", "counts": result}
    except Exception as exc:
        logger.error("enrich_failed", error=str(exc), retry=self.request.retries)
        raise self.retry(exc=exc)


async def _do_enrich(min_score: int, max_leads: int | None) -> dict:
    from sqlalchemy import select

    from src.database import async_session
    from src.enrichment import run_enrichment
    from src.models.business import Business
    from src.models.enrichment import EnrichmentData
    from src.models.score import LeadScore

    async with async_session() as session:
        already = {r[0] for r in (await session.execute(select(EnrichmentData.business_id))).all()}

        stmt = (
            select(Business)
            .join(LeadScore, Business.id == LeadScore.business_id)
            .where(LeadScore.score >= min_score)
            .order_by(LeadScore.score.desc())
        )
        if max_leads:
            stmt = stmt.limit(max_leads + len(already))
        rows = (await session.execute(stmt)).scalars().all()
        to_enrich = [b for b in rows if b.id not in already]
        if max_leads:
            to_enrich = to_enrich[:max_leads]

    if not to_enrich:
        return {"skipped": "all_enriched"}

    async with async_session() as session:
        counts = await run_enrichment(session, to_enrich)

    return counts


# ---------------------------------------------------------------------------
# Stage 6: Outreach (queue to Instantly)
# ---------------------------------------------------------------------------

@app.task(
    bind=True,
    name="src.tasks.pipeline.run_outreach_task",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def run_outreach_task(
    self,
    _prev_result=None,
    min_score: int = 40,
    max_leads: int | None = None,
    dry_run: bool = False,
    campaign_id: str | None = None,
):
    """Queue enriched leads to Instantly.ai campaign."""
    try:
        result = _run_async(_do_outreach(min_score, max_leads, dry_run, campaign_id))
        logger.info("outreach_complete", counts=result)
        return {"stage": "outreach", "counts": result}
    except Exception as exc:
        logger.error("outreach_failed", error=str(exc), retry=self.request.retries)
        raise self.retry(exc=exc)


async def _do_outreach(
    min_score: int, max_leads: int | None, dry_run: bool, campaign_id: str | None
) -> dict:
    from sqlalchemy import select

    from src.database import async_session
    from src.models.audit import WebsiteAudit
    from src.models.business import Business
    from src.models.enrichment import EnrichmentData
    from src.models.outreach import OutreachLog
    from src.models.score import LeadScore
    from src.models.triage import TriageResult
    from src.outreach import run_outreach

    async with async_session() as session:
        already_sent = {r[0] for r in (await session.execute(
            select(OutreachLog.business_id).where(OutreachLog.source_channel == "google_maps")
        )).all()}

        stmt = (
            select(Business, EnrichmentData, TriageResult, LeadScore)
            .join(EnrichmentData, Business.id == EnrichmentData.business_id)
            .join(LeadScore, Business.id == LeadScore.business_id)
            .join(TriageResult, Business.id == TriageResult.business_id)
            .where(LeadScore.score >= min_score)
            .where(EnrichmentData.best_email.isnot(None))
            .order_by(LeadScore.score.desc())
        )
        rows = (await session.execute(stmt)).all()

        to_queue = []
        for biz, enrich, triage, score in rows:
            if biz.id in already_sent:
                continue
            audit = (await session.execute(
                select(WebsiteAudit).where(WebsiteAudit.business_id == biz.id)
            )).scalar_one_or_none()
            to_queue.append((biz, enrich, triage, audit, score))
            if max_leads and len(to_queue) >= max_leads:
                break

    if not to_queue:
        return {"skipped": "no_leads_to_queue"}

    async with async_session() as session:
        counts = await run_outreach(session, to_queue, campaign_id, dry_run)

    return counts


# ---------------------------------------------------------------------------
# Full Pipeline Orchestrator
# ---------------------------------------------------------------------------

@app.task(
    bind=True,
    name="src.tasks.pipeline.run_full_pipeline",
    max_retries=1,
    default_retry_delay=300,
)
def run_full_pipeline(
    self,
    max_per_run: int = 100,
    min_score: int = 40,
    dry_run: bool = False,
    parallel_scrapes: int = 5,
):
    """Run the complete pipeline as a Celery chain: scrape → triage → audit → score → enrich → outreach.

    parallel_scrapes = number of browsers running at once during the scrape stage.
    """
    logger.info(
        "pipeline_started",
        max_per_run=max_per_run,
        min_score=min_score,
        dry_run=dry_run,
        parallel_scrapes=parallel_scrapes,
    )

    pipeline = chain(
        run_scrape.s(max_per_run=max_per_run, headless=True, parallel=parallel_scrapes),
        run_triage_task.s(),
        run_audit_task.s(),
        run_score_task.s(),
        run_enrich_task.s(min_score=min_score),
        run_outreach_task.s(min_score=min_score, dry_run=dry_run),
    )

    result = pipeline.apply_async()
    logger.info("pipeline_chain_dispatched", chain_id=result.id)
    return {"status": "dispatched", "chain_id": result.id}
