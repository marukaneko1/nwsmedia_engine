import { db, voiceAssistants } from "@/lib/voice/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asst = db.select().from(voiceAssistants).where(eq(voiceAssistants.id, id)).get();
  if (!asst) return Response.json({ error: "Not found" }, { status: 404 });
  const history = JSON.parse(asst.promptHistory || "[]");
  return Response.json(history);
}
