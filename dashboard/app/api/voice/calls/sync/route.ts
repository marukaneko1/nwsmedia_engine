import { db, voiceCalls, voiceAssistants } from "@/lib/voice/db";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import * as vapi from "@/lib/voice/vapi-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const allAssistants = db
    .select()
    .from(voiceAssistants)
    .where(sql`${voiceAssistants.vapiAssistantId} IS NOT NULL`)
    .all();
  let synced = 0;
  let total = 0;

  for (const assistant of allAssistants) {
    try {
      const vapiCalls = await vapi.listCalls(assistant.vapiAssistantId!, 100);
      const callList = Array.isArray(vapiCalls) ? vapiCalls : [];
      total += callList.length;

      for (const vc of callList) {
        const existing = db
          .select({ id: voiceCalls.id })
          .from(voiceCalls)
          .where(eq(voiceCalls.vapiCallId, vc.id))
          .get();
        if (existing) continue;

        let durationSeconds: number | null = null;
        if (vc.startedAt && vc.endedAt)
          durationSeconds = Math.round(
            (new Date(vc.endedAt).getTime() - new Date(vc.startedAt).getTime()) /
              1000
          );

        let outcome: string | null = null;
        if (vc.status === "ended") outcome = "resolved";
        else if (vc.status === "forwarded") outcome = "transferred";
        else if (vc.status) outcome = vc.status;

        const transcript =
          typeof vc.transcript === "string"
            ? vc.transcript
            : vc.transcript
              ? JSON.stringify(vc.transcript)
              : null;

        db.insert(voiceCalls)
          .values({
            id: crypto.randomUUID(),
            assistantId: assistant.id,
            vapiCallId: vc.id,
            direction: vc.type || "inbound",
            durationSeconds,
            transcript,
            outcome,
            cost: vc.cost ?? null,
            vapiMetadata: JSON.stringify(vc),
            createdAt: vc.createdAt || new Date().toISOString(),
          })
          .run();
        synced++;
      }
    } catch {
      /* skip */
    }
  }

  return Response.json({ synced, total });
}
