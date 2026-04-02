import { db, voiceCalls, voiceAssistants } from "@/lib/voice/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const call = db.select().from(voiceCalls).where(eq(voiceCalls.id, id)).get();
  if (!call) return Response.json({ error: "Call not found" }, { status: 404 });
  const assistant = db
    .select({ name: voiceAssistants.name })
    .from(voiceAssistants)
    .where(eq(voiceAssistants.id, call.assistantId))
    .get();
  return Response.json({
    ...call,
    assistant_name: assistant?.name || null,
  });
}
