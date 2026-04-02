import { db, voiceAssistants } from "@/lib/voice/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index: indexStr } = await params;
  const idx = parseInt(indexStr, 10);
  const asst = db.select().from(voiceAssistants).where(eq(voiceAssistants.id, id)).get();
  if (!asst) return Response.json({ error: "Not found" }, { status: 404 });

  const history: any[] = JSON.parse(asst.promptHistory || "[]");
  if (isNaN(idx) || idx < 0 || idx >= history.length) return Response.json({ error: "Invalid index" }, { status: 400 });

  const rolledBackPrompt = history[idx].prompt;
  if (asst.systemPrompt) history.push({ prompt: asst.systemPrompt, generatedAt: new Date().toISOString() });

  db.update(voiceAssistants).set({
    systemPrompt: rolledBackPrompt, promptHistory: JSON.stringify(history), updatedAt: new Date().toISOString(),
  }).where(eq(voiceAssistants.id, id)).run();

  const result = db.select().from(voiceAssistants).where(eq(voiceAssistants.id, id)).get();
  return Response.json(result);
}
