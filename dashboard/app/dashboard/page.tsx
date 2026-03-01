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

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardOverviewPage() {
  const [kpis, dailyLeads, recentLeads, recentActivity] = await Promise.all([
    getKpis(),
    getDailyLeads(),
    getRecentLeads(),
    getRecentActivity(),
  ]);

  return (
    <>
      <Header title="Overview" />
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
