import { readdir } from "fs/promises";
import { supabase } from "./db";
import { getReportsDir } from "./reports-dir";
import type {
  KpiData,
  DailyLeadCount,
  LeadWithDetails,
  ActivityItem,
} from "@/types/database";

/* ───── In-memory TTL cache ───── */

const _cache = new Map<string, { data: unknown; expires: number }>();
const DEFAULT_TTL = 30_000; // 30 seconds

function cached<T>(key: string, fn: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
  const hit = _cache.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.data as T);

  const promise = fn().then((data) => {
    _cache.set(key, { data, expires: Date.now() + ttl });
    return data;
  });
  return promise;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) { _cache.clear(); return; }
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

/* ───── Fetch helpers ───── */

const PAGE_SIZE = 1000;

async function fetchAll<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; count?: number | null }>
): Promise<T[]> {
  const first = await buildQuery(0, PAGE_SIZE - 1);
  const firstData = first.data ?? [];
  if (firstData.length < PAGE_SIZE) return firstData;

  const total = first.count;

  if (total != null && total > PAGE_SIZE) {
    // Count available — fetch remaining pages in parallel
    const pages = Math.ceil((total - PAGE_SIZE) / PAGE_SIZE);
    const promises: Promise<T[]>[] = [];
    for (let i = 1; i <= pages; i++) {
      const from = i * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      promises.push(buildQuery(from, to).then((r) => r.data ?? []));
    }
    const rest = await Promise.all(promises);
    return firstData.concat(...rest);
  }

  // No count — fall back to sequential pagination
  const results: T[] = [...firstData];
  let offset = PAGE_SIZE;
  while (true) {
    const { data } = await buildQuery(offset, offset + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return results;
}

async function fetchInBatches<T>(
  ids: number[],
  buildQuery: (batch: number[]) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  if (ids.length === 0) return [];
  const BATCH = 300;
  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    batches.push(ids.slice(i, i + BATCH));
  }
  const batchResults = await Promise.all(
    batches.map((batch) => buildQuery(batch))
  );
  const results: T[] = [];
  for (const { data } of batchResults) {
    if (data) results.push(...data);
  }
  return results;
}

async function getFavoriteSet(ids?: number[]): Promise<Set<number>> {
  if (ids && ids.length > 0) {
    const data = await fetchInBatches(ids, (batch) =>
      supabase.from("favorites").select("business_id").in("business_id", batch)
    );
    return new Set(data.map((r) => r.business_id));
  }
  const all = await fetchAll((from, to) =>
    supabase.from("favorites").select("business_id").range(from, to)
  );
  return new Set(all.map((r) => r.business_id));
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function safeAvg(rows: Array<{ score: number | null }> | null): number {
  const arr = rows ?? [];
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((sum, s) => sum + (s.score || 0), 0) / arr.length);
}

/* ───── Shared lead assembly ───── */

function buildLeadWithDetails(
  b: { id: number; name: string; category: string | null; city: string | null; phone: string | null; website: string | null; rating: number | null; review_count: number | null; scraped_at: string },
  triageMap: Record<number, { status: string }>,
  scoreMap: Record<number, { score: number | null; tier: string | null; segment: string | null }>,
  enrichMap: Record<number, { best_email: string | null; owner_name: string | null; enrichment_source: string | null }>,
  lifecycleMap: Record<number, string>,
  favSet: Set<number>,
): LeadWithDetails {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    city: b.city,
    phone: b.phone,
    website: b.website,
    rating: b.rating,
    review_count: b.review_count,
    scraped_at: b.scraped_at,
    triage_status: triageMap[b.id]?.status ?? null,
    score: scoreMap[b.id]?.score ?? null,
    tier: scoreMap[b.id]?.tier ?? null,
    segment: scoreMap[b.id]?.segment ?? null,
    best_email: enrichMap[b.id]?.best_email ?? null,
    owner_name: enrichMap[b.id]?.owner_name ?? null,
    enrichment_source: enrichMap[b.id]?.enrichment_source ?? null,
    pipeline_status: lifecycleMap[b.id] ?? null,
    favorited: favSet.has(b.id),
  };
}

async function fetchRelatedData(ids: number[]) {
  const [triages, scores, enrichments, lifecycles, favSet] = await Promise.all([
    fetchInBatches(ids, (batch) =>
      supabase.from("triage_results").select("business_id, status").in("business_id", batch)
    ),
    fetchInBatches(ids, (batch) =>
      supabase.from("lead_scores").select("business_id, score, tier, segment").in("business_id", batch)
    ),
    fetchInBatches(ids, (batch) =>
      supabase.from("enrichment_data").select("business_id, best_email, owner_name, enrichment_source").in("business_id", batch)
    ),
    fetchInBatches(ids, (batch) =>
      supabase.from("lead_lifecycle").select("business_id, status, changed_at").in("business_id", batch).order("changed_at", { ascending: false })
    ),
    getFavoriteSet(ids),
  ]);

  const triageMap = Object.fromEntries(triages.map((t) => [t.business_id, t]));
  const scoreMap = Object.fromEntries(scores.map((s) => [s.business_id, s]));
  const enrichMap = Object.fromEntries(enrichments.map((e) => [e.business_id, e]));
  const lifecycleMap: Record<number, string> = {};
  for (const lc of lifecycles) {
    if (!lifecycleMap[lc.business_id]) lifecycleMap[lc.business_id] = lc.status;
  }

  return { triageMap, scoreMap, enrichMap, lifecycleMap, favSet };
}

async function fetchAllBusinessesWithDetails(): Promise<LeadWithDetails[]> {
  const businesses = await fetchAll((from, to) =>
    supabase
      .from("businesses")
      .select("id, name, category, city, phone, website, rating, review_count, scraped_at", { count: "exact" })
      .order("scraped_at", { ascending: false })
      .range(from, to)
  );

  if (businesses.length === 0) return [];

  const seen = new Set<number>();
  const unique = businesses.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });

  const ids = unique.map((b) => b.id);
  const { triageMap, scoreMap, enrichMap, lifecycleMap, favSet } = await fetchRelatedData(ids);

  return unique.map((b) =>
    buildLeadWithDetails(b, triageMap, scoreMap, enrichMap, lifecycleMap, favSet)
  );
}

function getAllLeadsCached(): Promise<LeadWithDetails[]> {
  return cached("all_leads", fetchAllBusinessesWithDetails);
}

/* ───── Exported query functions ───── */

export async function getKpis(): Promise<KpiData> {
  return cached("kpis", async () => {
    const now = Date.now();
    const oneWeekAgo = new Date(now - 7 * 86400000).toISOString();
    const twoWeeksAgo = new Date(now - 14 * 86400000).toISOString();
    const oneDayAgo = new Date(now - 86400000).toISOString();

    const [
      { count: totalLeads },
      { count: emailsFound },
      { count: outreachSent },
      { count: leadsToday },
      { count: emailsThisWeek },
      { count: emailsLastWeek },
      { count: outreachThisWeek },
      { count: outreachLastWeek },
      { data: scoreData },
      { data: scoresThisWeek },
      { data: scoresLastWeek },
    ] = await Promise.all([
      supabase.from("businesses").select("*", { count: "exact", head: true }),
      supabase.from("enrichment_data").select("*", { count: "exact", head: true }).neq("best_email", "").not("best_email", "is", null),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }),
      supabase.from("businesses").select("*", { count: "exact", head: true }).gte("scraped_at", oneDayAgo),
      supabase.from("enrichment_data").select("*", { count: "exact", head: true }).neq("best_email", "").not("best_email", "is", null).gte("enriched_at", oneWeekAgo),
      supabase.from("enrichment_data").select("*", { count: "exact", head: true }).neq("best_email", "").not("best_email", "is", null).gte("enriched_at", twoWeeksAgo).lt("enriched_at", oneWeekAgo),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", oneWeekAgo),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", twoWeeksAgo).lt("sent_at", oneWeekAgo),
      supabase.from("lead_scores").select("score").limit(5000),
      supabase.from("lead_scores").select("score").gte("created_at", oneWeekAgo).limit(5000),
      supabase.from("lead_scores").select("score").gte("created_at", twoWeeksAgo).lt("created_at", oneWeekAgo).limit(5000),
    ]);

    return {
      totalLeads: totalLeads ?? 0,
      emailsFound: emailsFound ?? 0,
      avgScore: safeAvg(scoreData),
      outreachSent: outreachSent ?? 0,
      leadsToday: leadsToday ?? 0,
      emailsDelta: (emailsThisWeek ?? 0) - (emailsLastWeek ?? 0),
      scoreDelta: safeAvg(scoresThisWeek) - safeAvg(scoresLastWeek),
      outreachDelta: (outreachThisWeek ?? 0) - (outreachLastWeek ?? 0),
    };
  });
}

export async function getDailyLeads(days = 30): Promise<DailyLeadCount[]> {
  return cached(`daily_leads_${days}`, async () => {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const data = await fetchAll((from, to) =>
      supabase
        .from("businesses")
        .select("scraped_at", { count: "exact" })
        .gte("scraped_at", since)
        .order("scraped_at", { ascending: true })
        .range(from, to)
    );

    const counts: Record<string, number> = {};
    for (const row of data) {
      const date = new Date(row.scraped_at).toISOString().split("T")[0];
      counts[date] = (counts[date] || 0) + 1;
    }

    return Object.entries(counts).map(([date, count]) => ({ date, count }));
  });
}

export async function getRecentLeads(limit = 20): Promise<LeadWithDetails[]> {
  return cached(`recent_leads_${limit}`, async () => {
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, name, category, city, phone, website, rating, review_count, scraped_at")
      .order("scraped_at", { ascending: false })
      .limit(limit);

    if (!businesses || businesses.length === 0) return [];

    const ids = businesses.map((b) => b.id);
    const { triageMap, scoreMap, enrichMap, lifecycleMap, favSet } = await fetchRelatedData(ids);

    return businesses.map((b) =>
      buildLeadWithDetails(b, triageMap, scoreMap, enrichMap, lifecycleMap, favSet)
    );
  });
}

function sanitizeSearch(s: string): string {
  return s.replace(/[%_().,]/g, "");
}

export async function getLeads(filters?: {
  search?: string;
  city?: string;
  tier?: string;
  segment?: string;
  hasEmail?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ leads: LeadWithDetails[]; total: number }> {
  const hasFilters = filters?.search || filters?.city || filters?.tier || filters?.segment || filters?.hasEmail;

  if (!hasFilters) {
    const allLeads = await getAllLeadsCached();
    const sorted = [...allLeads].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return { leads: sorted, total: sorted.length };
  }

  // Filtered path: still fetch all for now but use the cache as base
  let leads = await getAllLeadsCached();

  if (filters?.search) {
    const q = sanitizeSearch(filters.search).toLowerCase();
    if (q) {
      leads = leads.filter(
        (l) =>
          (l.name && l.name.toLowerCase().includes(q)) ||
          (l.city && l.city.toLowerCase().includes(q)) ||
          (l.category && l.category.toLowerCase().includes(q)) ||
          (l.best_email && l.best_email.toLowerCase().includes(q))
      );
    }
  }
  if (filters?.city) leads = leads.filter((l) => l.city === filters.city);
  if (filters?.tier) leads = leads.filter((l) => l.tier === filters.tier);
  if (filters?.segment) leads = leads.filter((l) => l.segment === filters.segment);
  if (filters?.hasEmail) leads = leads.filter((l) => l.best_email);

  leads.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return { leads, total: leads.length };
}

export async function getLeadById(id: number) {
  const { data: lead } = await supabase.from("businesses").select("*").eq("id", id).single();
  if (!lead) return null;

  const [
    { data: triage },
    { data: score },
    { data: enrichment },
    { data: audit },
    { data: outreach },
    { data: lifecycle },
    favSet,
  ] = await Promise.all([
    supabase.from("triage_results").select("*").eq("business_id", id).single(),
    supabase.from("lead_scores").select("*").eq("business_id", id).single(),
    supabase.from("enrichment_data").select("*").eq("business_id", id).single(),
    supabase.from("website_audits").select("*").eq("business_id", id).single(),
    supabase.from("outreach_log").select("*").eq("business_id", id).order("sent_at", { ascending: false }),
    supabase.from("lead_lifecycle").select("*").eq("business_id", id).order("changed_at", { ascending: false }),
    getFavoriteSet([id]),
  ]);

  const businessId = lead.id;
  const mergedLead = {
    ...lead,
    triage_status: triage?.status ?? null,
    score: score?.score ?? null,
    tier: score?.tier ?? null,
    segment: score?.segment ?? null,
    score_breakdown: score?.score_breakdown ?? null,
    scored_at: score?.scored_at ?? null,
    best_email: enrichment?.best_email ?? null,
    owner_name: enrichment?.owner_name ?? null,
    owner_position: enrichment?.owner_position ?? null,
    enrichment_source: enrichment?.enrichment_source ?? null,
    all_emails: enrichment?.all_emails ?? null,
    social_profiles: enrichment?.social_profiles ?? null,
    url_audited: audit?.url_audited ?? null,
    performance_score: audit?.performance_score ?? null,
    seo_score: audit?.seo_score ?? null,
    accessibility_score: audit?.accessibility_score ?? null,
    best_practices_score: audit?.best_practices_score ?? null,
    has_ssl: audit?.has_ssl ?? null,
    ssl_valid: audit?.ssl_valid ?? null,
    is_mobile_friendly: audit?.is_mobile_friendly ?? null,
    is_outdated: audit?.is_outdated ?? null,
    copyright_year: audit?.copyright_year ?? null,
    technologies: audit?.technologies ?? null,
    is_page_builder: audit?.is_page_builder ?? null,
    lcp_seconds: audit?.lcp_seconds ?? null,
    cls_score: audit?.cls_score ?? null,
    id: businessId,
  };

  return {
    lead: mergedLead,
    outreach: outreach ?? [],
    lifecycle: lifecycle ?? [],
    favorited: favSet.has(businessId),
  };
}

export async function getPipelineLeads(): Promise<Record<string, LeadWithDetails[]>> {
  return cached("pipeline_leads", async () => {
    const allLeads = await getAllLeadsCached();

    const pipeline: Record<string, LeadWithDetails[]> = {
      lead: [], contacted: [], replied: [], meeting: [], proposal: [], won: [], lost: [],
    };

    for (const lead of allLeads) {
      const pipelineStatus = lead.pipeline_status ?? "lead";
      const key = ["contacted", "replied", "meeting", "proposal", "won", "lost"].includes(pipelineStatus)
        ? pipelineStatus
        : "lead";
      pipeline[key].push(lead);
    }

    for (const key of Object.keys(pipeline)) {
      pipeline[key].sort((a, b) => {
        const aFav = a.favorited ? 1 : 0;
        const bFav = b.favorited ? 1 : 0;
        if (bFav !== aFav) return bFav - aFav;
        return (b.score ?? 0) - (a.score ?? 0);
      });
    }

    return pipeline;
  });
}

export async function getRecentActivity(limit = 15): Promise<ActivityItem[]> {
  return cached(`recent_activity_${limit}`, async () => {
    const activities: ActivityItem[] = [];

    const [{ data: enriched }, { data: scraped }] = await Promise.all([
      supabase
        .from("enrichment_data")
        .select("id, business_id, best_email, enrichment_source, enriched_at")
        .order("enriched_at", { ascending: false })
        .limit(limit),
      supabase
        .from("businesses")
        .select("id, name, city, scraped_at")
        .order("scraped_at", { ascending: false })
        .limit(limit),
    ]);

    const bizIds = [...new Set([
      ...(enriched ?? []).map((e) => e.business_id),
    ])];

    let bizNames: Record<number, string> = {};
    if (bizIds.length > 0) {
      const { data: biz } = await supabase
        .from("businesses")
        .select("id, name")
        .in("id", bizIds);
      bizNames = Object.fromEntries((biz ?? []).map((b) => [b.id, b.name]));
    }

    for (const r of (enriched ?? [])) {
      activities.push({
        id: r.id,
        type: "enriched",
        business_name: bizNames[r.business_id] ?? "Unknown",
        detail: r.best_email ? `Email found: ${r.best_email}` : "No email found",
        timestamp: r.enriched_at,
      });
    }

    for (const r of (scraped ?? [])) {
      activities.push({
        id: r.id + 100000,
        type: "scraped",
        business_name: r.name,
        detail: `Scraped from ${r.city || "Google Maps"}`,
        timestamp: r.scraped_at,
      });
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return activities.slice(0, limit);
  });
}

export async function getCities(): Promise<string[]> {
  return cached("cities", async () => {
    // Fetch just city column; deduplicate in JS
    const data = await fetchAll((from, to) =>
      supabase
        .from("businesses")
        .select("city", { count: "exact" })
        .not("city", "is", null)
        .order("city")
        .range(from, to)
    );

    return [...new Set(data.map((r) => r.city as string))].sort();
  }, 120_000); // Cities change rarely — cache for 2 minutes
}

const TRIAGE_SUFFIXES = ["haswebsite", "nowebsite", "deadwebsite", "freesubdomain", "pagebuilder"];

function stripTriageSuffix(normStem: string): string {
  for (const suffix of TRIAGE_SUFFIXES) {
    if (normStem.endsWith(suffix)) {
      return normStem.slice(0, -suffix.length);
    }
  }
  return normStem;
}

export async function getAuditPdfSet(): Promise<Set<string>> {
  return cached("audit_pdf_set", async () => {
    try {
      const reportsDir = await getReportsDir();
      const files = await readdir(reportsDir);
      const normalized = new Set<string>();
      for (const f of files) {
        if (!f.endsWith("_audit.pdf")) continue;
        const normStem = normalize(f.replace(/_audit\.pdf$/, ""));
        normalized.add(normStem);
        normalized.add(stripTriageSuffix(normStem));
      }
      return normalized;
    } catch {
      return new Set();
    }
  }, 60_000);
}

export function businessHasAuditPdf(
  name: string,
  pdfSet: Set<string>
): boolean {
  return pdfSet.has(normalize(name));
}
