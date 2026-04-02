"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VoiceSettings() {
  const [status, setStatus] = useState<Record<string, { connected: boolean; error?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [phones, setPhones] = useState<any[]>([]);

  const loadStatus = () => fetch("/api/voice/settings/status").then(r => r.json()).then(setStatus);
  const loadPhones = () => fetch("/api/voice/settings/phone-numbers").then(r => r.json()).then(data => { if (Array.isArray(data)) setPhones(data); });

  useEffect(() => { Promise.all([loadStatus(), loadPhones()]).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-lg font-semibold">Settings</h2>
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">API Connections</h3>
          <button onClick={loadStatus} className="text-xs text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
        <div className="mt-4 space-y-3">
          {Object.entries(status).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <span className="text-sm font-medium capitalize">{key}</span>
              <div className="flex items-center gap-2">
                {val.connected ? <><CheckCircle className="h-4 w-4 text-emerald-400" /><span className="text-xs text-emerald-400">Connected</span></> : <><XCircle className="h-4 w-4 text-red-400" /><span className="text-xs text-red-400">Not connected</span></>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm font-semibold">Phone Numbers</h3>
        <div className="mt-4">
          {phones.length === 0 ? <p className="text-sm text-muted-foreground">No phone numbers found in VAPI.</p> : (
            <div className="space-y-2">{phones.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border px-4 py-2 text-sm">
                <span className="font-mono">{p.number || p.id}</span>
                <span className="text-xs text-muted-foreground">{p.provider || "vapi"}</span>
              </div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}
