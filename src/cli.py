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


# Shared location pools — keeps configs DRY and easy to expand
_LOCATIONS_TIER1 = [
    "San Antonio, TX", "Denver, CO", "Tampa, FL", "Orlando, FL", "Nashville, TN",
    "Charlotte, NC", "Las Vegas, NV", "Jacksonville, FL", "Memphis, TN", "Oklahoma City, OK",
]
_LOCATIONS_TIER2 = [
    "Austin, TX", "Houston, TX", "Dallas, TX", "Phoenix, AZ", "Tucson, AZ",
    "Raleigh, NC", "Richmond, VA", "Louisville, KY", "Indianapolis, IN", "Columbus, OH",
    "Kansas City, MO", "Omaha, NE", "Birmingham, AL", "Knoxville, TN", "Boise, ID",
]
_LOCATIONS_TIER3 = [
    "Colorado Springs, CO", "Fort Worth, TX", "St. Petersburg, FL", "Sarasota, FL",
    "Greenville, SC", "Chattanooga, TN", "Tulsa, OK", "Little Rock, AR",
    "Albuquerque, NM", "El Paso, TX", "Bakersfield, CA", "Fresno, CA",
    "Wichita, KS", "Spokane, WA", "Des Moines, IA",
]
_LOCATIONS_TIER4 = [
    "Atlanta, GA", "Miami, FL", "New Orleans, LA", "Salt Lake City, UT", "Portland, OR",
    "Sacramento, CA", "San Diego, CA", "Minneapolis, MN", "Milwaukee, WI", "Detroit, MI",
    "Cleveland, OH", "Pittsburgh, PA", "Cincinnati, OH", "St. Louis, MO", "Virginia Beach, VA",
    "Grand Rapids, MI", "Baton Rouge, LA", "Charleston, SC", "Savannah, GA", "Mobile, AL",
]
_LOCATIONS_TIER5 = [
    "Lexington, KY", "Huntsville, AL", "Fayetteville, AR", "Shreveport, LA", "Lubbock, TX",
    "Amarillo, TX", "Corpus Christi, TX", "McAllen, TX", "Laredo, TX", "Midland, TX",
    "Pensacola, FL", "Tallahassee, FL", "Gainesville, FL", "Lakeland, FL", "Cape Coral, FL",
    "Columbia, SC", "Augusta, GA", "Macon, GA", "Wilmington, NC", "Asheville, NC",
    "Provo, UT", "Ogden, UT", "Reno, NV", "Bozeman, MT", "Billings, MT",
    "Sioux Falls, SD", "Fargo, ND", "Cedar Rapids, IA", "Lincoln, NE", "Topeka, KS",
    "Springfield, MO", "Branson, MO", "Rogers, AR", "Bentonville, AR", "Tyler, TX",
    "Beaumont, TX", "Killeen, TX", "Abilene, TX", "Anchorage, AK", "Honolulu, HI",
]
_ALL_LOCATIONS = _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4 + _LOCATIONS_TIER5

BATCH_SEARCH_CONFIGS = [
    # ── Core home-service niches (all locations) ──
    {"niche": "HVAC contractor",       "locations": _ALL_LOCATIONS},
    {"niche": "plumber",               "locations": _ALL_LOCATIONS},
    {"niche": "roofer",                "locations": _ALL_LOCATIONS},
    {"niche": "electrician",           "locations": _ALL_LOCATIONS},

    # ── Proven trades (tier 1-4) ──
    {"niche": "general contractor",    "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "landscaping company",   "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "pest control company",  "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "auto repair shop",      "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},

    # ── Underserved / weak web presence (tier 1-4) ──
    {"niche": "tree service",          "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "painting company",      "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "garage door repair",    "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "fence company",         "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "concrete contractor",   "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "septic tank service",   "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},

    # ── Local services hungry for websites (tier 1-4) ──
    {"niche": "junk removal",          "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "pressure washing",      "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "window cleaning company", "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "carpet cleaning",       "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "chimney sweep",         "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "pool cleaning service", "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "appliance repair",      "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "locksmith",             "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "moving company",        "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "flooring installer",    "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "handyman",              "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "drywall contractor",    "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "foundation repair",     "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "gutter cleaning",       "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "water damage restoration", "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},

    # ── Medical / wellness (small practices, bad websites) ──
    {"niche": "dentist",               "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "chiropractor",          "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "physical therapy clinic", "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "veterinarian",          "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "optometrist",           "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "dermatologist",         "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "med spa",              "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},

    # ── Auto / vehicle services ──
    {"niche": "car detailing",         "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "tire shop",             "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "towing company",        "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "auto body shop",        "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "oil change shop",       "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "transmission repair",   "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},

    # ── Food / hospitality (tons of bad websites) ──
    {"niche": "restaurant",            "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "bakery",                "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "catering company",      "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "food truck",            "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "coffee shop",           "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "bar",                   "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},

    # ── Personal services / beauty ──
    {"niche": "hair salon",            "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "barber shop",           "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "nail salon",            "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "tattoo shop",           "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "massage therapist",     "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "personal trainer",      "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "yoga studio",           "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "photography studio",    "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "wedding photographer",  "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},

    # ── Professional services (often outdated sites) ──
    {"niche": "accountant",            "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "insurance agent",       "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "real estate agent",     "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "attorney",              "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "tax preparer",          "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "financial advisor",     "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},

    # ── Specialty home services ──
    {"niche": "solar panel installer", "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "home inspector",        "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "glass repair",          "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "insulation contractor", "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "irrigation company",    "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "lawn care service",     "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "mold remediation",      "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "demolition contractor", "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "paving company",        "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "cabinet maker",         "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "countertop installer",  "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},

    # ── Pet / animal services ──
    {"niche": "dog groomer",           "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "pet boarding",          "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "dog trainer",           "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},

    # ── Education / childcare ──
    {"niche": "daycare",               "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "tutoring service",      "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "martial arts studio",   "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "dance studio",          "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "music school",          "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},

    # ── Misc local businesses ──
    {"niche": "self storage",          "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "laundromat",            "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "dry cleaner",           "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "print shop",            "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2},
    {"niche": "sign company",          "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "event planner",         "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
    {"niche": "cleaning service",      "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3 + _LOCATIONS_TIER4},
    {"niche": "security company",      "locations": _LOCATIONS_TIER1 + _LOCATIONS_TIER2 + _LOCATIONS_TIER3},
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
    """Run full pipeline: triage -> audit -> score -> enrich."""
    asyncio.run(_pipeline())


async def _pipeline() -> None:
    console.print("\n[bold blue]Full Pipeline: Triage -> Audit -> Score -> Enrich[/bold blue]\n")

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
    from sqlalchemy import delete, func, select

    from src.database import async_session
    from src.models.audit import WebsiteAudit
    from src.models.business import Business
    from src.models.score import LeadScore
    from src.models.triage import TriageResult
    from src.scoring import run_scoring

    async with async_session() as session:
        count_result = (await session.execute(select(func.count(LeadScore.id)))).scalar() or 0
        await session.execute(delete(LeadScore))
        await session.commit()
        console.print(f"[yellow]Cleared {count_result} existing scores[/yellow]")

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

    from src.models.outreach import OutreachLog

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


@cli.command("dedup")
@click.option("--dry-run", is_flag=True, help="Only show how many dupes, don't delete")
def dedup(dry_run: bool) -> None:
    """Find and remove duplicate businesses (keeps the oldest row per name+phone/name+city)."""
    asyncio.run(_dedup(dry_run))


async def _dedup(dry_run: bool) -> None:
    from sqlalchemy import delete, select

    from src.database import async_session
    from src.models.business import Business
    from src.scraper.deduplication import normalize_name, normalize_phone

    async with async_session() as session:
        rows = (await session.execute(
            select(Business.id, Business.name, Business.phone, Business.city, Business.scraped_at)
            .order_by(Business.scraped_at.asc())
        )).all()

    seen_keys: dict[str, int] = {}
    dup_ids: list[int] = []

    for biz_id, name, phone, city, _ in rows:
        nn = normalize_name(name)
        np = normalize_phone(phone)
        nc = normalize_name(city)
        if not nn:
            continue
        key = f"{nn}|{np}" if np else f"{nn}|{nc}"
        if key in seen_keys:
            dup_ids.append(biz_id)
        else:
            seen_keys[key] = biz_id

    console.print(f"\n[bold]Duplicate scan:[/bold] {len(rows)} total businesses, [red]{len(dup_ids)}[/red] duplicates found")

    if not dup_ids:
        console.print("[green]No duplicates to remove.[/green]\n")
        return

    if dry_run:
        console.print(f"[dim]Dry run — would delete {len(dup_ids)} duplicate rows. Run without --dry-run to execute.[/dim]\n")
        return

    from src.models.audit import WebsiteAudit
    from src.models.enrichment import EnrichmentData
    from src.models.lifecycle import LeadLifecycle
    from src.models.outreach import OutreachLog
    from src.models.score import LeadScore
    from src.models.triage import TriageResult

    related_tables = [
        ("outreach_log", OutreachLog),
        ("lead_lifecycle", LeadLifecycle),
        ("enrichment_data", EnrichmentData),
        ("lead_scores", LeadScore),
        ("website_audits", WebsiteAudit),
        ("triage_results", TriageResult),
    ]

    async with async_session() as session:
        BATCH = 500
        for i in range(0, len(dup_ids), BATCH):
            batch = dup_ids[i : i + BATCH]
            for tbl_name, model in related_tables:
                await session.execute(delete(model).where(model.business_id.in_(batch)))
            await session.execute(delete(Business).where(Business.id.in_(batch)))
            await session.commit()
            console.print(f"  Deleted batch {i // BATCH + 1} ({len(batch)} rows + related data)")

    console.print(f"\n[bold green]Done.[/bold green] Removed {len(dup_ids)} duplicate businesses and their related data.\n")
    console.print("[dim]Run 'pipeline' to re-triage/score/enrich the remaining clean set.[/dim]\n")


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
        console.print(f"[green]Updated {biz.name} -> email: {email}[/green]")


@cli.command("copy-local-to-supabase")
@click.option(
    "--source",
    "source_url",
    default="postgresql+asyncpg://nwsmedia:nwsmedia@localhost:5433/nwsmedia_leads",
    envvar="SOURCE_DATABASE_URL",
    help="Source DB URL (default: local Docker Postgres)",
)
@click.option("--dry-run", is_flag=True, help="Only print how many would be copied")
def copy_local_to_supabase(source_url: str, dry_run: bool) -> None:
    """Copy businesses from local Postgres into current DB (e.g. Supabase). Use if overnight scrape wrote to local."""
    asyncio.run(_copy_local_to_supabase(source_url, dry_run))


async def _copy_local_to_supabase(source_url: str, dry_run: bool) -> None:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from src.config import settings
    from src.database import async_session
    from src.models.business import Business

    target_url = settings.database_url
    if source_url.replace("+asyncpg", "") == target_url.replace("+asyncpg", ""):
        console.print("[yellow]Source and target URLs look the same. Use SOURCE_DATABASE_URL=... to set source.[/yellow]")
        return

    console.print(f"\n[bold]Copy businesses[/bold]")
    console.print(f"  Source: [dim]{source_url.split('@')[-1] if '@' in source_url else source_url}[/dim]")
    console.print(f"  Target: [dim]{target_url.split('@')[-1] if '@' in target_url else target_url}[/dim]\n")

    source_engine = create_async_engine(
        source_url,
        echo=False,
        pool_size=2,
        max_overflow=0,
    )
    source_maker = async_sessionmaker(source_engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with source_maker() as src_session:
            result = await src_session.execute(select(Business).order_by(Business.id))
            from_source = result.scalars().all()
    except Exception as e:
        console.print(f"[red]Could not connect to source DB: {e}[/red]")
        console.print("[dim]Is local Postgres running? docker compose up -d[/dim]")
        return
    finally:
        await source_engine.dispose()

    if not from_source:
        console.print("[yellow]No businesses in source DB.[/yellow]")
        return

    console.print(f"  Found [green]{len(from_source)}[/green] businesses in source.")

    async with async_session() as tgt_session:
        existing_result = await tgt_session.execute(select(Business.place_id))
        existing_place_ids = set(existing_result.scalars().all())

    to_insert = [b for b in from_source if b.place_id not in existing_place_ids]
    console.print(f"  Already in target: [dim]{len(from_source) - len(to_insert)}[/dim]")
    console.print(f"  To copy: [green]{len(to_insert)}[/green]")

    if dry_run:
        console.print("\n[dim]Dry run. Run without --dry-run to copy.[/dim]")
        return

    if not to_insert:
        console.print("\n[green]Nothing to copy.[/green]")
        return

    async with async_session() as tgt_session:
        for i, b in enumerate(to_insert, 1):
            record = Business(
                place_id=b.place_id,
                source_channel=b.source_channel or "google_maps",
                name=b.name,
                category=b.category,
                address=b.address,
                city=b.city,
                state=b.state,
                zip_code=b.zip_code,
                phone=b.phone,
                email=b.email,
                website=b.website,
                rating=b.rating,
                review_count=b.review_count or 0,
                photos_count=b.photos_count or 0,
                latitude=b.latitude,
                longitude=b.longitude,
                hours=b.hours,
                maps_url=b.maps_url,
                scraped_at=b.scraped_at,
                updated_at=b.updated_at,
            )
            tgt_session.add(record)
            if i % 100 == 0:
                await tgt_session.commit()
                console.print(f"  Committed [dim]{i}[/dim] / {len(to_insert)}")
        await tgt_session.commit()

    console.print(f"\n[bold green]Done.[/bold green] Copied {len(to_insert)} businesses to target DB.\n")


@cli.command("worker")
@click.option("--concurrency", default=2, help="Number of concurrent worker processes")
@click.option("--loglevel", default="info", help="Log level (debug, info, warning, error)")
def worker(concurrency: int, loglevel: str) -> None:
    """Start a Celery worker (runs pipeline tasks)."""
    from src.celery_app import app as celery_app
    from src.utils.logging import setup_logging

    setup_logging(level=loglevel.upper(), json_output=True)
    celery_app.worker_main([
        "worker",
        f"--concurrency={concurrency}",
        f"--loglevel={loglevel}",
        "--pool=solo",
        "-n", "nwsmedia@%h",
    ])


@cli.command("beat")
@click.option("--loglevel", default="info", help="Log level")
def beat(loglevel: str) -> None:
    """Start Celery Beat scheduler (triggers nightly pipeline + daily summary)."""
    from src.celery_app import app as celery_app
    from src.utils.logging import setup_logging

    setup_logging(level=loglevel.upper(), json_output=True)
    celery_app.Beat(loglevel=loglevel.upper()).run()


@cli.command("trigger-pipeline")
@click.option("--max-per-run", default=75, help="Max results per niche+location scrape")
@click.option("--min-score", default=40, help="Min score for enrich/outreach")
@click.option("--dry-run", is_flag=True, help="Don't actually send outreach")
@click.option("--parallel", default=5, help="Number of parallel scrape browsers (default 5)")
def trigger_pipeline(max_per_run: int, min_score: int, dry_run: bool, parallel: int) -> None:
    """Manually dispatch the full pipeline as a Celery chain (requires worker running)."""
    from src.tasks.pipeline import run_full_pipeline

    result = run_full_pipeline.delay(
        max_per_run=max_per_run,
        min_score=min_score,
        dry_run=dry_run,
        parallel_scrapes=parallel,
    )
    console.print(f"[green]Pipeline dispatched.[/green] Task ID: {result.id}")
    console.print("[dim]Monitor with: celery -A src.celery_app inspect active[/dim]")


@cli.command("trigger-summary")
def trigger_summary() -> None:
    """Manually dispatch the daily summary email (requires worker running)."""
    from src.tasks.summary import send_daily_summary

    result = send_daily_summary.delay()
    console.print(f"[green]Summary email dispatched.[/green] Task ID: {result.id}")


@cli.command("test-summary-email")
def test_summary_email() -> None:
    """Send a test daily summary email now (no Celery). Checks SUMMARY_EMAIL_* in .env."""
    import asyncio

    from src.config import settings
    from src.tasks.summary import _build_html, _gather_stats, _send_email

    if not settings.summary_email_from or not settings.summary_email_password or not settings.summary_email_to:
        console.print("[red]Missing SUMMARY_EMAIL_* in .env[/red]")
        console.print("  Set SUMMARY_EMAIL_FROM, SUMMARY_EMAIL_PASSWORD, SUMMARY_EMAIL_TO")
        return

    console.print("[bold blue]Sending test daily summary email...[/bold blue]")
    console.print(f"  From: {settings.summary_email_from}")
    console.print(f"  To:   {settings.summary_email_to}\n")

    try:
        stats = asyncio.run(_gather_stats())
        subject = (
            f"[Test] Lead Engine Daily: {stats['new_businesses_24h']} new, "
            f"{stats['outreach_24h']} sent, {stats['tier_hot']} HOT"
        )
        html = _build_html(stats)
        sent = _send_email(subject, html)
        if sent:
            console.print("[green]Email sent successfully.[/green]")
            console.print(f"  Check [bold]{settings.summary_email_to}[/bold] (and spam folder).")
        else:
            console.print("[red]Send failed (check logs above).[/red]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        raise


if __name__ == "__main__":
    cli()
