import { db, voiceKnowledgeDocs } from "@/lib/voice/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) return Response.json({ error: "ids required" }, { status: 400 });
  for (let i = 0; i < ids.length; i++) {
    db.update(voiceKnowledgeDocs).set({ sortOrder: i }).where(eq(voiceKnowledgeDocs.id, ids[i])).run();
  }
  return Response.json({ message: "Reorder successful" });
}
