"use client";

import { useState, useEffect } from "react";
import { Loader2, Phone } from "lucide-react";
import type { VoiceAssistant } from "@/types/voice";

export default function OutboundDialer() {
  const [assistants, setAssistants] = useState<VoiceAssistant[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [calling, setCalling] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/voice/assistants").then(r => r.json()).then(data => {
      const deployed = data.filter((a: VoiceAssistant) => a.vapiAssistantId);
      setAssistants(deployed);
      if (deployed.length > 0) setSelectedId(deployed[0].id);
    });
  }, []);

  const handleCall = async () => {
    if (!selectedId || !phoneNumber) return;
    setCalling(true); setResult(null);
    try {
      const res = await fetch("/api/voice/outbound/single", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assistantId: selectedId, phoneNumber }) });
      const data = await res.json();
      setResult(data.success ? `Call placed: ${data.callId}` : `Error: ${data.error}`);
    } catch (err: any) { setResult(`Error: ${err.message}`); }
    finally { setCalling(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-lg font-semibold">Outbound Dialer</h2>
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Assistant</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {assistants.length === 0 && <option value="">No deployed assistants</option>}
            {assistants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Phone Number</label>
          <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+1234567890" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <button onClick={handleCall} disabled={calling || !selectedId || !phoneNumber} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {calling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Place Call
        </button>
        {result && <p className="text-sm text-muted-foreground">{result}</p>}
      </div>
    </div>
  );
}
