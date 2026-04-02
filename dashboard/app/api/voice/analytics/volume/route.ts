import { sqlite } from "@/lib/voice/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") || "30", 10);
  const rows = sqlite
    .prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM voice_calls
    WHERE created_at >= date('now', '-' || ? || ' days')
    GROUP BY day ORDER BY day
  `)
    .all(days) as { day: string; count: number }[];
  return Response.json(rows);
}
