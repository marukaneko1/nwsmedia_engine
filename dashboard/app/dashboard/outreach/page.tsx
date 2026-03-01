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
import { formatRelative, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OutreachPage() {
  const { data: outreach } = await supabase
    .from("outreach_log")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(300);

  const bizIds = [...new Set((outreach ?? []).map((o) => o.business_id))];

  const [{ data: businesses }, { data: lifecycles }] = bizIds.length > 0
    ? await Promise.all([
        supabase.from("businesses").select("id, name, category, city").in("id", bizIds),
        supabase
          .from("lead_lifecycle")
          .select("business_id, status, changed_at")
          .in("business_id", bizIds)
          .order("changed_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const bizMap = Object.fromEntries((businesses ?? []).map((b) => [b.id, b]));

  const pipelineMap: Record<number, string> = {};
  for (const lc of lifecycles ?? []) {
    if (!pipelineMap[lc.business_id]) pipelineMap[lc.business_id] = lc.status;
  }

  const total = (outreach ?? []).length;
  const byStatus: Record<string, number> = {};
  const byCampaign: Record<string, number> = {};
  const bySegment: Record<string, number> = {};
  const byPipeline: Record<string, number> = {};
  const seenBiz = new Set<number>();
  for (const o of outreach ?? []) {
    const st = o.status || "unknown";
    byStatus[st] = (byStatus[st] || 0) + 1;
    const cmp = o.campaign_id ? o.campaign_id.substring(0, 8) + "..." : "none";
    byCampaign[cmp] = (byCampaign[cmp] || 0) + 1;
    const seg = o.segment || "unknown";
    bySegment[seg] = (bySegment[seg] || 0) + 1;
    if (!seenBiz.has(o.business_id)) {
      seenBiz.add(o.business_id);
      const ps = pipelineMap[o.business_id] ?? "lead";
      byPipeline[ps] = (byPipeline[ps] || 0) + 1;
    }
  }

  const sent = byStatus["sent"] || byStatus["queued"] || 0;
  const opened = (outreach ?? []).filter((o) => o.opened_at).length;
  const replied = (outreach ?? []).filter((o) => o.replied_at).length;

  return (
    <>
      <Header title="Outreach Sent" />
      <main className="p-6 max-w-[1400px] space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Sent</p>
              <p className="text-2xl font-semibold mt-1">{total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Opened</p>
              <p className="text-2xl font-semibold mt-1 text-blue-600">{opened}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Replied</p>
              <p className="text-2xl font-semibold mt-1 text-emerald-600">{replied}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Reply Rate</p>
              <p className="text-2xl font-semibold mt-1">
                {total > 0 ? ((replied / total) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>By Pipeline</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(byPipeline).sort((a, b) => b[1] - a[1]).map(([ps, count]) => (
                <div key={ps} className="flex items-center justify-between">
                  <Badge variant="secondary">{ps.charAt(0).toUpperCase() + ps.slice(1)}</Badge>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(byPipeline).length === 0 && (
                <p className="text-sm text-muted-foreground">No outreach sent yet</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>By Status</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <Badge variant="secondary">{status}</Badge>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(byStatus).length === 0 && (
                <p className="text-sm text-muted-foreground">No outreach sent yet</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>By Segment</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(bySegment).sort((a, b) => b[1] - a[1]).map(([seg, count]) => (
                <div key={seg} className="flex items-center justify-between">
                  <Badge variant="secondary">{seg}</Badge>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(bySegment).length === 0 && (
                <p className="text-sm text-muted-foreground">No outreach sent yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Outreach Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Replied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(outreach ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No outreach sent yet. Run the outreach command to push leads to Instantly.
                    </TableCell>
                  </TableRow>
                )}
                {(outreach ?? []).map((o) => {
                  const biz = bizMap[o.business_id];
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/leads/${o.business_id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {biz?.name ?? `#${o.business_id}`}
                        </Link>
                        {biz?.category && (
                          <p className="text-xs text-muted-foreground">{biz.category}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{biz?.city ?? "—"}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {(o.email_sent_to ?? o.email_address) || "—"}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const ps = pipelineMap[o.business_id] ?? "lead";
                          const colors: Record<string, string> = {
                            lead: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
                            contacted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
                            replied: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
                            meeting: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
                            proposal: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
                            won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
                            lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
                          };
                          return (
                            <Badge className={colors[ps] ?? ""}>
                              {ps.charAt(0).toUpperCase() + ps.slice(1)}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {o.segment ? <Badge variant="secondary">{o.segment}</Badge> : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={o.status === "sent" ? "success" : "secondary"}>
                          {o.status || "queued"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.sent_at ? formatDate(o.sent_at) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.opened_at ? formatRelative(o.opened_at) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.replied_at ? formatRelative(o.replied_at) : "—"}
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
