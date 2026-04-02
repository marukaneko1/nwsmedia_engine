import { db, voiceAssistants } from "@/lib/voice/db";
import { eq } from "drizzle-orm";
import { getLanguageStack } from "@/lib/voice/language-stack";
import * as vapi from "@/lib/voice/vapi-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asst = db.select().from(voiceAssistants).where(eq(voiceAssistants.id, id)).get();
  if (!asst) return Response.json({ error: "Assistant not found" }, { status: 404 });
  if (!asst.systemPrompt) return Response.json({ error: "No system prompt. Generate one first." }, { status: 400 });

  const lang = asst.defaultLanguage || "en";
  const greetings = asst.greetings ? JSON.parse(asst.greetings) : null;
  const stack = getLanguageStack(lang);
  const firstMessage = greetings?.[lang] || "Hello! Thank you for calling. How can I help you?";

  const payload = {
    name: asst.name, firstMessage,
    model: { provider: "openai", model: "gpt-4o-mini", messages: [{ role: "system", content: asst.systemPrompt }], temperature: 0.7 },
    transcriber: { provider: stack.transcriber.provider, model: stack.transcriber.model, language: stack.transcriber.language },
    voice: { provider: stack.voice.provider, voiceId: stack.voice.voiceId },
    silenceTimeoutSeconds: 30, maxDurationSeconds: 600,
    endCallPhrases: ["goodbye", "have a nice day", "thanks bye"],
  };

  try {
    if (asst.vapiAssistantId) {
      await vapi.updateAssistant(asst.vapiAssistantId, payload);
    } else {
      const created = await vapi.createAssistant(payload);
      db.update(voiceAssistants).set({ vapiAssistantId: created.id }).where(eq(voiceAssistants.id, id)).run();
    }
    db.update(voiceAssistants).set({ status: "active", updatedAt: new Date().toISOString() }).where(eq(voiceAssistants.id, id)).run();
    const result = db.select().from(voiceAssistants).where(eq(voiceAssistants.id, id)).get();
    return Response.json(result);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
