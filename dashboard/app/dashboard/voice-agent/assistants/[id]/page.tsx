"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, RefreshCw, Rocket, Copy, Play } from "lucide-react";
import { LANGUAGES, TONES } from "@/lib/voice/constants";
import type { VoiceAssistant } from "@/types/voice";

export default function AssistantConfig() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [asst, setAsst] = useState<VoiceAssistant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [name, setName] = useState("");
  const [defaultLang, setDefaultLang] = useState("en");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/voice/assistants/${id}`).then(r => r.json()).then(data => {
      setAsst(data); setName(data.name || ""); setDefaultLang(data.defaultLanguage || "en"); setSystemPrompt(data.systemPrompt || "");
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/voice/assistants/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, default_language: defaultLang, system_prompt: systemPrompt }) });
    setSaving(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await fetch(`/api/voice/assistants/${id}/generate-prompt`, { method: "POST" });
    const data = await res.json();
    if (data.systemPrompt) setSystemPrompt(data.systemPrompt);
    setGenerating(false);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    const res = await fetch(`/api/voice/assistants/${id}/deploy`, { method: "POST" });
    const data = await res.json();
    if (data.id) { setAsst(data); }
    setDeploying(false);
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!asst) return <div className="py-12 text-center text-muted-foreground">Assistant not found</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Configure: {asst.name}</h2>
        <div className="flex gap-2">
          {asst.vapiAssistantId && <Link href={`/dashboard/voice-agent/assistants/${id}/test`} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"><Play className="h-3.5 w-3.5" /> Test Call</Link>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-semibold">Configuration</h3>
          <div><label className="mb-1 block text-sm">Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
          <div><label className="mb-1 block text-sm">Default Language</label>
            <select value={defaultLang} onChange={e => setDefaultLang(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-semibold">Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={asst.status === "active" ? "text-emerald-400" : "text-muted-foreground"}>{asst.status || "draft"}</span></div>
            {asst.vapiAssistantId && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">VAPI ID</span>
                <button onClick={() => { navigator.clipboard.writeText(asst.vapiAssistantId!); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  {asst.vapiAssistantId.slice(0, 16)}... <Copy className="h-3 w-3" /> {copied && <span className="text-emerald-400">Copied</span>}
                </button>
              </div>
            )}
          </div>
          <button onClick={handleDeploy} disabled={deploying} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} {asst.vapiAssistantId ? "Redeploy" : "Deploy to VAPI"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">System Prompt</h3>
          <button onClick={handleGenerate} disabled={generating} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Regenerate
          </button>
        </div>
        <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={16} className="mt-4 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed" />
        <p className="mt-2 text-xs text-muted-foreground">~{Math.ceil((systemPrompt?.length || 0) / 4)} tokens</p>
      </div>
    </div>
  );
}
