"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { formatCurrency } from "@/lib/voice/utils";
import type { AnalyticsOverview, CallVolumeEntry, LanguageDistEntry, OutcomeEntry } from "@/types/voice";

const COLORS = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#38bdf8"];

export default function VoiceAnalytics() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [volume, setVolume] = useState<CallVolumeEntry[]>([]);
  const [languages, setLanguages] = useState<LanguageDistEntry[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/voice/analytics/overview").then(r => r.json()),
      fetch("/api/voice/analytics/volume?days=30").then(r => r.json()),
      fetch("/api/voice/analytics/languages").then(r => r.json()),
      fetch("/api/voice/analytics/outcomes").then(r => r.json()),
    ]).then(([o, v, l, oc]) => { setOverview(o); setVolume(v); setLanguages(l); setOutcomes(oc); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Analytics</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Total Calls</p><p className="mt-1 text-2xl font-semibold">{overview?.totalCalls ?? 0}</p></div>
        <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">This Month</p><p className="mt-1 text-2xl font-semibold">{overview?.callsThisMonth ?? 0}</p></div>
        <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Active Assistants</p><p className="mt-1 text-2xl font-semibold">{overview?.activeAssistants ?? 0}</p></div>
        <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Total Cost</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(overview?.totalCost ?? 0)}</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold">Call Volume (30 days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={volume}><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#818cf8" radius={[4,4,0,0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold">Languages</h3>
          {languages.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No data</p> : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart><Pie data={languages} dataKey="count" nameKey="language" cx="50%" cy="50%" outerRadius={80} label={({ name }: any) => name}>
                {languages.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
