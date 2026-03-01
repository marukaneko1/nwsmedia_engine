import { readdir, mkdir } from "fs/promises";
import path from "path";
import { supabase } from "./db";
import { getReportsDir } from "./reports-dir";

/* ───────── vertical estimates (ported from Python src/outreach/__init__.py) ───────── */

const VERTICAL_ESTIMATES: Record<string, { avg_job: number; monthly_searches: string; conversion: string }> = {
  hvac: { avg_job: 1500, monthly_searches: "3,200", conversion: "3–5" },
  plumber: { avg_job: 800, monthly_searches: "4,100", conversion: "3–5" },
  electrician: { avg_job: 700, monthly_searches: "2,800", conversion: "3–5" },
  contractor: { avg_job: 2000, monthly_searches: "2,400", conversion: "2–4" },
  dentist: { avg_job: 800, monthly_searches: "5,500", conversion: "4–6" },
  cosmetic_dentist: { avg_job: 1200, monthly_searches: "3,800", conversion: "3–5" },
  med_spa: { avg_job: 900, monthly_searches: "2,900", conversion: "3–5" },
  default: { avg_job: 1000, monthly_searches: "2,400", conversion: "3–5" },
};

function matchVertical(category: string) {
  const cat = (category || "").toLowerCase();
  for (const [key, data] of Object.entries(VERTICAL_ESTIMATES)) {
    if (key === "default") continue;
    if (cat.includes(key.replace("_", " ")) || cat.includes(key)) return data;
  }
  const kws: [string[], string][] = [
    [["heating", "air condition", "cooling", "ac "], "hvac"],
    [["plumb", "pipe", "drain", "water heater"], "plumber"],
    [["dent", "orthodon", "oral"], "dentist"],
    [["spa", "aesthet", "cosmetic", "botox", "laser"], "med_spa"],
    [["electri", "wiring"], "electrician"],
    [["roofing", "remodel", "construct", "paint"], "contractor"],
  ];
  for (const [words, key] of kws) {
    if (words.some((w) => cat.includes(w))) return VERTICAL_ESTIMATES[key];
  }
  return VERTICAL_ESTIMATES["default"];
}

function computeProjections(category: string, city: string, reviewCount: number, rating: string | number | null) {
  const vert = matchVertical(category);
  const avgJob = vert.avg_job;
  const leadsLow = reviewCount < 50 ? 12 : 18;
  const leadsHigh = reviewCount < 50 ? 25 : 40;
  const monthlyRev = avgJob * leadsLow;
  const ratingStr = rating ? String(rating) : "strong";
  const catLower = (category || "your service").toLowerCase();

  const roiTimeline = avgJob >= 1200 ? "1–2 months" : "2–3 months";
  const revMath = `At ~$${avgJob.toLocaleString()} average job value, ${leadsLow} new customers/month = $${monthlyRev.toLocaleString()}/month in additional revenue.`;
  const roiMath =
    avgJob >= 1200
      ? "Just 3–4 new customers from your website covers the entire project cost. Everything after that is pure profit."
      : `Within ${roiTimeline}, the website pays for itself. After that, every new customer from Google is revenue you weren't getting before.`;

  const competitorNote =
    reviewCount > 20
      ? `You have ${reviewCount} reviews and a ${ratingStr}★ rating — that's stronger than most ${catLower}s in ${city || "your area"}. A professional website is the missing piece that turns those searches into calls.`
      : `You're building your reputation with ${reviewCount} reviews and a ${ratingStr}★ rating. A professional website now establishes credibility early and captures searches as your business grows.`;

  return {
    est_monthly_searches: vert.monthly_searches,
    est_monthly_leads: String(leadsLow),
    est_monthly_leads_high: String(leadsHigh),
    est_monthly_revenue: monthlyRev.toLocaleString(),
    est_conversion_rate: vert.conversion,
    est_revenue_math: revMath,
    est_roi_timeline: roiTimeline,
    est_roi_math: roiMath,
    est_competitor_note: competitorNote,
  };
}

/* ───────── HTML builder (mirrors templates/audit_report.html) ───────── */

interface AuditVars {
  business_name: string;
  website: string;
  owner_name: string;
  category: string;
  rating: string;
  review_count: number;
  city: string;
  generated_date: string;
  triage_status: string;
  performance_score: number | null;
  seo_score: number | null;
  has_ssl: boolean;
  ssl_valid: boolean;
  is_mobile_friendly: boolean;
  is_outdated: boolean;
  copyright_year: number | null;
  technologies: string[];
  sender_name: string;
  sender_company: string;
  sender_phone: string;
  [key: string]: unknown;
}

function scoreClass(score: number | null, threshold: number) {
  if (score == null) return "bad";
  return score >= 80 ? "good" : score >= threshold ? "warn" : "bad";
}

function buildAuditHtml(v: AuditVars): string {
  const p = computeProjections(v.category, v.city, v.review_count, v.rating);
  const cat = v.category || "your service";
  const catLower = cat.toLowerCase();
  const city = v.city || "your area";

  let statusSection = "";

  if (v.triage_status === "NO_WEBSITE") {
    statusSection = `
      <div class="section"><h2>Current Status</h2>
        <div class="issue"><div class="title">No Website Found</div>
        <div class="detail">No website is listed on your Google Maps profile. When someone searches "${catLower} in ${city}" and finds you, there is nothing to click through to. They see your competitors' sites instead and call them.</div></div>
      </div>`;
  } else if (v.triage_status === "DEAD_WEBSITE") {
    statusSection = `
      <div class="section"><h2>Current Status</h2>
        <div class="issue"><div class="title">Website Unreachable</div>
        <div class="detail">Your website (${v.website}) is down or returning errors. Every visitor from Google Maps or search hits a dead end. This is actively turning away customers who are ready to call.</div></div>
      </div>`;
  } else if (v.triage_status === "FREE_SUBDOMAIN") {
    statusSection = `
      <div class="section"><h2>Current Status</h2>
        <div class="issue"><div class="title">Free Subdomain Detected</div>
        <div class="detail">Your site is hosted on ${v.website} — a free subdomain. This signals "hobby" rather than "professional business" and Google ranks free subdomains lower. A custom domain costs ~$12/year and dramatically improves credibility.</div></div>
      </div>`;
  } else {
    const perfClass = scoreClass(v.performance_score, 50);
    const seoClass = scoreClass(v.seo_score, 50);
    const sslClass = v.has_ssl ? "good" : "bad";
    const mobileClass = v.is_mobile_friendly ? "good" : "bad";

    let issuesHtml = "";
    if (!v.has_ssl) {
      issuesHtml += `<div class="issue"><div class="title">No SSL Certificate</div><div class="detail">Browsers show a "Not Secure" warning. This erodes trust and can reduce conversions by up to 85%.</div></div>`;
    } else {
      issuesHtml += `<div class="issue pass"><div class="title">SSL Certificate: Active ✓</div></div>`;
    }
    if (v.performance_score != null && v.performance_score < 50) {
      issuesHtml += `<div class="issue"><div class="title">Slow Page Speed (${v.performance_score}/100)</div><div class="detail">Google recommends 90+. Each second of delay costs ~7% in conversions. 53% of mobile visitors leave after 3 seconds.</div></div>`;
    } else if (v.performance_score != null) {
      issuesHtml += `<div class="issue pass"><div class="title">Page Speed: ${v.performance_score}/100 ✓</div></div>`;
    }
    if (v.seo_score != null && v.seo_score < 60) {
      issuesHtml += `<div class="issue"><div class="title">Low SEO Score (${v.seo_score}/100)</div><div class="detail">Missing SEO fundamentals (meta tags, headings, structured data) that help Google rank you above competitors.</div></div>`;
    } else if (v.seo_score != null) {
      issuesHtml += `<div class="issue pass"><div class="title">SEO Score: ${v.seo_score}/100 ✓</div></div>`;
    }
    if (!v.is_mobile_friendly) {
      issuesHtml += `<div class="issue"><div class="title">Not Mobile-Friendly</div><div class="detail">60%+ of local searches happen on phones. Your site doesn't render well on mobile, driving potential customers to competitors.</div></div>`;
    }
    if (v.is_outdated && v.copyright_year) {
      issuesHtml += `<div class="issue"><div class="title">Outdated Content (last updated ${v.copyright_year})</div><div class="detail">An outdated website signals "this business might be closed." Fresh content builds trust and improves SEO.</div></div>`;
    }
    if (v.technologies.length > 0) {
      const isBuilder = v.technologies.some((t) => ["wix", "squarespace", "godaddy_builder"].includes(t.toLowerCase()));
      issuesHtml += `<div class="issue ${isBuilder ? "" : "pass"}"><div class="title">Technology: ${v.technologies.join(", ")}</div>${isBuilder ? `<div class="detail">Page-builder platforms limit performance and SEO flexibility. A custom-built site loads faster and ranks better.</div>` : ""}</div>`;
    }

    statusSection = `
      <div class="score-row">
        <div class="score-card"><div class="value ${perfClass}">${v.performance_score ?? "—"}</div><div class="label">Performance</div></div>
        <div class="score-card"><div class="value ${seoClass}">${v.seo_score ?? "—"}</div><div class="label">SEO</div></div>
        <div class="score-card"><div class="value ${sslClass}">${v.has_ssl ? "✓" : "✗"}</div><div class="label">SSL Secure</div></div>
        <div class="score-card"><div class="value ${mobileClass}">${v.is_mobile_friendly ? "✓" : "✗"}</div><div class="label">Mobile-Friendly</div></div>
      </div>
      <div class="section"><h2>Issues Found</h2>${issuesHtml}</div>`;
  }

  let beforeItems = "";
  if (v.triage_status === "NO_WEBSITE") {
    beforeItems = `<li>No website — invisible to Google searchers</li><li>Google Maps listing with no click-through destination</li><li>Competitors capturing 100% of web traffic</li>`;
  } else if (v.triage_status === "DEAD_WEBSITE") {
    beforeItems = `<li>Website is unreachable — dead end for visitors</li><li>Google penalizes broken sites in ranking</li><li>Every Maps click leads to an error page</li>`;
  } else if (v.triage_status === "FREE_SUBDOMAIN") {
    beforeItems = `<li>Free subdomain hurts credibility</li><li>Lower SEO authority vs custom domains</li><li>Looks unprofessional to potential clients</li>`;
  } else {
    if (v.performance_score != null && v.performance_score < 50) beforeItems += `<li>Slow load speed (${v.performance_score}/100) — losing mobile visitors</li>`;
    if (v.seo_score != null && v.seo_score < 60) beforeItems += `<li>Weak SEO (${v.seo_score}/100) — competitors ranking above you</li>`;
    if (!v.has_ssl) beforeItems += `<li>"Not Secure" browser warning scaring off visitors</li>`;
    if (!v.is_mobile_friendly) beforeItems += `<li>Poor mobile experience — 60%+ of searches are on phones</li>`;
    if (v.is_outdated) beforeItems += `<li>Outdated content (${v.copyright_year}) signals "possibly closed"</li>`;
    beforeItems += `<li>Potential customers leaving before they contact you</li>`;
  }
  beforeItems += `<li>Your ${v.review_count} reviews and ${v.rating}★ rating not leveraged online</li>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>
  @page { size: A4; margin: 1.2cm 1.8cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; font-size: 10pt; line-height: 1.45; }
  .header { background: linear-gradient(135deg, #0f3460 0%, #16213e 100%); color: #fff; padding: 22px 26px; border-radius: 8px; margin-bottom: 16px; }
  .header h1 { font-size: 19pt; margin-bottom: 2px; letter-spacing: -0.3px; }
  .header .subtitle { font-size: 10pt; opacity: 0.85; }
  .header .badge { display: inline-block; background: #e94560; color: #fff; font-size: 8pt; font-weight: 700; padding: 3px 10px; border-radius: 12px; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 8.5pt; color: #555; }
  .section { margin-bottom: 14px; }
  .section h2 { font-size: 12pt; color: #0f3460; border-bottom: 2px solid #e94560; padding-bottom: 3px; margin-bottom: 8px; }
  .score-row { display: flex; gap: 12px; margin-bottom: 14px; }
  .score-card { flex: 1; background: #f8f9fa; border-radius: 8px; padding: 12px 8px; text-align: center; }
  .score-card .value { font-size: 26pt; font-weight: 700; }
  .score-card .label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-top: 2px; }
  .good { color: #27ae60; } .warn { color: #f39c12; } .bad { color: #e74c3c; }
  .issue { padding: 8px 12px; margin-bottom: 6px; border-left: 4px solid #e94560; background: #fff5f5; border-radius: 0 6px 6px 0; }
  .issue.pass { border-left-color: #27ae60; background: #f0fff4; }
  .issue .title { font-weight: 600; font-size: 9.5pt; }
  .issue .detail { font-size: 8.5pt; color: #555; margin-top: 1px; }
  .opp-grid { display: flex; gap: 12px; margin-bottom: 14px; }
  .opp-card { flex: 1; background: #eef6ff; border-radius: 8px; padding: 14px 12px; text-align: center; border: 1px solid #c8dff5; }
  .opp-card .opp-value { font-size: 22pt; font-weight: 700; color: #0f3460; }
  .opp-card .opp-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-top: 2px; }
  .opp-card .opp-note { font-size: 7pt; color: #888; margin-top: 4px; }
  .opp-card.highlight { background: #eafff0; border-color: #a3dbb8; }
  .opp-card.highlight .opp-value { color: #1a8a42; }
  .gain-list { margin: 0 0 10px 0; padding: 0; }
  .gain-item { display: flex; align-items: flex-start; gap: 8px; padding: 7px 0; border-bottom: 1px solid #f0f0f0; }
  .gain-item:last-child { border-bottom: none; }
  .gain-icon { font-size: 13pt; flex-shrink: 0; width: 24px; text-align: center; }
  .gain-text { font-size: 9pt; } .gain-text strong { color: #0f3460; }
  .before-after { display: flex; gap: 12px; margin-bottom: 10px; }
  .ba-col { flex: 1; border-radius: 8px; padding: 12px; }
  .ba-col.before { background: #fff5f5; border: 1px solid #f5c6cb; }
  .ba-col.after { background: #eafff0; border: 1px solid #a3dbb8; }
  .ba-col h3 { font-size: 9.5pt; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .ba-col.before h3 { color: #c0392b; } .ba-col.after h3 { color: #1a8a42; }
  .ba-col ul { margin: 0; padding-left: 16px; font-size: 8.5pt; color: #444; }
  .ba-col ul li { margin-bottom: 3px; }
  .cta { background: linear-gradient(135deg, #e94560 0%, #c0392b 100%); color: #fff; padding: 16px 22px; border-radius: 8px; text-align: center; margin-top: 14px; }
  .cta h3 { font-size: 13pt; margin-bottom: 4px; }
  .cta p { font-size: 9pt; opacity: 0.92; }
  .cta .cta-link { display: inline-block; margin-top: 8px; background: #fff; color: #e94560; font-weight: 700; padding: 6px 18px; border-radius: 20px; font-size: 9pt; text-decoration: none; }
  .footer { margin-top: 14px; text-align: center; font-size: 7.5pt; color: #999; }
</style></head><body>

<div class="header">
  <h1>Website Audit Report</h1>
  <p class="subtitle">${v.business_name}${v.website ? ` — ${v.website}` : ""}</p>
  <span class="badge">Personalized for ${v.owner_name || v.business_name}</span>
</div>

<div class="meta">
  <span><strong>Category:</strong> ${v.category || "N/A"}</span>
  <span><strong>Rating:</strong> ${v.rating || "N/A"} ★ (${v.review_count} reviews)</span>
  <span><strong>Market:</strong> ${city}</span>
  <span><strong>Generated:</strong> ${v.generated_date}</span>
</div>

${statusSection}

<div class="section">
  <h2>What You're Missing</h2>
  <div class="opp-grid">
    <div class="opp-card">
      <div class="opp-value">${p.est_monthly_searches}+</div>
      <div class="opp-label">Monthly Searches</div>
      <div class="opp-note">"${catLower} in ${city}"</div>
    </div>
    <div class="opp-card">
      <div class="opp-value">${p.est_monthly_leads}–${p.est_monthly_leads_high}</div>
      <div class="opp-label">Leads / Month</div>
      <div class="opp-note">with a properly optimized website</div>
    </div>
    <div class="opp-card highlight">
      <div class="opp-value">$${p.est_monthly_revenue}+</div>
      <div class="opp-label">Potential Revenue / Month</div>
      <div class="opp-note">based on avg ${catLower} job value</div>
    </div>
  </div>
</div>

<div class="section">
  <h2>Before &amp; After: What Changes</h2>
  <div class="before-after">
    <div class="ba-col before">
      <h3>✗ Right Now</h3>
      <ul>${beforeItems}</ul>
    </div>
    <div class="ba-col after">
      <h3>✓ With a New Website</h3>
      <ul>
        <li>Custom site optimized for "${catLower} in ${city}"</li>
        <li>Fast load speed (90+ performance score)</li>
        <li>SEO-optimized to rank on page 1 of Google</li>
        <li>Mobile-first design — looks perfect on every device</li>
        <li>Click-to-call, contact forms, and clear service pages</li>
        <li>Google reviews and ratings showcased on site</li>
        <li>SSL secured — trusted by browsers and customers</li>
        <li>Est. ${p.est_monthly_leads}–${p.est_monthly_leads_high} new leads/month within 6–8 weeks</li>
      </ul>
    </div>
  </div>
</div>

<div class="section">
  <h2>What You'll Gain</h2>
  <div class="gain-list">
    <div class="gain-item"><div class="gain-icon">📈</div><div class="gain-text"><strong>${p.est_monthly_leads}–${p.est_monthly_leads_high} new leads per month</strong> — From Google searches, Maps clicks, and organic traffic. Based on ${p.est_monthly_searches}+ monthly searches for "${catLower}" in ${city} and a ${p.est_conversion_rate}% website conversion rate.</div></div>
    <div class="gain-item"><div class="gain-icon">💰</div><div class="gain-text"><strong>$${p.est_monthly_revenue}+ in additional monthly revenue</strong> — ${p.est_revenue_math}</div></div>
    <div class="gain-item"><div class="gain-icon">🎯</div><div class="gain-text"><strong>Page 1 Google ranking for local searches</strong> — SEO delivers 19.9x return on investment vs 4.4x for paid ads. Unlike ads, organic rankings compound over time and don't stop when you stop spending.</div></div>
    <div class="gain-item"><div class="gain-icon">📱</div><div class="gain-text"><strong>88% of local mobile searchers call or visit within 24 hours</strong> — A mobile-optimized site captures high-intent customers who are ready to buy right now. Your competitors are getting these calls today.</div></div>
    <div class="gain-item"><div class="gain-icon">💪</div><div class="gain-text"><strong>Competitive edge in ${city}</strong> — ${p.est_competitor_note}</div></div>
    <div class="gain-item"><div class="gain-icon">⏱</div><div class="gain-text"><strong>ROI within ${p.est_roi_timeline}</strong> — ${p.est_roi_math}</div></div>
  </div>
</div>

<div class="cta">
  <h3>Let's Build Something That Works for ${v.business_name}</h3>
  <p>I'll walk you through these numbers and show you exactly what your new site would look like.<br>
  No commitment — just a 15-minute conversation.</p>
  <a class="cta-link" href="https://calendly.com/shunya-nwsmedia/30min">Book a Free Call →</a>
</div>

<div class="footer">
  Prepared by ${v.sender_name} · ${v.sender_company} · ${v.sender_phone}
</div>

</body></html>`;
}

/* ───────── PDF file lookup ───────── */

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const TRIAGE_SUFFIXES = ["haswebsite", "nowebsite", "deadwebsite", "freesubdomain", "pagebuilder"];

function stripTriageSuffix(normStem: string): string {
  for (const suffix of TRIAGE_SUFFIXES) {
    if (normStem.endsWith(suffix)) return normStem.slice(0, -suffix.length);
  }
  return normStem;
}

async function findExistingPdf(businessName: string): Promise<string | null> {
  const reportsDir = await getReportsDir();
  let files: string[];
  try {
    files = await readdir(reportsDir);
  } catch {
    return null;
  }

  const normName = normalize(businessName);
  const pdfFiles = files.filter((f) => f.endsWith("_audit.pdf"));

  const match =
    pdfFiles.find((f) => normalize(f.replace(/_audit\.pdf$/, "")) === normName) ??
    pdfFiles.find((f) => stripTriageSuffix(normalize(f.replace(/_audit\.pdf$/, ""))) === normName) ??
    (normName.length >= 15
      ? pdfFiles.find((f) => {
          const n = normalize(f.replace(/_audit\.pdf$/, ""));
          const nBase = stripTriageSuffix(n);
          return n.startsWith(normName) || normName.startsWith(n) || nBase.startsWith(normName) || normName.startsWith(nBase);
        })
      : undefined) ??
    null;

  return match ? path.join(reportsDir, match) : null;
}

/* ───────── main export ───────── */

export async function ensureAuditPdf(businessId: number): Promise<string | null> {
  const { data: biz } = await supabase.from("businesses").select("*").eq("id", businessId).single();
  if (!biz) return null;

  const existing = await findExistingPdf(biz.name);
  if (existing) return existing;

  const [{ data: triage }, { data: audit }, { data: enrichment }, { data: scoreRow }] = await Promise.all([
    supabase.from("triage_results").select("*").eq("business_id", businessId).single(),
    supabase.from("website_audits").select("*").eq("business_id", businessId).single(),
    supabase.from("enrichment_data").select("*").eq("business_id", businessId).single(),
    supabase.from("lead_scores").select("*").eq("business_id", businessId).single(),
  ]);

  const now = new Date();
  const generatedDate = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const techs: string[] = [];
  if (audit?.technologies) {
    if (Array.isArray(audit.technologies)) {
      techs.push(...audit.technologies);
    } else if (typeof audit.technologies === "object") {
      techs.push(...Object.keys(audit.technologies));
    }
  }

  const vars: AuditVars = {
    business_name: biz.name,
    website: biz.website || "",
    owner_name: enrichment?.owner_name || "",
    category: biz.category || "",
    rating: biz.rating ? String(biz.rating) : "",
    review_count: biz.review_count || 0,
    city: biz.city || "",
    generated_date: generatedDate,
    triage_status: triage?.status || "HAS_WEBSITE",
    performance_score: audit?.performance_score ?? null,
    seo_score: audit?.seo_score ?? null,
    has_ssl: audit?.has_ssl ?? (audit?.ssl_valid ?? true),
    ssl_valid: audit?.ssl_valid ?? true,
    is_mobile_friendly: audit?.is_mobile_friendly ?? true,
    is_outdated: audit?.is_outdated ?? false,
    copyright_year: audit?.copyright_year ?? null,
    technologies: techs,
    sender_name: process.env.SENDER_NAME || "NWS MEDIA",
    sender_company: process.env.SENDER_COMPANY || "NWS MEDIA",
    sender_phone: process.env.SENDER_PHONE || "",
  };

  const htmlContent = buildAuditHtml(vars);

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const reportsDir = await getReportsDir();
    try {
      await mkdir(reportsDir, { recursive: true });
    } catch { /* already exists */ }

    const safeName = biz.name.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_");
    const filename = `${safeName}_audit.pdf`;
    const outputPath = path.join(reportsDir, filename);

    await page.pdf({
      path: outputPath,
      format: "A4",
      margin: { top: "1.2cm", right: "1.8cm", bottom: "1.2cm", left: "1.8cm" },
      printBackground: true,
    });

    return outputPath;
  } finally {
    await browser.close();
  }
}
