import { formatNumber } from "@/lib/utils";
import type { KpiData } from "@/types/database";
import { Mail, Send, TrendingUp, Users } from "lucide-react";
import { StatCard } from "./stat-card";

interface KpiCardsProps {
  kpis: KpiData;
}

export function KpiCards({ kpis }: KpiCardsProps) {

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard
        title="Total Leads"
        value={formatNumber(kpis.totalLeads)}
        delta={kpis.leadsToday}
        deltaLabel="today"
        icon={<Users className="size-4 text-muted-foreground" />}
        href="/dashboard/leads"
      />
      <StatCard
        title="Emails Found"
        value={formatNumber(kpis.emailsFound)}
        delta={kpis.emailsDelta}
        deltaLabel="vs last week"
        icon={<Mail className="size-4 text-muted-foreground" />}
        href="/dashboard/emails"
      />
      <StatCard
        title="Avg Score"
        value={`${kpis.avgScore}/100`}
        delta={kpis.scoreDelta}
        deltaLabel="vs last week"
        icon={<TrendingUp className="size-4 text-muted-foreground" />}
        href="/dashboard/analytics"
      />
      <StatCard
        title="Outreach Sent"
        value={formatNumber(kpis.outreachSent)}
        delta={kpis.outreachDelta}
        deltaLabel="vs last week"
        icon={<Send className="size-4 text-muted-foreground" />}
        href="/dashboard/outreach"
      />
    </div>
  );
}
