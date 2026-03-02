import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDailyLeads, getKpis, getCities } from "@/lib/queries";
import { supabase } from "@/lib/db";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const emptyKpis = {
  totalLeads: 0,
  emailsFound: 0,
  avgScore: 0,
  outreachSent: 0,
  leadsToday: 0,
  emailsDelta: 0,
  scoreDelta: 0,
  outreachDelta: 0,
};
const emptyDist: { label: string; count: number }[] = [];

export default async function AnalyticsPage() {
  let kpis = emptyKpis;
  let dailyLeads: Awaited<ReturnType<typeof getDailyLeads>> = [];
  let cities: string[] = [];
  let tierDist = emptyDist;
  let segmentDist = emptyDist;
  let triageDist = emptyDist;
  let cityDist = emptyDist;
  let dataError: string | null = null;

  try {
    [kpis, dailyLeads, cities, tierDist, segmentDist, triageDist, cityDist] =
      await Promise.all([
        getKpis(),
        getDailyLeads(60),
        getCities(),
        getTierDistribution(),
        getSegmentDistribution(),
        getTriageDistribution(),
        getCityDistribution(),
      ]);
  } catch (err) {
    dataError = err instanceof Error ? err.message : "Failed to load analytics";
  }

  return (
    <>
      <Header title="Analytics" />
      {dataError && (
        <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {dataError}
        </div>
      )}
      <main className="p-6 max-w-[1400px] space-y-6">
        {/* Summary row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniStat label="Total Leads" value={kpis.totalLeads} />
          <MiniStat label="Emails Found" value={kpis.emailsFound} />
          <MiniStat label="Avg Score" value={kpis.avgScore} suffix="/100" />
          <MiniStat label="Email Hit Rate" value={kpis.totalLeads > 0 ? Math.round((kpis.emailsFound / kpis.totalLeads) * 100) : 0} suffix="%" />
        </div>

        {/* Charts */}
        <AnalyticsCharts dailyLeads={dailyLeads} />

        {/* Distribution grids */}
        <div className="grid gap-4 lg:grid-cols-2">
          <DistributionCard title="By Tier" data={tierDist} colorFn={tierBadgeColor} />
          <DistributionCard title="By Segment" data={segmentDist} colorFn={segmentBadgeColor} />
          <DistributionCard title="By Triage Status" data={triageDist} colorFn={triageBadgeColor} />
          <DistributionCard title="By City" data={cityDist} colorFn={() => "bg-slate-100 text-slate-700"} />
        </div>
      </main>
    </>
  );
}

function MiniStat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-semibold mt-1">
          {value.toLocaleString()}{suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  );
}

function DistributionCard({
  title,
  data,
  colorFn,
}: {
  title: string;
  data: { label: string; count: number }[];
  colorFn: (label: string) => string;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={colorFn(d.label)}>{d.label}</Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${total > 0 ? (d.count / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm font-medium w-8 text-right">{d.count}</span>
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground">No data yet</p>
        )}
      </CardContent>
    </Card>
  );
}

async function getTierDistribution() {
  const { data } = await supabase.from("lead_scores").select("tier");
  if (!data) return [];
  const counts: Record<string, number> = {};
  for (const r of data) { counts[r.tier] = (counts[r.tier] || 0) + 1; }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

async function getSegmentDistribution() {
  const { data } = await supabase.from("lead_scores").select("segment");
  if (!data) return [];
  const counts: Record<string, number> = {};
  for (const r of data) { counts[r.segment || "UNKNOWN"] = (counts[r.segment || "UNKNOWN"] || 0) + 1; }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

async function getTriageDistribution() {
  const { data } = await supabase.from("triage_results").select("status");
  if (!data) return [];
  const counts: Record<string, number> = {};
  for (const r of data) { counts[r.status] = (counts[r.status] || 0) + 1; }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

async function getCityDistribution() {
  const { data } = await supabase.from("businesses").select("city");
  if (!data) return [];
  const counts: Record<string, number> = {};
  for (const r of data) { counts[r.city || "Unknown"] = (counts[r.city || "Unknown"] || 0) + 1; }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function tierBadgeColor(tier: string) {
  switch (tier) {
    case "HOT": return "bg-red-50 text-red-700 border-red-200";
    case "WARM": return "bg-orange-50 text-orange-700 border-orange-200";
    case "COOL": return "bg-blue-50 text-blue-700 border-blue-200";
    case "COLD": return "bg-slate-50 text-slate-600 border-slate-200";
    default: return "bg-slate-50 text-slate-500";
  }
}

function segmentBadgeColor(segment: string) {
  switch (segment) {
    case "ESTABLISHED": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "NEW_SMALL": return "bg-violet-50 text-violet-700 border-violet-200";
    default: return "bg-slate-50 text-slate-500";
  }
}

function triageBadgeColor(status: string) {
  switch (status) {
    case "HAS_WEBSITE": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "NO_WEBSITE": return "bg-red-50 text-red-700 border-red-200";
    case "DEAD_WEBSITE": return "bg-amber-50 text-amber-700 border-amber-200";
    case "FREE_SUBDOMAIN": return "bg-orange-50 text-orange-700 border-orange-200";
    case "PAGE_BUILDER": return "bg-blue-50 text-blue-700 border-blue-200";
    default: return "bg-slate-50 text-slate-500";
  }
}
