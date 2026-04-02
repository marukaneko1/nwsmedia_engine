import { db, voiceBusinesses, voiceKnowledgeDocs, voiceAssistants } from "@/lib/voice/db";
import { eq, asc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const biz = db.select().from(voiceBusinesses).where(eq(voiceBusinesses.id, id)).get();
  if (!biz) return Response.json({ error: "Business not found" }, { status: 404 });

  const docs = db.select().from(voiceKnowledgeDocs).where(eq(voiceKnowledgeDocs.businessId, id)).orderBy(asc(voiceKnowledgeDocs.sortOrder)).all();
  const assistantList = db.select().from(voiceAssistants).where(eq(voiceAssistants.businessId, id)).all();

  return Response.json({ ...biz, knowledgeDocs: docs, assistants: assistantList });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  const fieldMap: Record<string, string> = {
    name: "name", industry: "industry", phone: "phone", website: "website",
    address: "address", timezone: "timezone", hours: "hours", tone: "tone",
    custom_rules: "customRules", cta_priority: "ctaPriority",
    transfer_number: "transferNumber", call_direction: "callDirection",
  };
  for (const [bodyKey, dbKey] of Object.entries(fieldMap)) {
    if (body[bodyKey] !== undefined) updates[dbKey] = body[bodyKey];
  }

  db.update(voiceBusinesses).set(updates).where(eq(voiceBusinesses.id, id)).run();
  const updated = db.select().from(voiceBusinesses).where(eq(voiceBusinesses.id, id)).get();
  return Response.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.delete(voiceKnowledgeDocs).where(eq(voiceKnowledgeDocs.businessId, id)).run();
  db.delete(voiceAssistants).where(eq(voiceAssistants.businessId, id)).run();
  db.delete(voiceBusinesses).where(eq(voiceBusinesses.id, id)).run();
  return Response.json({ message: "Business deleted" });
}
