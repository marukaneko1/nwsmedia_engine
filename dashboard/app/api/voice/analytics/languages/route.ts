import { sqlite } from "@/lib/voice/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = sqlite
    .prepare(`
    SELECT COALESCE(language_used, 'unknown') as language, COUNT(*) as count
    FROM voice_calls GROUP BY language_used ORDER BY count DESC
  `)
    .all() as { language: string; count: number }[];
  return Response.json(rows);
}
