"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2, Phone, PhoneOff, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/voice/utils";

export default function TestConsole() {
  const { id } = useParams<{ id: string }>();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    fetch(`/api/voice/test/config/${id}`).then(r => r.json()).then(data => {
      if (data.error) setError(data.error);
      else setConfig(data);
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callActive) interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  const startCall = async () => {
    if (!config?.vapiPublicKey || !config?.vapiAssistantId) { setError("Missing VAPI config"); return; }
    try {
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(config.vapiPublicKey);
      vapi.on("call-start", () => { setCallActive(true); setDuration(0); });
      vapi.on("call-end", () => setCallActive(false));
      vapi.on("error", (e: any) => { setError(e?.message || "Call error"); setCallActive(false); });
      await vapi.start(config.vapiAssistantId);
      (window as any).__vapiInstance = vapi;
    } catch (err: any) { setError(err.message); }
  };

  const endCall = () => { (window as any).__vapiInstance?.stop(); setCallActive(false); };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-lg font-semibold">Test Console: {config?.assistantName}</h2>
      {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}

      <div className="flex flex-col items-center rounded-lg border border-border bg-card p-12">
        {callActive && <p className="mb-4 font-mono text-2xl">{formatDuration(duration)}</p>}
        <button onClick={callActive ? endCall : startCall} className={cn("flex h-20 w-20 items-center justify-center rounded-full text-white transition-all", callActive ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600")}>
          {callActive ? <PhoneOff className="h-8 w-8" /> : <Phone className="h-8 w-8" />}
        </button>
        <p className="mt-4 text-sm text-muted-foreground">{callActive ? "Call in progress... click to end" : "Click to start a test call"}</p>
        {callActive && <div className="mt-4 flex items-center gap-2"><Mic className="h-4 w-4 text-emerald-400 animate-pulse" /><span className="text-xs text-muted-foreground">Listening...</span></div>}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm font-semibold">Connection Info</h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Business</span><span>{config?.businessName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Language</span><span>{config?.defaultLanguage}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">VAPI Assistant</span><span className="font-mono text-xs">{config?.vapiAssistantId?.slice(0, 20)}...</span></div>
        </div>
      </div>
    </div>
  );
}
