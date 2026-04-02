import { db, voiceAssistants, voiceBusinesses, voiceKnowledgeDocs } from "@/lib/voice/db";
import { eq } from "drizzle-orm";
import { generateSystemPrompt, estimateTokenCount } from "@/lib/voice/prompt-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asst = db.select().from(voiceAssistants).where(eq(voiceAssistants.id, id)).get();
  if (!asst) return Response.json({ error: "Assistant not found" }, { status: 404 });

  const biz = db.select().from(voiceBusinesses).where(eq(voiceBusinesses.id, asst.businessId)).get();
  if (!biz) return Response.json({ error: "Business not found" }, { status: 404 });

  const docs = db.select().from(voiceKnowledgeDocs).where(eq(voiceKnowledgeDocs.businessId, asst.businessId)).all();
  const enabledLangs: string[] = JSON.parse(asst.enabledLanguages || '["en"]');

  const systemPrompt = generateSystemPrompt({
    business: {
      name: biz.name, industry: biz.industry, address: biz.address, hours: biz.hours,
      tone: biz.tone, custom_rules: biz.customRules, cta_priority: biz.ctaPriority,
      transfer_number: biz.transferNumber, call_direction: biz.callDirection,
    },
    knowledgeDocs: docs.map(d => ({ type: d.type, title: d.title, content: d.content, metadata: d.metadata })),
    enabledLanguages: enabledLangs,
  });

  const history: any[] = JSON.parse(asst.promptHistory || "[]");
  if (asst.systemPrompt) history.push({ prompt: asst.systemPrompt, generatedAt: new Date().toISOString() });

  db.update(voiceAssistants).set({
    systemPrompt, promptHistory: JSON.stringify(history), updatedAt: new Date().toISOString(),
  }).where(eq(voiceAssistants.id, id)).run();

  return Response.json({ systemPrompt, tokenEstimate: estimateTokenCount(systemPrompt) });
}
