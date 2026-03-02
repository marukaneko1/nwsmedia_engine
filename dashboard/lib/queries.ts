import { readdir } from "fs/promises";
import { supabase } from "./db";
import { getReportsDir } from "./reports-dir";
import type {
  KpiData,
  DailyLeadCount,
  LeadWithDetails,
  ActivityItem,
} from "@/types/database";

const PAGE_SIZE = 1000;

async function fetchAll<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;
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
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { data } = await buildQuery(batch);
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

export async function getKpis(): Promise<KpiData> {
  const now = Date.now();
  const oneWeekAgo = new Date(now - 7 * 86400000).toISOString();
  const twoWeeksAgo = new Date(now - 14 * 86400000).toISOString();
  const oneDayAgo = new Date(now - 86400000).toISOString();

  const [
    { count: totalLeads },
    { count: emailsFound },
    { data: scoreData },
    { count: outreachSent },
    { count: leadsToday },
    { count: emailsThisWeek },
    { count: emailsLastWeek },
    { data: scoresThisWeek },
    { data: scoresLastWeek },
    { count: outreachThisWeek },
    { count: outreachLastWeek },
  ] = await Promise.all([
    supabase.from("businesses").select("*", { count: "exact", head: true }),
    supabase.from("enrichment_data").select("*", { count: "exact", head: true }).neq("best_email", "").not("best_email", "is", null),
    supabase.from("lead_scores").select("score"),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }),
    supabase.from("businesses").select("*", { count: "exact", head: true }).gte("scraped_at", oneDayAgo),
    supabase.from("enrichment_data").select("*", { count: "exact", head: true }).neq("best_email", "").not("best_email", "is", null).gte("enriched_at", oneWeekAgo),
    supabase.from("enrichment_data").select("*", { count: "exact", head: true }).neq("best_email", "").not("best_email", "is", null).gte("enriched_at", twoWeeksAgo).lt("enriched_at", oneWeekAgo),
    supabase.from("lead_scores").select("score").gte("created_at", oneWeekAgo),
    supabase.from("lead_scores").select("score").gte("created_at", twoWeeksAgo).lt("created_at", oneWeekAgo),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", oneWeekAgo),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", twoWeeksAgo).lt("sent_at", oneWeekAgo),
  ]);

  const scores = scoreData ?? [];
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length)
    : 0;

  const avgThis = (scoresThisWeek ?? []).length > 0
    ? Math.round((scoresThisWeek ?? []).reduce((sum, s) => sum + (s.score || 0), 0) / (scoresThisWeek ?? []).length)
    : 0;
  const avgLast = (scoresLastWeek ?? []).length > 0
    ? Math.round((scoresLastWeek ?? []).reduce((sum, s) => sum + (s.score || 0), 0) / (scoresLastWeek ?? []).length)
    : 0;

  return {
    totalLeads: totalLeads ?? 0,
    emailsFound: emailsFound ?? 0,
    avgScore,
    outreachSent: outreachSent ?? 0,
    leadsToday: leadsToday ?? 0,
    emailsDelta: (emailsThisWeek ?? 0) - (emailsLastWeek ?? 0),
    scoreDelta: avgThis - avgLast,
    outreachDelta: (outreachThisWeek ?? 0) - (outreachLastWeek ?? 0),
  };
}

export async function getDailyLeads(days = 30): Promise<DailyLeadCount[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const data = await fetchAll((from, to) =>
    supabase
      .from("businesses")
      .select("scraped_at")
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
}

export async function getRecentLeads(limit = 20): Promise<LeadWithDetails[]> {
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, category, city, phone, website, rating, review_count, scraped_at")
    .order("scraped_at", { ascending: false })
    .limit(limit);

  if (!businesses || businesses.length === 0) return [];

  const ids = businesses.map((b) => b.id);

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

  return businesses.map((b) => ({
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
  }));
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
  const { count: totalCount } = await supabase
    .from("businesses")
    .select("*", { count: "exact", head: true });

  const businesses = await fetchAll((from, to) => {
    let q = supabase
      .from("businesses")
      .select("id, name, category, city, phone, website, rating, review_count, scraped_at")
      .order("scraped_at", { ascending: false })
      .range(from, to);
    if (filters?.search) {
      q = q.or(`name.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
    }
    if (filters?.city) {
      q = q.eq("city", filters.city);
    }
    return q;
  });

  if (businesses.length === 0) return { leads: [], total: 0 };

  const ids = businesses.map((b) => b.id);

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

  let leads = businesses.map((b) => ({
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
  }));

  if (filters?.tier) leads = leads.filter((l) => l.tier === filters.tier);
  if (filters?.segment) leads = leads.filter((l) => l.segment === filters.segment);
  if (filters?.hasEmail) leads = leads.filter((l) => l.best_email);

  leads.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return { leads, total: totalCount ?? leads.length };
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
    ...triage,
    ...score,
    ...enrichment,
    ...audit,
    id: businessId,
    triage_status: triage?.status ?? lead.triage_status ?? null,
  };

  return {
    lead: mergedLead,
    outreach: outreach ?? [],
    lifecycle: lifecycle ?? [],
    favorited: favSet.has(businessId),
  };
}

export async function getPipelineLeads(): Promise<Record<string, LeadWithDetails[]>> {
  const businesses = await fetchAll((from, to) =>
    supabase
      .from("businesses")
      .select("id, name, category, city, phone, website, rating, review_count, scraped_at")
      .order("scraped_at", { ascending: false })
      .range(from, to)
  );

  if (businesses.length === 0) {
    return { lead: [], contacted: [], replied: [], meeting: [], proposal: [], won: [], lost: [] };
  }

  const ids = businesses.map((b) => b.id);

  const [enrichments, triages, scores, lifecycles, favSet] = await Promise.all([
    fetchInBatches(ids, (batch) =>
      supabase.from("enrichment_data").select("business_id, best_email, owner_name, enrichment_source").in("business_id", batch)
    ),
    fetchInBatches(ids, (batch) =>
      supabase.from("triage_results").select("business_id, status").in("business_id", batch)
    ),
    fetchInBatches(ids, (batch) =>
      supabase.from("lead_scores").select("business_id, score, tier, segment").in("business_id", batch)
    ),
    fetchInBatches(ids, (batch) =>
      supabase.from("lead_lifecycle").select("business_id, status, changed_at").in("business_id", batch).order("changed_at", { ascending: false })
    ),
    getFavoriteSet(ids),
  ]);

  const triageMap = Object.fromEntries(triages.map((t) => [t.business_id, t]));
  const scoreMap = Object.fromEntries(scores.map((s) => [s.business_id, s]));
  const lifecycleMap: Record<number, string> = {};
  for (const lc of lifecycles) {
    if (!lifecycleMap[lc.business_id]) lifecycleMap[lc.business_id] = lc.status;
  }
  const enrichMap: Record<number, { best_email: string | null; owner_name: string | null; enrichment_source: string | null }> = {};
  for (const e of enrichments) {
    const existing = enrichMap[e.business_id];
    const hasEmail = e.best_email != null && String(e.best_email).trim() !== "";
    const existingHasEmail = existing?.best_email != null && String(existing.best_email).trim() !== "";
    if (!existing || (hasEmail && !existingHasEmail)) {
      enrichMap[e.business_id] = {
        best_email: e.best_email,
        owner_name: e.owner_name,
        enrichment_source: e.enrichment_source,
      };
    }
  }

  const pipeline: Record<string, LeadWithDetails[]> = {
    lead: [], contacted: [], replied: [], meeting: [], proposal: [], won: [], lost: [],
  };

  for (const b of businesses) {
    const pipelineStatus = lifecycleMap[b.id] ?? "lead";
    const key = ["contacted", "replied", "meeting", "proposal", "won", "lost"].includes(pipelineStatus)
      ? pipelineStatus
      : "lead";

    const enrich = enrichMap[b.id];
    pipeline[key].push({
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
      best_email: enrich?.best_email ?? null,
      owner_name: enrich?.owner_name ?? null,
      enrichment_source: enrich?.enrichment_source ?? null,
      pipeline_status: pipelineStatus,
      favorited: favSet.has(b.id),
    });
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
}

export async function getRecentActivity(limit = 15): Promise<ActivityItem[]> {
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
}

export async function getCities(): Promise<string[]> {
  const data = await fetchAll((from, to) =>
    supabase
      .from("businesses")
      .select("city")
      .not("city", "is", null)
      .order("city")
      .range(from, to)
  );

  return [...new Set(data.map((r) => r.city as string))];
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
}

export function businessHasAuditPdf(
  name: string,
  pdfSet: Set<string>
): boolean {
  return pdfSet.has(normalize(name));
}
