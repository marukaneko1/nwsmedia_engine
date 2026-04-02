import { db, voiceCalls, voiceAssistants } from "@/lib/voice/db";
import { eq, desc, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const assistantId = url.searchParams.get("assistantId");
  const language = url.searchParams.get("language");
  const outcome = url.searchParams.get("outcome");
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);

  const conditions = [];
  if (assistantId) conditions.push(eq(voiceCalls.assistantId, assistantId));
  if (language) conditions.push(eq(voiceCalls.languageUsed, language));
  if (outcome) conditions.push(eq(voiceCalls.outcome, outcome));

  const base = db.select().from(voiceCalls);
  const rows = (
    conditions.length > 0 ? base.where(and(...conditions)) : base
  )
    .orderBy(desc(voiceCalls.createdAt))
    .limit(limit)
    .all();

  const uniqueIds = [...new Set(rows.map((r) => r.assistantId))];
  const nameMap: Record<string, string> = {};
  for (const aId of uniqueIds) {
    const a = db
      .select({ name: voiceAssistants.name })
      .from(voiceAssistants)
      .where(eq(voiceAssistants.id, aId))
      .get();
    if (a) nameMap[aId] = a.name;
  }

  const result = rows.map((row) => ({
    ...row,
    assistant_name: nameMap[row.assistantId] || null,
  }));
  return Response.json(result);
}
