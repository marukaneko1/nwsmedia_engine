import { readdir } from "fs/promises";
import { supabase } from "./db";
import { getReportsDir } from "./reports-dir";
import type {
  KpiData,
  DailyLeadCount,
  LeadWithDetails,
  ActivityItem,
} from "@/types/database";

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
  const { data } = await supabase
    .from("businesses")
    .select("scraped_at")
    .gte("scraped_at", since)
    .order("scraped_at", { ascending: true });

  if (!data) return [];

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

  const [
    { data: triages },
    { data: scores },
    { data: enrichments },
    { data: lifecycles },
  ] = await Promise.all([
    supabase.from("triage_results").select("business_id, status").in("business_id", ids),
    supabase.from("lead_scores").select("business_id, score, tier, segment").in("business_id", ids),
    supabase.from("enrichment_data").select("business_id, best_email, owner_name, enrichment_source").in("business_id", ids),
    supabase.from("lead_lifecycle").select("business_id, status, changed_at").in("business_id", ids).order("changed_at", { ascending: false }),
  ]);

  const triageMap = Object.fromEntries((triages ?? []).map((t) => [t.business_id, t]));
  const scoreMap = Object.fromEntries((scores ?? []).map((s) => [s.business_id, s]));
  const enrichMap = Object.fromEntries((enrichments ?? []).map((e) => [e.business_id, e]));
  const lifecycleMap: Record<number, string> = {};
  for (const lc of (lifecycles ?? [])) {
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
  const limit = filters?.limit ?? 10000;

  let query = supabase
    .from("businesses")
    .select("id, name, category, city, phone, website, rating, review_count, scraped_at", { count: "exact" })
    .order("scraped_at", { ascending: false })
    .limit(limit);

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
  }
  if (filters?.city) {
    query = query.eq("city", filters.city);
  }

  const { data: businesses, count } = await query;
  if (!businesses || businesses.length === 0) return { leads: [], total: 0 };

  const ids = businesses.map((b) => b.id);

  const [
    { data: triages },
    { data: scores },
    { data: enrichments },
    { data: lifecycles },
  ] = await Promise.all([
    supabase.from("triage_results").select("business_id, status").in("business_id", ids),
    supabase.from("lead_scores").select("business_id, score, tier, segment").in("business_id", ids),
    supabase.from("enrichment_data").select("business_id, best_email, owner_name, enrichment_source").in("business_id", ids),
    supabase.from("lead_lifecycle").select("business_id, status, changed_at").in("business_id", ids).order("changed_at", { ascending: false }),
  ]);

  const triageMap = Object.fromEntries((triages ?? []).map((t) => [t.business_id, t]));
  const scoreMap = Object.fromEntries((scores ?? []).map((s) => [s.business_id, s]));
  const enrichMap = Object.fromEntries((enrichments ?? []).map((e) => [e.business_id, e]));
  const lifecycleMap: Record<number, string> = {};
  for (const lc of (lifecycles ?? [])) {
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
  }));

  if (filters?.tier) leads = leads.filter((l) => l.tier === filters.tier);
  if (filters?.segment) leads = leads.filter((l) => l.segment === filters.segment);
  if (filters?.hasEmail) leads = leads.filter((l) => l.best_email);

  leads.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return { leads, total: count ?? leads.length };
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
  ] = await Promise.all([
    supabase.from("triage_results").select("*").eq("business_id", id).single(),
    supabase.from("lead_scores").select("*").eq("business_id", id).single(),
    supabase.from("enrichment_data").select("*").eq("business_id", id).single(),
    supabase.from("website_audits").select("*").eq("business_id", id).single(),
    supabase.from("outreach_log").select("*").eq("business_id", id).order("sent_at", { ascending: false }),
    supabase.from("lead_lifecycle").select("*").eq("business_id", id).order("changed_at", { ascending: false }),
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
  };
}

export async function getPipelineLeads(): Promise<Record<string, LeadWithDetails[]>> {
  // Include all leads (not just those with email): base on businesses, then join enrichment and lifecycle
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, category, city, phone, website, rating, review_count, scraped_at")
    .order("scraped_at", { ascending: false });

  if (!businesses || businesses.length === 0) {
    return { lead: [], contacted: [], replied: [], meeting: [], proposal: [], won: [], lost: [] };
  }

  const ids = businesses.map((b) => b.id);

  const [
    { data: enrichments },
    { data: triages },
    { data: scores },
    { data: lifecycles },
  ] = await Promise.all([
    supabase.from("enrichment_data").select("business_id, best_email, owner_name, enrichment_source").in("business_id", ids),
    supabase.from("triage_results").select("business_id, status").in("business_id", ids),
    supabase.from("lead_scores").select("business_id, score, tier, segment").in("business_id", ids),
    supabase.from("lead_lifecycle").select("business_id, status, changed_at").in("business_id", ids).order("changed_at", { ascending: false }),
  ]);

  const triageMap = Object.fromEntries((triages ?? []).map((t) => [t.business_id, t]));
  const scoreMap = Object.fromEntries((scores ?? []).map((s) => [s.business_id, s]));
  const lifecycleMap: Record<number, string> = {};
  for (const lc of (lifecycles ?? [])) {
    if (!lifecycleMap[lc.business_id]) lifecycleMap[lc.business_id] = lc.status;
  }
  // One enrichment row per business (latest); prefer row with email if multiple
  const enrichMap: Record<number, { best_email: string | null; owner_name: string | null; enrichment_source: string | null }> = {};
  for (const e of (enrichments ?? [])) {
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
    });
  }

  for (const key of Object.keys(pipeline)) {
    pipeline[key].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
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
  const { data } = await supabase
    .from("businesses")
    .select("city")
    .not("city", "is", null)
    .order("city");

  if (!data) return [];
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
