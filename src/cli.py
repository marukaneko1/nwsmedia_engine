"""CLI runner for the NWS Media lead engine."""

import asyncio

import click
from rich.console import Console
from rich.table import Table

from src.utils.logging import setup_logging

console = Console()


@click.group()
@click.option("--verbose", is_flag=True, help="Enable debug logging")
def cli(verbose: bool) -> None:
    """NWS Media Lead Engine CLI."""
    setup_logging(level="DEBUG" if verbose else "INFO")


@cli.command()
@click.option("--niche", required=True, help='Business type (e.g. "dentist")')
@click.option("--location", required=True, help='City/area (e.g. "Austin, TX")')
@click.option("--max-results", default=200, help="Maximum results to scrape")
@click.option("--headless/--no-headless", default=True, help="Run browser headless")
def scrape(niche: str, location: str, max_results: int, headless: bool) -> None:
    """Scrape Google Maps for businesses."""
    asyncio.run(_scrape(niche, location, max_results, headless))


async def _scrape(niche: str, location: str, max_results: int, headless: bool) -> None:
    from src.database import async_session
    from src.scraper.google_maps import save_businesses, scrape_google_maps

    console.print(f"\n[bold blue]Scraping Google Maps[/bold blue]")
    console.print(f"  Niche:    {niche}")
    console.print(f"  Location: {location}")
    console.print(f"  Max:      {max_results}\n")

    businesses = await scrape_google_maps(
        query=niche,
        location=location,
        max_results=max_results,
        headless=headless,
    )

    console.print(f"\n[green]Found {len(businesses)} businesses[/green]")

    if businesses:
        async with async_session() as session:
            saved = await save_businesses(session, businesses)
            console.print(f"[green]Saved {saved} new businesses to database[/green]")

        table = Table(title="Sample Results (first 10)")
        table.add_column("Name", style="cyan")
        table.add_column("Category")
        table.add_column("City")
        table.add_column("Phone")
        table.add_column("Email", max_width=32)
        table.add_column("Website")
        table.add_column("Rating")
        table.add_column("Reviews")

        for biz in businesses[:10]:
            table.add_row(
                biz.get("name", ""),
                biz.get("category", ""),
                biz.get("city", ""),
                biz.get("phone", ""),
                (biz.get("email") or "")[:32],
                (biz.get("website") or "")[:40],
                str(biz.get("rating", "")),
                str(biz.get("review_count", "")),
            )
        console.print(table)


@cli.command("scrape-batch")
@click.option("--max-per-run", default=75, help="Max results per niche+location (default 75)")
@click.option("--headless/--no-headless", default=True, help="Run browser headless")
@click.option("--dry-run", is_flag=True, help="Only print what would be run, do not scrape")
def scrape_batch(max_per_run: int, headless: bool, dry_run: bool) -> None:
    """Run scrapes for all target niches and cities (Phase 1 launch config)."""
    asyncio.run(_scrape_batch(max_per_run, headless, dry_run))


# Target niches + cities from LEAD_ENGINE_PLAN.md Section 16
# Idaho (rural) HVAC added for more leads with email in that market
BATCH_SEARCH_CONFIGS = [
    {"niche": "HVAC contractor", "locations": ["Houston, TX", "Dallas, TX", "Atlanta, GA", "Phoenix, AZ", "Austin, TX", "Boise, ID", "Idaho Falls, ID", "Twin Falls, ID", "Coeur d'Alene, ID", "Nampa, ID"]},
    {"niche": "plumber", "locations": ["Houston, TX", "Dallas, TX", "Atlanta, GA", "Phoenix, AZ", "Austin, TX"]},
    {"niche": "roofer", "locations": ["Houston, TX", "Dallas, TX", "Atlanta, GA", "Phoenix, AZ", "Austin, TX"]},
    {"niche": "electrician", "locations": ["Houston, TX", "Dallas, TX", "Atlanta, GA", "Phoenix, AZ", "Austin, TX"]},
    {"niche": "general contractor", "locations": ["Houston, TX", "Dallas, TX", "Atlanta, GA", "Phoenix, AZ"]},
    {"niche": "landscaping company", "locations": ["Houston, TX", "Dallas, TX", "Phoenix, AZ"]},
    {"niche": "dentist", "locations": ["Houston, TX", "Dallas, TX", "Atlanta, GA", "Phoenix, AZ", "Austin, TX"]},
    {"niche": "orthodontist", "locations": ["Houston, TX", "Dallas, TX", "Atlanta, GA", "Phoenix, AZ"]},
    {"niche": "med spa", "locations": ["Houston, TX", "Dallas, TX", "Atlanta, GA", "Phoenix, AZ", "Austin, TX"]},
    {"niche": "medical spa", "locations": ["Houston, TX", "Dallas, TX", "Atlanta, GA", "Phoenix, AZ"]},
    {"niche": "aesthetics clinic", "locations": ["Houston, TX", "Dallas, TX", "Atlanta, GA"]},
]


async def _scrape_batch(max_per_run: int, headless: bool, dry_run: bool) -> None:
    from src.database import async_session
    from src.scraper.google_maps import save_businesses, scrape_google_maps

    pairs = []
    for cfg in BATCH_SEARCH_CONFIGS:
        for loc in cfg["locations"]:
            pairs.append((cfg["niche"], loc))

    console.print(f"\n[bold blue]Batch scrape[/bold blue] — {len(pairs)} runs ({max_per_run} results each)")
    if dry_run:
        for i, (niche, loc) in enumerate(pairs, 1):
            console.print(f"  {i}. {niche} in {loc}")
        console.print("\n[dim]Run without --dry-run to execute.[/dim]\n")
        return

    total_saved = 0
    for i, (niche, location) in enumerate(pairs, 1):
        console.print(f"\n[bold]Run {i}/{len(pairs)}:[/bold] {niche} in {location}")
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
                    console.print(f"  [green]Saved {saved} new[/green] (found {len(businesses)})")
            else:
                console.print("  [dim]No businesses returned[/dim]")
        except Exception as e:
            console.print(f"  [red]Error: {e}[/red]")
            continue

    console.print(f"\n[bold green]Batch complete.[/bold green] Total new saved: {total_saved}\n")


@cli.command()
def db_status() -> None:
    """Check database connection."""
    asyncio.run(_db_status())


async def _db_status() -> None:
    from sqlalchemy import text

    from src.database import async_session

    try:
        async with async_session() as session:
            result = await session.execute(text("SELECT 1"))
            result.scalar()
        console.print("[green]Database connection OK[/green]")
    except Exception as e:
        console.print(f"[red]Database connection FAILED: {e}[/red]")


@cli.command()
def stats() -> None:
    """Show lead engine statistics."""
    asyncio.run(_stats())


async def _stats() -> None:
    from sqlalchemy import func, select

    from src.database import async_session
    from src.models.business import Business

    async with async_session() as session:
        total = (await session.execute(select(func.count(Business.id)))).scalar() or 0
        with_website = (
            await session.execute(
                select(func.count(Business.id)).where(Business.website.isnot(None))
            )
        ).scalar() or 0
        with_email = (
            await session.execute(
                select(func.count(Business.id)).where(Business.email.isnot(None))
            )
        ).scalar() or 0
        cities = (
            await session.execute(select(func.count(func.distinct(Business.city))))
        ).scalar() or 0

    table = Table(title="Lead Engine Stats")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", justify="right")
    table.add_row("Total businesses", str(total))
    table.add_row("With website", str(with_website))
    table.add_row("With email", str(with_email))
    table.add_row("Without website", str(total - with_website))
    table.add_row("Unique cities", str(cities))
    console.print(table)


@cli.command()
@click.option("--limit", default=20, help="Number of rows to show")
@click.option("--city", default=None, help="Filter by city")
def leads(limit: int, city: str | None) -> None:
    """List scraped businesses."""
    asyncio.run(_leads(limit, city))


async def _leads(limit: int, city: str | None) -> None:
    from sqlalchemy import select

    from src.database import async_session
    from src.models.business import Business

    stmt = select(Business).order_by(Business.scraped_at.desc()).limit(limit)
    if city:
        stmt = stmt.where(Business.city.ilike(f"%{city}%"))

    async with async_session() as session:
        rows = (await session.execute(stmt)).scalars().all()

    if not rows:
        console.print("[yellow]No businesses found.[/yellow]")
        return

    table = Table(title=f"Leads (showing {len(rows)})")
    table.add_column("#", justify="right", style="dim")
    table.add_column("Name", style="cyan", max_width=28)
    table.add_column("Category", max_width=18)
    table.add_column("City")
    table.add_column("Phone")
    table.add_column("Email", max_width=30)
    table.add_column("Website", max_width=28)
    table.add_column("Rating", justify="right")
    table.add_column("Reviews", justify="right")

    for i, biz in enumerate(rows, 1):
        table.add_row(
            str(i),
            biz.name or "",
            biz.category or "",
            biz.city or "",
            biz.phone or "",
            (biz.email or "")[:30],
            (biz.website or "")[:28],
            str(biz.rating or ""),
            str(biz.review_count or ""),
        )
    console.print(table)


@cli.command()
def triage() -> None:
    """Run triage on all untriaged businesses."""
    asyncio.run(_triage())


async def _triage() -> None:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from src.database import async_session
    from src.models.business import Business
    from src.models.triage import TriageResult
    from src.triage import run_triage

    async with async_session() as session:
        already = {r[0] for r in (await session.execute(select(TriageResult.business_id))).all()}
        rows = (await session.execute(select(Business))).scalars().all()
        to_triage = [b for b in rows if b.id not in already]

    if not to_triage:
        console.print("[yellow]All businesses already triaged.[/yellow]")
        return

    console.print(f"\n[bold blue]Triaging {len(to_triage)} businesses[/bold blue]\n")

    async with async_session() as session:
        counts = await run_triage(session, to_triage)

    table = Table(title="Triage Results")
    table.add_column("Status", style="cyan")
    table.add_column("Count", justify="right")
    for status, count in counts.items():
        table.add_row(status, str(count))
    console.print(table)


@cli.command()
def audit() -> None:
    """Run website audits on triaged HAS_WEBSITE businesses."""
    asyncio.run(_audit())


async def _audit() -> None:
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
        console.print("[yellow]No businesses to audit (all done or none with HAS_WEBSITE).[/yellow]")
        return

    console.print(f"\n[bold blue]Auditing {len(to_audit)} websites[/bold blue]")
    console.print(f"  (PageSpeed API ~10-30s per site)\n")

    async with async_session() as session:
        count = await run_audits(session, to_audit)

    console.print(f"\n[green]Audited {count} websites[/green]")


@cli.command()
def score() -> None:
    """Score all triaged businesses."""
    asyncio.run(_score())


async def _score() -> None:
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
        console.print("[yellow]All triaged businesses already scored.[/yellow]")
        return

    console.print(f"\n[bold blue]Scoring {len(to_score)} businesses[/bold blue]\n")

    async with async_session() as session:
        tier_counts = await run_scoring(session, to_score)

    table = Table(title="Scoring Results")
    table.add_column("Tier", style="cyan")
    table.add_column("Count", justify="right")
    for tier in ["HOT", "WARM", "COOL", "COLD", "SKIP", "skipped"]:
        table.add_row(tier, str(tier_counts.get(tier, 0)))
    console.print(table)

    seg = tier_counts.get("segments", {})
    if seg:
        seg_table = Table(title="Segment Breakdown")
        seg_table.add_column("Segment", style="cyan")
        seg_table.add_column("Count", justify="right")
        for name, cnt in seg.items():
            seg_table.add_row(name, str(cnt))
        console.print(seg_table)


@cli.command()
@click.option("--min-score", default=40, help="Minimum lead score to enrich (default 40 = COOL+)")
@click.option("--limit", "max_leads", default=None, type=int, help="Max leads to enrich this run")
def enrich(min_score: int, max_leads: int | None) -> None:
    """Enrich scored leads: scrape websites for email/socials, Hunter.io fallback."""
    asyncio.run(_enrich(min_score, max_leads))


async def _enrich(min_score: int, max_leads: int | None) -> None:
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
        console.print(f"[yellow]No leads to enrich (min score {min_score}).[/yellow]")
        return

    console.print(f"\n[bold blue]Enriching {len(to_enrich)} leads[/bold blue] (score >= {min_score})\n")

    async with async_session() as session:
        counts = await run_enrichment(session, to_enrich)

    table = Table(title="Enrichment Results")
    table.add_column("Metric", style="cyan")
    table.add_column("Count", justify="right")
    table.add_row("Email found", str(counts["enriched"]))
    table.add_row("No email", str(counts["no_email"]))
    table.add_row("Hunter.io used", str(counts["hunter_used"]))
    table.add_row("Already enriched", str(counts["skipped"]))
    console.print(table)


@cli.command()
@click.option("--min-score", default=40, help="Minimum lead score (default 40)")
@click.option("--limit", "max_leads", default=None, type=int, help="Max leads to queue")
@click.option("--dry-run", is_flag=True, help="Log without actually calling Instantly API")
@click.option("--campaign-id", default=None, help="Override Instantly campaign ID")
def outreach(min_score: int, max_leads: int | None, dry_run: bool, campaign_id: str | None) -> None:
    """Queue enriched leads to Instantly.ai campaign + track in outreach_log."""
    asyncio.run(_outreach(min_score, max_leads, dry_run, campaign_id))


async def _outreach(min_score: int, max_leads: int | None, dry_run: bool, campaign_id: str | None) -> None:
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
        console.print(f"[yellow]No enriched leads to queue (score >= {min_score}, with email).[/yellow]")
        return

    mode = "[dim](DRY RUN)[/dim] " if dry_run else ""
    console.print(f"\n[bold blue]{mode}Queuing {len(to_queue)} leads to Instantly[/bold blue]\n")

    async with async_session() as session:
        counts = await run_outreach(session, to_queue, campaign_id, dry_run)

    table = Table(title="Outreach Results")
    table.add_column("Status", style="cyan")
    table.add_column("Count", justify="right")
    for key in ["queued", "dry_run", "no_email", "api_error", "already_sent"]:
        table.add_row(key, str(counts.get(key, 0)))
    console.print(table)


@cli.command("generate-pdfs")
@click.option("--min-score", default=40, help="Minimum lead score (default 40)")
@click.option("--limit", "max_leads", default=None, type=int, help="Max PDFs to generate")
@click.option("--output-dir", default=None, help="Output directory (default: ./reports)")
def generate_pdfs(min_score: int, max_leads: int | None, output_dir: str | None) -> None:
    """Generate audit PDF reports for enriched leads."""
    asyncio.run(_generate_pdfs(min_score, max_leads, output_dir))


async def _generate_pdfs(min_score: int, max_leads: int | None, output_dir: str | None) -> None:
    from sqlalchemy import select

    from src.database import async_session
    from src.models.audit import WebsiteAudit
    from src.models.business import Business
    from src.models.enrichment import EnrichmentData
    from src.models.score import LeadScore
    from src.models.triage import TriageResult
    from src.outreach import _build_template_vars, generate_audit_pdf

    async with async_session() as session:
        stmt = (
            select(Business, EnrichmentData, TriageResult, LeadScore)
            .join(EnrichmentData, Business.id == EnrichmentData.business_id)
            .join(LeadScore, Business.id == LeadScore.business_id)
            .join(TriageResult, Business.id == TriageResult.business_id)
            .where(LeadScore.score >= min_score)
            .order_by(LeadScore.score.desc())
        )
        if max_leads:
            stmt = stmt.limit(max_leads)
        rows = (await session.execute(stmt)).all()

        generated = 0
        failed = 0
        for biz, enrich, triage, score in rows:
            audit = (await session.execute(
                select(WebsiteAudit).where(WebsiteAudit.business_id == biz.id)
            )).scalar_one_or_none()

            variables = _build_template_vars(biz, triage, audit, enrich, score)
            path = generate_audit_pdf(variables, output_dir)
            if path:
                generated += 1
            else:
                failed += 1

    console.print(f"\n[green]Generated {generated} PDFs[/green]")
    if failed:
        console.print(f"[yellow]Failed: {failed} (install weasyprint?)[/yellow]")


@cli.command()
def pipeline() -> None:
    """Run full pipeline: triage → audit → score → enrich."""
    asyncio.run(_pipeline())


async def _pipeline() -> None:
    console.print("\n[bold blue]Full Pipeline: Triage → Audit → Score → Enrich[/bold blue]\n")

    console.print("[bold]Step 1/4: Triage[/bold]")
    await _triage()

    console.print("\n[bold]Step 2/4: Audit[/bold]")
    await _audit()

    console.print("\n[bold]Step 3/4: Score[/bold]")
    await _score()

    console.print("\n[bold]Step 4/4: Enrich[/bold]")
    await _enrich(min_score=40, max_leads=None)

    console.print("\n[bold green]Pipeline complete.[/bold green]\n")


@cli.command()
def rescore() -> None:
    """Re-score all leads (clears existing scores and re-runs with current logic)."""
    asyncio.run(_rescore())


async def _rescore() -> None:
    from sqlalchemy import delete, select

    from src.database import async_session
    from src.models.audit import WebsiteAudit
    from src.models.business import Business
    from src.models.score import LeadScore
    from src.models.triage import TriageResult
    from src.scoring import run_scoring

    async with async_session() as session:
        count = (await session.execute(
            select(LeadScore.id)
        )).all()
        await session.execute(delete(LeadScore))
        await session.commit()
        console.print(f"[yellow]Cleared {len(count)} existing scores[/yellow]")

    async with async_session() as session:
        triaged = (await session.execute(
            select(Business, TriageResult).join(
                TriageResult, Business.id == TriageResult.business_id
            )
        )).all()

        to_score = []
        for biz, triage in triaged:
            audit_row = (await session.execute(
                select(WebsiteAudit).where(WebsiteAudit.business_id == biz.id)
            )).scalar_one_or_none()
            to_score.append((biz, triage, audit_row))

    if not to_score:
        console.print("[yellow]No triaged businesses to score.[/yellow]")
        return

    console.print(f"\n[bold blue]Re-scoring {len(to_score)} businesses with segment logic[/bold blue]\n")

    async with async_session() as session:
        tier_counts = await run_scoring(session, to_score)

    table = Table(title="Re-scoring Results")
    table.add_column("Tier", style="cyan")
    table.add_column("Count", justify="right")
    for tier in ["HOT", "WARM", "COOL", "COLD", "SKIP"]:
        table.add_row(tier, str(tier_counts.get(tier, 0)))
    console.print(table)

    seg = tier_counts.get("segments", {})
    if seg:
        seg_table = Table(title="Segment Breakdown")
        seg_table.add_column("Segment", style="cyan")
        seg_table.add_column("Count", justify="right")
        for name, cnt in seg.items():
            seg_table.add_row(name, str(cnt))
        console.print(seg_table)


@cli.command("segment-stats")
def segment_stats() -> None:
    """Show lead counts by segment and tier, plus outreach reply/close rates per segment."""
    asyncio.run(_segment_stats())


async def _segment_stats() -> None:
    from sqlalchemy import case, func, select

    from src.database import async_session
    from src.models.score import LeadScore

    async with async_session() as session:
        rows = (await session.execute(
            select(
                LeadScore.segment,
                LeadScore.tier,
                func.count(LeadScore.id),
                func.avg(LeadScore.score),
            )
            .group_by(LeadScore.segment, LeadScore.tier)
            .order_by(LeadScore.segment, LeadScore.tier)
        )).all()

    if not rows:
        console.print("[yellow]No scored leads yet.[/yellow]")
        return

    table = Table(title="Segment × Tier Breakdown")
    table.add_column("Segment", style="cyan")
    table.add_column("Tier", style="bold")
    table.add_column("Count", justify="right")
    table.add_column("Avg Score", justify="right")

    seg_totals: dict[str, int] = {}
    for seg, tier, cnt, avg_score in rows:
        seg_label = seg or "UNSET"
        seg_totals[seg_label] = seg_totals.get(seg_label, 0) + cnt
        table.add_row(seg_label, tier, str(cnt), f"{avg_score:.1f}" if avg_score else "-")
    console.print(table)

    summary = Table(title="Segment Totals")
    summary.add_column("Segment", style="cyan")
    summary.add_column("Total Leads", justify="right")
    for seg, total in sorted(seg_totals.items()):
        summary.add_row(seg, str(total))
    console.print(summary)

    # Outreach reply/close rates per segment (once Phase 3 populates outreach_log)
    from src.models.outreach import OutreachLog

    outreach_rows = (await session.execute(
        select(
            OutreachLog.segment,
            func.count(OutreachLog.id).label("total_sent"),
            func.count(OutreachLog.replied_at).label("replies"),
        )
        .where(OutreachLog.segment.isnot(None))
        .group_by(OutreachLog.segment)
    )).all() if False else []  # Placeholder — will activate once outreach runs

    # Workaround: query outreach if data exists
    try:
        async with async_session() as session:
            outreach_rows = (await session.execute(
                select(
                    OutreachLog.segment,
                    func.count(OutreachLog.id).label("total_sent"),
                    func.count(OutreachLog.replied_at).label("replies"),
                )
                .where(OutreachLog.segment.isnot(None))
                .group_by(OutreachLog.segment)
            )).all()
    except Exception:
        outreach_rows = []

    if outreach_rows:
        o_table = Table(title="Outreach by Segment")
        o_table.add_column("Segment", style="cyan")
        o_table.add_column("Sent", justify="right")
        o_table.add_column("Replies", justify="right")
        o_table.add_column("Reply Rate", justify="right")
        for seg, total_sent, replies in outreach_rows:
            rate = f"{replies / total_sent * 100:.1f}%" if total_sent else "-"
            o_table.add_row(seg or "UNSET", str(total_sent), str(replies), rate)
        console.print(o_table)
    else:
        console.print("\n[dim]No outreach data yet — reply/close tracking will appear once emails are sent.[/dim]")


@cli.command("backfill-emails")
@click.option("--limit", default=None, type=int, help="Max number of businesses to process (default: all)")
@click.option("--all", "backfill_all", is_flag=True, help="Backfill all businesses; default is only those missing email")
@click.option("--headless/--no-headless", default=True, help="Run browser headless")
def backfill_emails_cmd(limit: int | None, backfill_all: bool, headless: bool) -> None:
    """Re-scrape Maps for existing businesses to fill in email (and update other fields)."""
    asyncio.run(_backfill_emails(limit, backfill_all, headless))


async def _backfill_emails(limit: int | None, backfill_all: bool, headless: bool) -> None:
    from sqlalchemy import select

    from src.database import async_session
    from src.models.business import Business
    from src.scraper.google_maps import backfill_emails

    async with async_session() as session:
        stmt = select(Business).order_by(Business.id)
        if not backfill_all:
            stmt = stmt.where(Business.email.is_(None))
        if limit is not None:
            stmt = stmt.limit(limit)
        rows = (await session.execute(stmt)).scalars().all()

    if not rows:
        console.print("[yellow]No businesses to backfill.[/yellow]")
        return

    console.print(f"\n[bold blue]Backfilling emails[/bold blue]")
    console.print(f"  Businesses: {len(rows)}")
    console.print(f"  Mode: {'all' if backfill_all else 'missing email only'}\n")

    async with async_session() as session:
        updated, skipped = await backfill_emails(session, rows, headless=headless)

    console.print(f"\n[green]Updated {updated} with email[/green]")
    console.print(f"[dim]Skipped / no email found: {skipped}[/dim]")


@cli.command("update-email")
@click.option("--name", "by_name", help="Business name (partial match)")
@click.option("--website", "by_website", help="Website domain (e.g. houseproac.com)")
@click.argument("email")
def update_email_cmd(by_name: str | None, by_website: str | None, email: str) -> None:
    """Update a business's email. Use --name or --website to identify the business."""
    if not by_name and not by_website:
        raise click.UsageError("Provide --name or --website to identify the business.")
    asyncio.run(_update_email(by_name, by_website, email))


async def _update_email(
    by_name: str | None, by_website: str | None, email: str
) -> None:
    from sqlalchemy import select, update

    from src.database import async_session
    from src.models.business import Business
    from src.models.enrichment import EnrichmentData

    async with async_session() as session:
        if by_name:
            stmt = select(Business).where(Business.name.ilike(f"%{by_name}%"))
        else:
            domain = by_website.strip().lower().replace("https://", "").replace("http://", "").split("/")[0]
            stmt = select(Business).where(
                Business.website.ilike(f"%{domain}%")
            )
        result = (await session.execute(stmt)).scalars().all()
        if not result:
            console.print(f"[red]No business found for {'name' if by_name else 'website'}: {by_name or by_website}[/red]")
            return
        if len(result) > 1:
            console.print(f"[yellow]Multiple matches ({len(result)}). Using first.[/yellow]")
        biz = result[0]
        await session.execute(
            update(Business).where(Business.id == biz.id).values(email=email)
        )
        # Dashboard shows email from enrichment_data.best_email; keep it in sync
        enrich_stmt = select(EnrichmentData).where(EnrichmentData.business_id == biz.id)
        enrich_row = (await session.execute(enrich_stmt)).scalars().first()
        if enrich_row:
            await session.execute(
                update(EnrichmentData).where(EnrichmentData.business_id == biz.id).values(best_email=email)
            )
        await session.commit()
        console.print(f"[green]Updated {biz.name} → email: {email}[/green]")


if __name__ == "__main__":
    cli()
