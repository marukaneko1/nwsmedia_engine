import { sqlite } from "@/lib/voice/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = sqlite
    .prepare(`
    SELECT COALESCE(outcome, 'unknown') as outcome, COUNT(*) as count
    FROM voice_calls GROUP BY outcome ORDER BY count DESC
  `)
    .all() as { outcome: string; count: number }[];
  return Response.json(rows);
}
