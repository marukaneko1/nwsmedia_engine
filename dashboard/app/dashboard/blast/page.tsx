import { Header } from "@/components/dashboard/header";
import { BlastEmailClient } from "@/components/dashboard/blast-email-client";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";

interface BlastLead {
  id: number;
  name: string;
  category: string | null;
  city: string | null;
  email: string;
  rating: number | null;
  review_count: number | null;
  triage_status: string | null;
  score: number | null;
  tier: string | null;
  pipeline_status: string | null;
  outreach_count: number;
  favorited: boolean;
}

export default async function BlastPage() {
  let leads: BlastLead[] = [];
  let dataError: string | null = null;

  try {
    const { data: enriched } = await supabase
      .from("enrichment_data")
      .select("business_id, best_email, owner_name")
      .neq("best_email", "")
      .not("best_email", "is", null);

  if (!enriched || enriched.length === 0) {
      return (
        <>
          <Header title="Blast Email" />
          <main className="p-6">
            <p className="text-muted-foreground">No leads with emails found.</p>
          </main>
        </>
      );
    }

    const ids = enriched.map((e) => e.business_id);

    const [
      { data: businesses },
      { data: triages },
      { data: scores },
      { data: lifecycles },
      { data: outreachRows },
      { data: favorites },
    ] = await Promise.all([
    supabase.from("businesses").select("id, name, category, city, rating, review_count").in("id", ids),
    supabase.from("triage_results").select("business_id, status").in("business_id", ids),
    supabase.from("lead_scores").select("business_id, score, tier").in("business_id", ids),
    supabase.from("lead_lifecycle").select("business_id, status, changed_at").in("business_id", ids).order("changed_at", { ascending: false }),
    supabase.from("outreach_log").select("business_id").in("business_id", ids),
    supabase.from("favorites").select("business_id").in("business_id", ids),
    ]);

    const bizMap = Object.fromEntries((businesses ?? []).map((b) => [b.id, b]));
    const enrichMap = Object.fromEntries(enriched.map((e) => [e.business_id, e]));
    const triageMap = Object.fromEntries((triages ?? []).map((t) => [t.business_id, t]));
    const scoreMap = Object.fromEntries((scores ?? []).map((s) => [s.business_id, s]));
    const favSet = new Set((favorites ?? []).map((f) => f.business_id));

    const lifecycleMap: Record<number, string> = {};
    for (const lc of lifecycles ?? []) {
      if (!lifecycleMap[lc.business_id]) lifecycleMap[lc.business_id] = lc.status;
    }

    const outreachCountMap: Record<number, number> = {};
    for (const o of outreachRows ?? []) {
      outreachCountMap[o.business_id] = (outreachCountMap[o.business_id] ?? 0) + 1;
    }

    const mapped = ids
      .map((id) => {
        const biz = bizMap[id];
        const enrich = enrichMap[id];
        if (!biz || !enrich?.best_email) return null;
        return {
          id: biz.id,
          name: biz.name,
          category: biz.category,
          city: biz.city,
          email: enrich.best_email,
          rating: biz.rating,
          review_count: biz.review_count,
          triage_status: triageMap[id]?.status ?? null,
          score: scoreMap[id]?.score ?? null,
          tier: scoreMap[id]?.tier ?? null,
          pipeline_status: lifecycleMap[id] ?? null,
          outreach_count: outreachCountMap[id] ?? 0,
          favorited: favSet.has(id),
        } as BlastLead;
      })
      .filter((l): l is BlastLead => l !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    leads = mapped;
  } catch (err) {
    dataError = err instanceof Error ? err.message : "Failed to load blast leads";
  }

  return (
    <>
      <Header title="Blast Email" />
      {dataError && (
        <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {dataError}
        </div>
      )}
      <main className="p-6">
        <BlastEmailClient leads={leads} />
      </main>
    </>
  );
}
