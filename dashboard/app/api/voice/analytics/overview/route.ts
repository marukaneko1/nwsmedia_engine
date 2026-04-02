import { sqlite } from "@/lib/voice/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const totals = sqlite
    .prepare(`
    SELECT COUNT(*) as totalCalls,
      COALESCE(AVG(CASE WHEN duration_seconds > 0 THEN duration_seconds END), 0) as avgDuration,
      COALESCE(SUM(cost), 0) as totalCost
    FROM voice_calls
  `)
    .get() as {
    totalCalls?: number;
    avgDuration?: number;
    totalCost?: number;
  };

  const thisMonth = sqlite
    .prepare(`
    SELECT COUNT(*) as count FROM voice_calls WHERE created_at >= date('now', 'start of month')
  `)
    .get() as { count?: number };

  const lastMonth = sqlite
    .prepare(`
    SELECT COUNT(*) as count FROM voice_calls
    WHERE created_at >= date('now', 'start of month', '-1 month')
      AND created_at < date('now', 'start of month')
  `)
    .get() as { count?: number };

  const activeAssistants = sqlite
    .prepare(`
    SELECT COUNT(*) as count FROM voice_assistants WHERE status = 'active'
  `)
    .get() as { count?: number };

  const totalMinutes = sqlite
    .prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as total FROM voice_calls
    WHERE created_at >= date('now', 'start of month')
  `)
    .get() as { total?: number };

  return Response.json({
    totalCalls: totals.totalCalls,
    avgDuration: Math.round(totals.avgDuration ?? 0),
    totalCost: Math.round((totals.totalCost ?? 0) * 100) / 100,
    callsThisMonth: thisMonth.count,
    callsLastMonth: lastMonth.count,
    activeAssistants: activeAssistants.count,
    totalMinutesThisMonth: Math.round((totalMinutes.total ?? 0) / 60),
  });
}
