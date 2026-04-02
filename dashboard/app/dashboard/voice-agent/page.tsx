"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhoneCall, Bot, Clock, DollarSign, RefreshCw, Plus, BarChart3, Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatCurrency, timeAgo } from "@/lib/voice/utils";
import { LANGUAGES } from "@/lib/voice/constants";

interface OverviewStats {
  totalCalls: number; avgDuration: number; totalCost: number;
  callsThisMonth: number; callsLastMonth: number;
  activeAssistants: number; totalMinutesThisMonth: number;
}

interface RecentCall {
  id: string; assistant_name?: string; languageUsed: string | null;
  durationSeconds: number | null; outcome: string | null; createdAt: string | null;
}

function outcomeBadge(outcome: string | null) {
  switch (outcome) {
    case "resolved": return "bg-green-500/10 text-green-400";
    case "transferred": return "bg-yellow-500/10 text-yellow-400";
    case "abandoned": return "bg-red-500/10 text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function VoiceOverview() {
  const router = useRouter();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [calls, setCalls] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/voice/analytics/overview").then(r => r.json()),
      fetch("/api/voice/calls?limit=10").then(r => r.json()),
    ]).then(([s, c]) => { setStats(s); setCalls(c); }).finally(() => setLoading(false));
  }, []);

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch("/api/voice/calls/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(`Synced ${data.synced} new calls`);
      const [s, c] = await Promise.all([
        fetch("/api/voice/analytics/overview").then(r => r.json()),
        fetch("/api/voice/calls?limit=10").then(r => r.json()),
      ]);
      setStats(s); setCalls(c);
      setTimeout(() => setSyncResult(null), 3000);
    } catch { setSyncResult("Sync failed"); }
    finally { setSyncing(false); }
  };

  const langFlag = (code: string | null) => {
    if (!code) return "\u2014";
    const lang = LANGUAGES.find(l => l.code === code);
    return lang ? `${lang.flag} ${code.toUpperCase()}` : code.toUpperCase();
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const statCards = [
    { label: "Total Calls", value: String(stats?.totalCalls ?? 0), sub: `${stats?.callsThisMonth ?? 0} this month`, icon: PhoneCall, iconBg: "bg-indigo-500/10 text-indigo-400" },
    { label: "Active Assistants", value: String(stats?.activeAssistants ?? 0), sub: "deployed to VAPI", icon: Bot, iconBg: "bg-emerald-500/10 text-emerald-400" },
    { label: "Avg Duration", value: formatDuration(stats?.avgDuration ?? 0), sub: "per call", icon: Clock, iconBg: "bg-amber-500/10 text-amber-400" },
    { label: "Total Cost", value: formatCurrency(stats?.totalCost ?? 0), sub: "all time", icon: DollarSign, iconBg: "bg-red-500/10 text-red-400" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(card => (
          <div key={card.label} className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/30">
            <div className="flex items-start justify-between">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", card.iconBg)}>
                <card.icon className="h-[18px] w-[18px]" />
              </div>
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/30" />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{card.value}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[13px] text-muted-foreground">{card.label}</span>
              <span className="text-[11px] text-muted-foreground/60">{card.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold">Recent Activity</h2>
            <Link href="/dashboard/voice-agent/calls" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          {calls.length === 0 ? (
            <div className="border-t border-border px-5 py-12 text-center text-sm text-muted-foreground">No calls yet. Create an assistant and make a test call.</div>
          ) : (
            <div className="border-t border-border">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-2.5">Time</th><th className="px-5 py-2.5">Assistant</th>
                    <th className="hidden px-5 py-2.5 sm:table-cell">Language</th>
                    <th className="hidden px-5 py-2.5 md:table-cell">Duration</th>
                    <th className="px-5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call, i) => (
                    <tr key={call.id} className={cn("cursor-pointer text-sm transition-colors hover:bg-muted/50", i > 0 && "border-t border-border")} onClick={() => router.push("/dashboard/voice-agent/calls")}>
                      <td className="px-5 py-2.5 text-muted-foreground">{call.createdAt ? timeAgo(call.createdAt) : "\u2014"}</td>
                      <td className="px-5 py-2.5 font-medium">{call.assistant_name || "\u2014"}</td>
                      <td className="hidden px-5 py-2.5 text-muted-foreground sm:table-cell">{langFlag(call.languageUsed)}</td>
                      <td className="hidden px-5 py-2.5 font-mono text-xs text-muted-foreground md:table-cell">{call.durationSeconds != null ? formatDuration(call.durationSeconds) : "\u2014"}</td>
                      <td className="px-5 py-2.5"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", outcomeBadge(call.outcome))}>{call.outcome || "unknown"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Quick Actions</h3>
            <div className="mt-3 space-y-2">
              <button onClick={handleSync} disabled={syncing} className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50">
                <span className="flex items-center gap-2">{syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{syncing ? "Syncing..." : "Sync Calls"}</span>
              </button>
              {syncResult && <p className="px-1 text-xs text-emerald-500">{syncResult}</p>}
              <Link href="/dashboard/voice-agent/businesses/new" className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted">
                <Plus className="h-3.5 w-3.5" /> New Business
              </Link>
              <Link href="/dashboard/voice-agent/analytics" className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted">
                <BarChart3 className="h-3.5 w-3.5" /> Analytics
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">This Month</h3>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Calls</span><span className="font-medium">{stats?.callsThisMonth ?? 0}</span></div>
              <div className="h-px bg-border" />
              <div className="flex justify-between"><span className="text-muted-foreground">Minutes</span><span className="font-medium">{stats?.totalMinutesThisMonth ?? 0}</span></div>
              <div className="h-px bg-border" />
              <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span className="font-medium">{formatCurrency(stats?.totalCost ?? 0)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
