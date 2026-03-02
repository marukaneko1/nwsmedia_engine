import { Header } from "@/components/dashboard/header";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { LeadsChart } from "@/components/dashboard/leads-chart";
import { OverviewTable } from "@/components/dashboard/overview-table";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import {
  getDailyLeads,
  getKpis,
  getRecentActivity,
  getRecentLeads,
} from "@/lib/queries";
import type { ActivityItem, DailyLeadCount, KpiData, LeadWithDetails } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const emptyKpis: KpiData = {
  totalLeads: 0,
  emailsFound: 0,
  avgScore: 0,
  outreachSent: 0,
  leadsToday: 0,
  emailsDelta: 0,
  scoreDelta: 0,
  outreachDelta: 0,
};

export default async function DashboardOverviewPage() {
  let kpis = emptyKpis;
  let dailyLeads: DailyLeadCount[] = [];
  let recentLeads: LeadWithDetails[] = [];
  let recentActivity: ActivityItem[] = [];
  let dataError: string | null = null;

  try {
    [kpis, dailyLeads, recentLeads, recentActivity] = await Promise.all([
      getKpis(),
      getDailyLeads(),
      getRecentLeads(),
      getRecentActivity(),
    ]);
  } catch (err) {
    dataError = err instanceof Error ? err.message : "Failed to load dashboard data";
  }

  return (
    <>
      <Header title="Overview" />
      {dataError && (
        <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {dataError}
        </div>
      )}
      <main className="max-w-[1400px] space-y-6 p-6">
        <KpiCards kpis={kpis} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LeadsChart data={dailyLeads} />
          </div>
          <div>
            <RecentActivity activities={recentActivity} />
          </div>
        </div>
        <OverviewTable leads={recentLeads} />
      </main>
    </>
  );
}
