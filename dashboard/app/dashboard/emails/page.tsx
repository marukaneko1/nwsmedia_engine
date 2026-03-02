import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/db";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EmailsPage() {
  let enriched: Array<{
    business_id: number;
    best_email: string | null;
    owner_name: string | null;
    owner_position: string | null;
    enrichment_source: string | null;
    enriched_at: string;
    all_emails?: unknown;
    social_profiles?: unknown;
  }> = [];
  let bizMap: Record<number, { id: number; name: string; category: string | null; city: string | null; website: string | null }> = {};
  let scoreMap: Record<number, { business_id: number; score: number | null; tier: string | null; segment: string | null }> = {};
  let dataError: string | null = null;

  try {
    const { data: enrichedData } = await supabase
      .from("enrichment_data")
      .select("business_id, best_email, owner_name, owner_position, enrichment_source, enriched_at, all_emails, social_profiles")
      .order("enriched_at", { ascending: false })
      .limit(300);
    enriched = (enrichedData ?? []) as typeof enriched;

    const bizIds = enriched.map((e) => e.business_id);
    const { data: businesses } = bizIds.length > 0
      ? await supabase.from("businesses").select("id, name, category, city, website").in("id", bizIds)
      : { data: [] };
    const { data: scores } = bizIds.length > 0
      ? await supabase.from("lead_scores").select("business_id, score, tier, segment").in("business_id", bizIds)
      : { data: [] };

    bizMap = Object.fromEntries((businesses ?? []).map((b) => [b.id, b]));
    scoreMap = Object.fromEntries((scores ?? []).map((s) => [s.business_id, s]));
  } catch (err) {
    dataError = err instanceof Error ? err.message : "Failed to load emails data";
  }

  const withEmail = (enriched ?? []).filter((e) => e.best_email);
  const withoutEmail = (enriched ?? []).filter((e) => !e.best_email);
  const bySource: Record<string, number> = {};
  for (const e of withEmail) {
    const src = e.enrichment_source || "unknown";
    bySource[src] = (bySource[src] || 0) + 1;
  }

  return (
    <>
      <Header title="Emails Found" />
      {dataError && (
        <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {dataError}
        </div>
      )}
      <main className="p-6 max-w-[1400px] space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Enriched</p>
              <p className="text-2xl font-semibold mt-1">{(enriched ?? []).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">With Email</p>
              <p className="text-2xl font-semibold mt-1 text-emerald-600">{withEmail.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">No Email</p>
              <p className="text-2xl font-semibold mt-1 text-muted-foreground">{withoutEmail.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Hit Rate</p>
              <p className="text-2xl font-semibold mt-1">
                {(enriched ?? []).length > 0
                  ? Math.round((withEmail.length / (enriched ?? []).length) * 100)
                  : 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
            <Card key={src}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">via {src.replace("_", " ")}</p>
                <p className="text-xl font-semibold mt-1">{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Enriched Leads</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(enriched ?? []).map((e) => {
                  const biz = bizMap[e.business_id];
                  const sc = scoreMap[e.business_id];
                  return (
                    <TableRow key={e.business_id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/leads/${e.business_id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {biz?.name ?? `#${e.business_id}`}
                        </Link>
                        {biz?.category && (
                          <p className="text-xs text-muted-foreground">{biz.category}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{biz?.city ?? "—"}</TableCell>
                      <TableCell>
                        {e.best_email ? (
                          <span className="text-sm font-mono text-emerald-700">{e.best_email}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.owner_name || "—"}
                        {e.owner_position && (
                          <p className="text-xs text-muted-foreground">{e.owner_position}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {e.enrichment_source ? (
                          <Badge variant="secondary">{e.enrichment_source.replace("_", " ")}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {sc ? (
                          <span className="text-sm font-semibold">{sc.score}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelative(e.enriched_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
