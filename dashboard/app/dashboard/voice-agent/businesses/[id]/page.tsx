"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { INDUSTRIES, TONES, CALL_DIRECTIONS } from "@/lib/voice/constants";

export default function EditBusiness() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "Other", phone: "", website: "", address: "", tone: "professional", call_direction: "inbound", transfer_number: "", custom_rules: "" });

  useEffect(() => {
    fetch(`/api/voice/businesses/${id}`).then(r => r.json()).then(data => {
      setForm({ name: data.name || "", industry: data.industry || "Other", phone: data.phone || "", website: data.website || "", address: data.address || "", tone: data.tone || "professional", call_direction: data.callDirection || "inbound", transfer_number: data.transferNumber || "", custom_rules: data.customRules || "" });
    }).finally(() => setLoading(false));
  }, [id]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/voice/businesses/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      router.push("/dashboard/voice-agent/businesses");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-lg font-semibold">Edit Business</h2>
      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div><label className="mb-1 block text-sm font-medium">Business Name *</label><input value={form.name} onChange={set("name")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
        <div><label className="mb-1 block text-sm font-medium">Industry *</label><select value={form.industry} onChange={set("industry")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="mb-1 block text-sm font-medium">Phone</label><input value={form.phone} onChange={set("phone")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
          <div><label className="mb-1 block text-sm font-medium">Website</label><input value={form.website} onChange={set("website")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
        </div>
        <div><label className="mb-1 block text-sm font-medium">Address</label><input value={form.address} onChange={set("address")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="mb-1 block text-sm font-medium">Tone</label><select value={form.tone} onChange={set("tone")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
          <div><label className="mb-1 block text-sm font-medium">Call Direction</label><select value={form.call_direction} onChange={set("call_direction")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{CALL_DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
        </div>
        <div><label className="mb-1 block text-sm font-medium">Transfer Number</label><input value={form.transfer_number} onChange={set("transfer_number")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
        <div><label className="mb-1 block text-sm font-medium">Custom Rules</label><textarea value={form.custom_rules} onChange={set("custom_rules")} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={() => router.back()} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
      </div>
    </div>
  );
}
