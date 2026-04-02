import { db, voiceAssistants, voiceBusinesses, voiceKnowledgeDocs } from "@/lib/voice/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { generateSystemPrompt } from "@/lib/voice/prompt-generator";
import { getLanguageStack } from "@/lib/voice/language-stack";
import * as vapi from "@/lib/voice/vapi-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildVapiPayload(name: string, systemPrompt: string, defaultLanguage: string, greetings: Record<string, string> | null) {
  const stack = getLanguageStack(defaultLanguage);
  const firstMessage = greetings?.[defaultLanguage] || "Hello! Thank you for calling. How can I help you?";
  return {
    name, firstMessage,
    model: { provider: "openai", model: "gpt-4o-mini", messages: [{ role: "system", content: systemPrompt }], temperature: 0.7 },
    transcriber: { provider: stack.transcriber.provider, model: stack.transcriber.model, language: stack.transcriber.language },
    voice: { provider: stack.voice.provider, voiceId: stack.voice.voiceId },
    silenceTimeoutSeconds: 30, maxDurationSeconds: 600,
    endCallPhrases: ["goodbye", "have a nice day", "thanks bye"],
  };
}

export async function GET() {
  const rows = db
    .select({
      id: voiceAssistants.id,
      businessId: voiceAssistants.businessId,
      vapiAssistantId: voiceAssistants.vapiAssistantId,
      name: voiceAssistants.name,
      defaultLanguage: voiceAssistants.defaultLanguage,
      enabledLanguages: voiceAssistants.enabledLanguages,
      status: voiceAssistants.status,
      phoneNumberId: voiceAssistants.phoneNumberId,
      createdAt: voiceAssistants.createdAt,
      updatedAt: voiceAssistants.updatedAt,
      business_name: voiceBusinesses.name,
    })
    .from(voiceAssistants)
    .leftJoin(voiceBusinesses, eq(voiceAssistants.businessId, voiceBusinesses.id))
    .orderBy(desc(voiceAssistants.createdAt))
    .all();

  return Response.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { business_id, name, default_language, enabled_languages, greetings, deploy } = body;
  if (!business_id || !name) return Response.json({ error: "business_id and name are required" }, { status: 400 });

  const biz = db.select().from(voiceBusinesses).where(eq(voiceBusinesses.id, business_id)).get();
  if (!biz) return Response.json({ error: "Business not found" }, { status: 404 });

  const docs = db.select().from(voiceKnowledgeDocs).where(eq(voiceKnowledgeDocs.businessId, business_id)).all();
  const langs: string[] = enabled_languages || ["en"];

  const systemPrompt = generateSystemPrompt({
    business: {
      name: biz.name, industry: biz.industry, address: biz.address, hours: biz.hours,
      tone: biz.tone, custom_rules: biz.customRules, cta_priority: biz.ctaPriority,
      transfer_number: biz.transferNumber, call_direction: biz.callDirection,
    },
    knowledgeDocs: docs.map(d => ({ type: d.type, title: d.title, content: d.content, metadata: d.metadata })),
    enabledLanguages: langs,
  });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(voiceAssistants).values({
    id, businessId: business_id, name,
    defaultLanguage: default_language || "en",
    enabledLanguages: JSON.stringify(langs),
    greetings: greetings ? JSON.stringify(greetings) : null,
    systemPrompt,
    promptHistory: "[]",
    status: "draft",
    createdAt: now, updatedAt: now,
  }).run();

  if (deploy) {
    try {
      const payload = buildVapiPayload(name, systemPrompt, default_language || "en", greetings);
      const vapiAssistant = await vapi.createAssistant(payload);
      db.update(voiceAssistants).set({ vapiAssistantId: vapiAssistant.id, status: "active", updatedAt: new Date().toISOString() }).where(eq(voiceAssistants.id, id)).run();
    } catch (err: any) {
      // deploy failed, non-fatal
    }
  }

  const created = db.select().from(voiceAssistants).where(eq(voiceAssistants.id, id)).get();
  return Response.json(created, { status: 201 });
}
