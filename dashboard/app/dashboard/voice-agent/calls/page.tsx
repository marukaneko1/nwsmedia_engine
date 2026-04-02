"use client";

import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, timeAgo } from "@/lib/voice/utils";
import { LANGUAGES } from "@/lib/voice/constants";
import type { VoiceCall } from "@/types/voice";

export default function VoiceCalls() {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<VoiceCall | null>(null);

  const load = () => fetch("/api/voice/calls?limit=100").then(r => r.json()).then(setCalls).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    await fetch("/api/voice/calls/sync", { method: "POST" });
    await load();
    setSyncing(false);
  };

  const langFlag = (code: string | null) => { const l = LANGUAGES.find(x => x.code === code); return l ? `${l.flag} ${l.name}` : code || "\u2014"; };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Call Logs</h2>
        <button onClick={handleSync} disabled={syncing} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Sync
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <table className="w-full">
          <thead><tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3">Time</th><th className="px-4 py-3">Assistant</th><th className="hidden px-4 py-3 sm:table-cell">Language</th><th className="hidden px-4 py-3 md:table-cell">Duration</th><th className="px-4 py-3">Outcome</th>
          </tr></thead>
          <tbody>
            {calls.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No calls found. Click Sync to pull from VAPI.</td></tr>
            ) : calls.map((call, i) => (
              <tr key={call.id} onClick={() => setSelected(call)} className={cn("cursor-pointer text-sm hover:bg-muted/50", i > 0 && "border-t border-border")}>
                <td className="px-4 py-3 text-muted-foreground">{call.createdAt ? timeAgo(call.createdAt) : "\u2014"}</td>
                <td className="px-4 py-3 font-medium">{call.assistant_name || "\u2014"}</td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{langFlag(call.languageUsed)}</td>
                <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">{call.durationSeconds != null ? formatDuration(call.durationSeconds) : "\u2014"}</td>
                <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", call.outcome === "resolved" ? "bg-emerald-500/10 text-emerald-400" : call.outcome === "transferred" ? "bg-amber-500/10 text-amber-400" : "bg-muted text-muted-foreground")}>{call.outcome || "unknown"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Call Detail</h3>
            <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">ID</span><span className="font-mono text-xs">{selected.id}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Direction</span><span>{selected.direction}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span>{selected.durationSeconds != null ? formatDuration(selected.durationSeconds) : "\u2014"}</span></div>
            {selected.summary && <div className="mt-2"><span className="text-muted-foreground">Summary:</span><p className="mt-1">{selected.summary}</p></div>}
          </div>
        </div>
      )}
    </div>
  );
}
