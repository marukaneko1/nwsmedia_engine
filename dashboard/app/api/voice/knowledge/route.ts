import { db, voiceKnowledgeDocs } from "@/lib/voice/db";
import { eq, asc } from "drizzle-orm";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");
  if (!businessId) return Response.json({ error: "businessId required" }, { status: 400 });
  const rows = db.select().from(voiceKnowledgeDocs).where(eq(voiceKnowledgeDocs.businessId, businessId)).orderBy(asc(voiceKnowledgeDocs.sortOrder), asc(voiceKnowledgeDocs.createdAt)).all();
  return Response.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { business_id, type, title, content, metadata, sort_order } = body;
  if (!business_id || !type || !title || !content) return Response.json({ error: "business_id, type, title, content required" }, { status: 400 });

  const id = crypto.randomUUID();
  db.insert(voiceKnowledgeDocs).values({
    id, businessId: business_id, type, title, content,
    metadata: metadata ?? null,
    sortOrder: sort_order ?? 0,
    createdAt: new Date().toISOString(),
  }).run();

  const created = db.select().from(voiceKnowledgeDocs).where(eq(voiceKnowledgeDocs.id, id)).get();
  return Response.json(created, { status: 201 });
}
