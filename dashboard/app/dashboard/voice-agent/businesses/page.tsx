"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Building2, Phone, MapPin, Trash2, Pencil, Loader2 } from "lucide-react";
import type { VoiceBusiness } from "@/types/voice";

export default function VoiceBusinesses() {
  const [businesses, setBusinesses] = useState<VoiceBusiness[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => fetch("/api/voice/businesses").then(r => r.json()).then(setBusinesses).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/voice/businesses/${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Businesses</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{businesses.length} registered</p>
        </div>
        <Link href="/dashboard/voice-agent/businesses/new" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Add Business
        </Link>
      </div>

      {businesses.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border py-20">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">No businesses yet</p>
          <Link href="/dashboard/voice-agent/businesses/new" className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Create Business
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {businesses.map(biz => (
            <div key={biz.id} className="rounded-lg border border-border bg-card p-5 transition-all hover:border-muted-foreground/30">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/10"><Building2 className="h-4 w-4 text-indigo-400" /></div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{biz.name}</h3>
                    {biz.createdAt && <p className="text-[11px] text-muted-foreground">{new Date(biz.createdAt).toLocaleDateString()}</p>}
                  </div>
                </div>
                {biz.industry && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{biz.industry}</span>}
              </div>
              <div className="mt-4 space-y-1.5">
                {biz.phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{biz.phone}</div>}
                {biz.address && <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /><span className="truncate">{biz.address}</span></div>}
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                <Link href={`/dashboard/voice-agent/businesses/${biz.id}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
                  <Pencil className="h-3 w-3" /> Edit
                </Link>
                <button onClick={() => handleDelete(biz.id, biz.name)} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
