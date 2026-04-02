import { sqlite } from "@/lib/voice/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const totalRow = sqlite.prepare("SELECT COUNT(*) as count FROM voice_calls").get() as {
    count?: number;
  };
  const avgRow = sqlite
    .prepare(
      "SELECT AVG(duration_seconds) as avg FROM voice_calls WHERE duration_seconds > 0"
    )
    .get() as { avg?: number };
  const costRow = sqlite.prepare("SELECT SUM(cost) as total FROM voice_calls").get() as {
    total?: number;
  };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  const monthRow = sqlite
    .prepare("SELECT COUNT(*) as count FROM voice_calls WHERE created_at >= ?")
    .get(startOfMonth) as { count?: number };

  return Response.json({
    totalCalls: totalRow?.count ?? 0,
    avgDuration: Math.round(avgRow?.avg ?? 0),
    totalCost: Math.round((costRow?.total ?? 0) * 100) / 100,
    callsThisMonth: monthRow?.count ?? 0,
  });
}
