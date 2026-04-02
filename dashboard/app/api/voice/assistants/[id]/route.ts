import { db, voiceAssistants, voiceBusinesses } from "@/lib/voice/db";
import { eq } from "drizzle-orm";
import * as vapi from "@/lib/voice/vapi-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = db
    .select({
      id: voiceAssistants.id,
      businessId: voiceAssistants.businessId,
      vapiAssistantId: voiceAssistants.vapiAssistantId,
      name: voiceAssistants.name,
      defaultLanguage: voiceAssistants.defaultLanguage,
      enabledLanguages: voiceAssistants.enabledLanguages,
      greetings: voiceAssistants.greetings,
      systemPrompt: voiceAssistants.systemPrompt,
      promptHistory: voiceAssistants.promptHistory,
      voiceConfig: voiceAssistants.voiceConfig,
      sttConfig: voiceAssistants.sttConfig,
      status: voiceAssistants.status,
      phoneNumberId: voiceAssistants.phoneNumberId,
      createdAt: voiceAssistants.createdAt,
      updatedAt: voiceAssistants.updatedAt,
      business_name: voiceBusinesses.name,
      business_industry: voiceBusinesses.industry,
    })
    .from(voiceAssistants)
    .leftJoin(voiceBusinesses, eq(voiceAssistants.businessId, voiceBusinesses.id))
    .where(eq(voiceAssistants.id, id))
    .all();

  if (rows.length === 0) return Response.json({ error: "Assistant not found" }, { status: 404 });
  return Response.json(rows[0]);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  const fieldMap: Record<string, string> = {
    name: "name", default_language: "defaultLanguage", system_prompt: "systemPrompt",
    voice_config: "voiceConfig", stt_config: "sttConfig", status: "status",
    phone_number_id: "phoneNumberId",
  };
  for (const [bodyKey, dbKey] of Object.entries(fieldMap)) {
    if (body[bodyKey] !== undefined) updates[dbKey] = body[bodyKey];
  }

  if (body.enabled_languages !== undefined) {
    updates.enabledLanguages = typeof body.enabled_languages === "string" ? body.enabled_languages : JSON.stringify(body.enabled_languages);
  }
  if (body.greetings !== undefined) {
    updates.greetings = typeof body.greetings === "string" ? body.greetings : JSON.stringify(body.greetings);
  }

  db.update(voiceAssistants).set(updates).where(eq(voiceAssistants.id, id)).run();

  if (body.system_prompt) {
    const asst = db.select().from(voiceAssistants).where(eq(voiceAssistants.id, id)).get();
    if (asst?.vapiAssistantId) {
      try {
        await vapi.updateAssistant(asst.vapiAssistantId, {
          model: { provider: "openai", model: "gpt-4o-mini", messages: [{ role: "system", content: body.system_prompt }], temperature: 0.7 },
        });
      } catch { /* non-fatal */ }
    }
  }

  const result = db.select().from(voiceAssistants).where(eq(voiceAssistants.id, id)).get();
  return Response.json(result);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asst = db.select().from(voiceAssistants).where(eq(voiceAssistants.id, id)).get();
  if (asst?.vapiAssistantId) {
    try { await vapi.deleteAssistant(asst.vapiAssistantId); } catch { /* non-fatal */ }
  }
  db.delete(voiceAssistants).where(eq(voiceAssistants.id, id)).run();
  return Response.json({ success: true });
}
