import { getExportLeadIds, getLeadDetailsForIds, getLeadIndexCached } from "@/lib/queries";
import type { LeadWithDetails } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALL_COLUMNS = [
  { key: "name", label: "Business Name" },
  { key: "category", label: "Category" },
  { key: "city", label: "City" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "rating", label: "Rating" },
  { key: "review_count", label: "Reviews" },
  { key: "best_email", label: "Email" },
  { key: "owner_name", label: "Owner Name" },
  { key: "score", label: "Score" },
  { key: "tier", label: "Tier" },
  { key: "segment", label: "Segment" },
  { key: "triage_status", label: "Website Status" },
  { key: "pipeline_status", label: "Pipeline Status" },
  { key: "enrichment_source", label: "Email Source" },
  { key: "source_channel", label: "Source" },
  { key: "source_url", label: "Source URL" },
  { key: "scraped_at", label: "Scraped Date" },
] as const;

type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

function escapeField(value: string | number | boolean | null | undefined, sep: string): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(sep) || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function leadToRow(lead: LeadWithDetails, columns: ColumnKey[], sep: string): string {
  return columns
    .map((key) => {
      let value = lead[key as keyof LeadWithDetails];
      if (key === "scraped_at" && value) {
        value = new Date(value as string).toLocaleDateString();
      }
      return escapeField(value as string | number | null, sep);
    })
    .join(sep);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "tsv" ? "tsv" : "csv";
    const tier = url.searchParams.get("tier") || undefined;
    const email = url.searchParams.get("email");
    const minIdStr = url.searchParams.get("minId");
    const colsParam = url.searchParams.get("columns");
    const source = url.searchParams.get("source") || undefined;

    const hasEmail = email === "yes" ? true : undefined;
    const minId = minIdStr ? parseInt(minIdStr, 10) : undefined;

    const columns: ColumnKey[] = colsParam
      ? (colsParam.split(",").filter((c) => ALL_COLUMNS.some((ac) => ac.key === c)) as ColumnKey[])
      : ALL_COLUMNS.map((c) => c.key);

    if (url.searchParams.get("count") === "1") {
      const allIds = await getExportLeadIds({ tier, hasEmail, minId, source });
      const maxId = allIds.length > 0 ? Math.max(...allIds) : 0;
      return Response.json({ count: allIds.length, maxId });
    }

    const allIds = await getExportLeadIds({ tier, hasEmail, minId, source });

    const sep = format === "tsv" ? "\t" : ",";
    const header = columns
      .map((key) => {
        const col = ALL_COLUMNS.find((c) => c.key === key);
        return escapeField(col?.label ?? key, sep);
      })
      .join(sep);

    const BATCH_SIZE = 500;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode((format === "csv" ? "\uFEFF" : "") + header + "\n"));

        for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
          const batchIds = allIds.slice(i, i + BATCH_SIZE);
          const leads = await getLeadDetailsForIds(batchIds);
          const idOrder = new Map(batchIds.map((id, idx) => [id, idx]));
          leads.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

          const chunk = leads.map((l) => leadToRow(l, columns, sep)).join("\n") + "\n";
          controller.enqueue(encoder.encode(chunk));
        }

        controller.close();
      },
    });

    const contentType = format === "tsv" ? "text/tab-separated-values" : "text/csv";
    const ext = format === "tsv" ? "tsv" : "csv";
    const filename = `leads_export_${new Date().toISOString().slice(0, 10)}.${ext}`;

    return new Response(stream, {
      headers: {
        "Content-Type": `${contentType}; charset=utf-8`,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
