import { db, voiceKnowledgeDocs } from "@/lib/voice/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.type !== undefined) updates.type = body.type;
  if (body.title !== undefined) updates.title = body.title;
  if (body.content !== undefined) updates.content = body.content;
  if (body.metadata !== undefined) updates.metadata = body.metadata;
  if (body.sort_order !== undefined) updates.sortOrder = body.sort_order;

  db.update(voiceKnowledgeDocs).set(updates).where(eq(voiceKnowledgeDocs.id, id)).run();
  const updated = db.select().from(voiceKnowledgeDocs).where(eq(voiceKnowledgeDocs.id, id)).get();
  return Response.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.delete(voiceKnowledgeDocs).where(eq(voiceKnowledgeDocs.id, id)).run();
  return Response.json({ message: "Deleted" });
}
