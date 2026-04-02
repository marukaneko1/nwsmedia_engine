import { getLeadsPage, getCities, getLeadIndexCached } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(500, Math.max(10, parseInt(url.searchParams.get("pageSize") ?? "100", 10)));
    const search = url.searchParams.get("q") ?? "";
    const city = url.searchParams.get("city") ?? "";
    const tier = url.searchParams.get("tier") ?? "";
    const segment = url.searchParams.get("segment") ?? "";
    const email = url.searchParams.get("email") ?? "";
    const triage = url.searchParams.get("triage") ?? "";
    const source = url.searchParams.get("source") ?? "";

    const [result, cities, index] = await Promise.all([
      getLeadsPage({
        page,
        pageSize,
        search: search || undefined,
        city: city || undefined,
        tier: tier || undefined,
        segment: segment || undefined,
        hasEmail: email === "yes" ? true : undefined,
        noEmail: email === "no" ? true : undefined,
        triage: triage || undefined,
        source: source || undefined,
      }),
      getCities(),
      getLeadIndexCached(),
    ]);

    const maxId = index.length > 0 ? Math.max(...index.map((l) => l.id)) : 0;

    return Response.json({
      leads: result.leads,
      total: result.total,
      pages: result.pages,
      page,
      pageSize,
      cities,
      indexTotal: index.length,
      maxId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load leads";
    return Response.json({ error: message }, { status: 500 });
  }
}
