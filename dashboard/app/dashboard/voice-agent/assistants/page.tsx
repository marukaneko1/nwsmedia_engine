"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bot, Settings, Play, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceAssistant } from "@/types/voice";

export default function VoiceAssistants() {
  const [assistants, setAssistants] = useState<VoiceAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => fetch("/api/voice/assistants").then(r => r.json()).then(setAssistants).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    setDeletingId(id);
    await fetch(`/api/voice/assistants/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Assistants</h2>
      {assistants.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border py-20">
          <Bot className="h-8 w-8 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">No assistants yet. Create a business first, then add an assistant.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {assistants.map(asst => (
            <div key={asst.id} className="rounded-lg border border-border bg-card p-5 transition-all hover:border-muted-foreground/30">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10"><Bot className="h-4 w-4 text-emerald-400" /></div>
                  <div>
                    <h3 className="text-sm font-semibold">{asst.name}</h3>
                    {asst.business_name && <p className="text-[11px] text-muted-foreground">{asst.business_name}</p>}
                  </div>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", asst.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground")}>{asst.status || "draft"}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{asst.vapiAssistantId ? `VAPI: ${asst.vapiAssistantId.slice(0, 12)}...` : "Not deployed"}</p>
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                <Link href={`/dashboard/voice-agent/assistants/${asst.id}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"><Settings className="h-3 w-3" /> Configure</Link>
                {asst.vapiAssistantId && <Link href={`/dashboard/voice-agent/assistants/${asst.id}/test`} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"><Play className="h-3 w-3" /> Test</Link>}
                <button onClick={() => handleDelete(asst.id, asst.name)} disabled={deletingId === asst.id} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                  {deletingId === asst.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
