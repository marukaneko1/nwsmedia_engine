"""Daily summary email — sends pipeline stats via SMTP (Gmail)."""

import asyncio
import smtplib
from datetime import timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import structlog

from src.celery_app import app
from src.config import settings
from src.utils.time import utcnow

logger = structlog.get_logger()


def _run_async(coro):
    from src.tasks.pipeline import _get_loop
    return _get_loop().run_until_complete(coro)


async def _gather_stats() -> dict:
    """Query the database for last-24h pipeline statistics."""
    from sqlalchemy import func, select

    from src.database import async_session
    from src.models.business import Business
    from src.models.enrichment import EnrichmentData
    from src.models.outreach import OutreachLog
    from src.models.score import LeadScore
    from src.models.triage import TriageResult

    since = utcnow() - timedelta(hours=24)
    stats = {}

    async with async_session() as session:
        stats["total_businesses"] = (
            await session.execute(select(func.count(Business.id)))
        ).scalar() or 0

        stats["new_businesses_24h"] = (
            await session.execute(
                select(func.count(Business.id)).where(Business.scraped_at >= since)
            )
        ).scalar() or 0

        stats["total_triaged"] = (
            await session.execute(select(func.count(TriageResult.id)))
        ).scalar() or 0

        stats["total_scored"] = (
            await session.execute(select(func.count(LeadScore.id)))
        ).scalar() or 0

        for tier in ["HOT", "WARM", "COOL", "COLD"]:
            stats[f"tier_{tier.lower()}"] = (
                await session.execute(
                    select(func.count(LeadScore.id)).where(LeadScore.tier == tier)
                )
            ).scalar() or 0

        stats["total_enriched"] = (
            await session.execute(
                select(func.count(EnrichmentData.id)).where(
                    EnrichmentData.best_email.isnot(None)
                )
            )
        ).scalar() or 0

        stats["total_outreach"] = (
            await session.execute(select(func.count(OutreachLog.id)))
        ).scalar() or 0

        stats["outreach_24h"] = (
            await session.execute(
                select(func.count(OutreachLog.id)).where(OutreachLog.sent_at >= since)
            )
        ).scalar() or 0

        top_leads_rows = (
            await session.execute(
                select(Business.name, Business.city, LeadScore.score, LeadScore.tier, LeadScore.segment)
                .join(LeadScore, Business.id == LeadScore.business_id)
                .where(Business.scraped_at >= since)
                .order_by(LeadScore.score.desc())
                .limit(10)
            )
        ).all()

        stats["top_new_leads"] = [
            {"name": name, "city": city or "", "score": score, "tier": tier, "segment": seg or ""}
            for name, city, score, tier, seg in top_leads_rows
        ]

    return stats


def _build_html(stats: dict) -> str:
    """Build a clean HTML email body from the stats dict."""
    now = utcnow().strftime("%Y-%m-%d %H:%M UTC")

    top_leads_rows = ""
    for lead in stats.get("top_new_leads", []):
        top_leads_rows += (
            f"<tr>"
            f"<td style='padding:4px 8px;border-bottom:1px solid #eee'>{lead['name']}</td>"
            f"<td style='padding:4px 8px;border-bottom:1px solid #eee'>{lead['city']}</td>"
            f"<td style='padding:4px 8px;border-bottom:1px solid #eee;text-align:center'>{lead['score']}</td>"
            f"<td style='padding:4px 8px;border-bottom:1px solid #eee'>{lead['tier']}</td>"
            f"<td style='padding:4px 8px;border-bottom:1px solid #eee'>{lead['segment']}</td>"
            f"</tr>"
        )

    if not top_leads_rows:
        top_leads_rows = "<tr><td colspan='5' style='padding:8px;color:#999'>No new leads in last 24h</td></tr>"

    return f"""
    <html>
    <body style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#333">
      <h2 style="color:#1a1a2e;border-bottom:2px solid #16213e;padding-bottom:8px">
        NWS Media Lead Engine &mdash; Daily Summary
      </h2>
      <p style="color:#666;font-size:13px">{now}</p>

      <h3 style="color:#16213e">Pipeline Overview</h3>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:6px 12px;font-weight:bold">Total Businesses</td>
            <td style="padding:6px 12px;text-align:right">{stats['total_businesses']:,}</td></tr>
        <tr style="background:#f8f9fa"><td style="padding:6px 12px;font-weight:bold">New (24h)</td>
            <td style="padding:6px 12px;text-align:right;color:#27ae60">{stats['new_businesses_24h']:,}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold">Triaged</td>
            <td style="padding:6px 12px;text-align:right">{stats['total_triaged']:,}</td></tr>
        <tr style="background:#f8f9fa"><td style="padding:6px 12px;font-weight:bold">Scored</td>
            <td style="padding:6px 12px;text-align:right">{stats['total_scored']:,}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold">Enriched (with email)</td>
            <td style="padding:6px 12px;text-align:right">{stats['total_enriched']:,}</td></tr>
        <tr style="background:#f8f9fa"><td style="padding:6px 12px;font-weight:bold">Outreach Sent (24h)</td>
            <td style="padding:6px 12px;text-align:right;color:#e74c3c">{stats['outreach_24h']:,}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold">Total Outreach</td>
            <td style="padding:6px 12px;text-align:right">{stats['total_outreach']:,}</td></tr>
      </table>

      <h3 style="color:#16213e;margin-top:24px">Tier Distribution</h3>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:6px 12px">&#128293; HOT</td>
            <td style="padding:6px 12px;text-align:right;font-weight:bold">{stats['tier_hot']}</td></tr>
        <tr style="background:#f8f9fa"><td style="padding:6px 12px">&#9728;&#65039; WARM</td>
            <td style="padding:6px 12px;text-align:right;font-weight:bold">{stats['tier_warm']}</td></tr>
        <tr><td style="padding:6px 12px">&#10052;&#65039; COOL</td>
            <td style="padding:6px 12px;text-align:right;font-weight:bold">{stats['tier_cool']}</td></tr>
        <tr style="background:#f8f9fa"><td style="padding:6px 12px">&#129482; COLD</td>
            <td style="padding:6px 12px;text-align:right;font-weight:bold">{stats['tier_cold']}</td></tr>
      </table>

      <h3 style="color:#16213e;margin-top:24px">Top New Leads (24h)</h3>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <thead>
          <tr style="background:#16213e;color:white">
            <th style="padding:6px 8px;text-align:left">Name</th>
            <th style="padding:6px 8px;text-align:left">City</th>
            <th style="padding:6px 8px;text-align:center">Score</th>
            <th style="padding:6px 8px;text-align:left">Tier</th>
            <th style="padding:6px 8px;text-align:left">Segment</th>
          </tr>
        </thead>
        <tbody>{top_leads_rows}</tbody>
      </table>

      <p style="margin-top:24px;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:12px">
        Automated report from NWS Media Lead Engine &bull; Celery Beat
      </p>
    </body>
    </html>
    """


def _send_email(subject: str, html_body: str) -> bool:
    """Send via SMTP (Gmail with app password)."""
    smtp_user = settings.summary_email_from
    smtp_pass = settings.summary_email_password
    recipient = settings.summary_email_to

    if not smtp_user or not smtp_pass or not recipient:
        logger.warning("summary_email_skipped", reason="SUMMARY_EMAIL_* env vars not set")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.sender_company} <{smtp_user}>"
    msg["To"] = recipient
    msg.attach(MIMEText(html_body, "html"))

    try:
        # Port 587 with STARTTLS (many VPS providers block 465)
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [recipient], msg.as_string())
        logger.info("summary_email_sent", to=recipient)
        return True
    except Exception as e:
        logger.error("summary_email_failed", error=str(e))
        return False


@app.task(
    bind=True,
    name="src.tasks.summary.send_daily_summary",
    max_retries=2,
    default_retry_delay=300,
)
def send_daily_summary(self):
    """Gather pipeline stats and email the daily summary."""
    try:
        stats = _run_async(_gather_stats())
        subject = (
            f"Lead Engine Daily: {stats['new_businesses_24h']} new, "
            f"{stats['outreach_24h']} sent, "
            f"{stats['tier_hot']} HOT"
        )
        html = _build_html(stats)
        sent = _send_email(subject, html)
        return {"sent": sent, "stats_snapshot": {k: v for k, v in stats.items() if k != "top_new_leads"}}
    except Exception as exc:
        logger.error("summary_task_failed", error=str(exc), retry=self.request.retries)
        raise self.retry(exc=exc)
