"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Star } from "lucide-react";
import { cn, tierColor, segmentColor, formatDate, absoluteWebsiteUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadStatusUpdater } from "./lead-status-updater";
import { EmailOutreachPanel } from "./email-outreach-panel";
import { FavoriteButton } from "./favorite-button";
import { EditableEmail } from "./editable-email";

export interface LeadDetailViewProps {
  data: {
    lead: {
      id: number;
      name: string;
      category: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      rating: number | null;
      review_count: number | null;
      best_email?: string | null;
      owner_name?: string | null;
      triage_status?: string | null;
      http_status?: number | null;
      redirect_url?: string | null;
      score?: number | null;
      tier?: string | null;
      segment?: string | null;
      breakdown?: Record<string, unknown> | null;
      performance_score?: number | null;
      seo_score?: number | null;
      accessibility_score?: number | null;
      best_practices_score?: number | null;
      ssl_valid?: boolean | null;
      mobile_friendly?: boolean | null;
      tech_stack?: Record<string, unknown> | null;
      content_freshness?: string | null;
    } | null;
    outreach: Array<{
      status: string | null;
      email_sent_to: string | null;
      campaign_id: string | null;
      sent_at: string | null;
      source_channel: string | null;
      outreach_type: string | null;
      follow_up_count: number | null;
    }>;
    lifecycle: Array<{
      status: string;
      changed_at: string;
      notes: string | null;
    }>;
    favorited: boolean;
  };
}

function MetricBox({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  if (value == null || value === "") return null;
  const display =
    typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return (
    <div className="rounded border border-border bg-muted/30 p-2 text-center">
      <p className="text-[10px] font-medium uppercase text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-xs font-medium">{display}</p>
    </div>
  );
}

function AuditPdfButton({ businessId }: { businessId: number }) {
  const url = `/api/audit-pdf/${businessId}`;

  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <FileText className="size-3.5" />
      View Audit PDF
    </Link>
  );
}

export function LeadDetailView({ data }: LeadDetailViewProps) {
  const router = useRouter();
  const { lead, outreach, lifecycle, favorited } = data;
  if (!lead) return null;

  const currentStatus =
    lifecycle.length > 0 ? lifecycle[0].status : "lead";
  const hasAudit =
    lead.performance_score != null ||
    lead.seo_score != null ||
    lead.ssl_valid != null ||
    lead.mobile_friendly != null ||
    lead.tech_stack != null ||
    lead.content_freshness != null;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
      >
        <ArrowLeft className="size-4" />
        Back to Leads
      </Button>

    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left 2/3 */}
      <div className="space-y-6 lg:col-span-2">
        {/* Business info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FavoriteButton
                businessId={lead.id}
                isFavorited={favorited}
                size="md"
              />
              <div>
                <CardTitle className="text-xl font-semibold">{lead.name}</CardTitle>
                <CardDescription>{lead.category ?? "—"}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {lead.address && <p>{lead.address}</p>}
            {lead.city && (
              <p className="text-muted-foreground">
                {[lead.city, lead.state].filter(Boolean).join(", ")}
              </p>
            )}
            {lead.phone && <p>Phone: {lead.phone}</p>}
            {lead.website && (
              <p>
                Website:{" "}
                <a
                  href={absoluteWebsiteUrl(lead.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {lead.website}
                </a>
              </p>
            )}
            <EditableEmail
              businessId={lead.id}
              currentEmail={lead.best_email ?? lead.email ?? null}
            />
            {lead.rating != null && (
              <p className="flex items-center gap-1">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                {lead.rating}
                {lead.review_count != null && (
                  <span className="text-muted-foreground">
                    ({lead.review_count} reviews)
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Audit card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Audit</CardTitle>
                <CardDescription>Website audit metrics</CardDescription>
              </div>
              <AuditPdfButton businessId={lead.id} />
            </div>
          </CardHeader>
          {hasAudit && (
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                <MetricBox label="Performance" value={lead.performance_score} />
                <MetricBox label="SEO" value={lead.seo_score} />
                <MetricBox label="SSL Valid" value={lead.ssl_valid} />
                <MetricBox label="Mobile" value={lead.mobile_friendly} />
                <MetricBox
                  label="Tech Stack"
                  value={
                    lead.tech_stack
                      ? Object.keys(lead.tech_stack).join(", ") || null
                      : null
                  }
                />
                <MetricBox
                  label="Content Freshness"
                  value={lead.content_freshness}
                />
              </div>
            </CardContent>
          )}
          {!hasAudit && (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No audit data yet. A PDF report may still be available.
              </p>
            </CardContent>
          )}
        </Card>

        {/* Email outreach panel */}
        <EmailOutreachPanel lead={lead} outreach={outreach} />

        {/* Outreach history */}
        <Card>
          <CardHeader>
            <CardTitle>Outreach History</CardTitle>
            <CardDescription>Sent emails and campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {outreach.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outreach yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outreach.map((o, idx) => (
                    <TableRow key={`${o.sent_at}-${o.email_sent_to}-${idx}`}>
                      <TableCell>{o.status ?? "—"}</TableCell>
                      <TableCell className="max-w-[160px] truncate">
                        {o.email_sent_to ?? "—"}
                      </TableCell>
                      <TableCell>{o.source_channel ?? "—"}</TableCell>
                      <TableCell>
                        {o.follow_up_count === 0
                          ? "Initial"
                          : o.follow_up_count != null
                            ? `Follow-up #${o.follow_up_count}`
                            : o.campaign_id ?? "—"}
                      </TableCell>
                      <TableCell>
                        {o.sent_at ? formatDate(o.sent_at) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right 1/3 */}
      <div className="space-y-6">
        {/* Score card */}
        <Card>
          <CardHeader>
            <CardTitle>Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{lead.score ?? "—"}</span>
              {lead.tier && (
                <Badge className={cn(tierColor(lead.tier))}>{lead.tier}</Badge>
              )}
              {lead.segment && (
                <Badge className={cn(segmentColor(lead.segment))}>
                  {lead.segment}
                </Badge>
              )}
            </div>
            {lead.breakdown &&
              typeof lead.breakdown === "object" &&
              Object.keys(lead.breakdown).length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-1">
                  {Object.entries(lead.breakdown).map(([k, v]) => (
                    <li key={k}>
                      {k}: {String(v)}
                    </li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>

        {/* Triage card */}
        <Card>
          <CardHeader>
            <CardTitle>Triage</CardTitle>
            <CardDescription>Website triage result</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Status:</span>{" "}
              {lead.triage_status ?? "—"}
            </p>
            {lead.http_status != null && (
              <p>
                <span className="text-muted-foreground">HTTP:</span>{" "}
                {lead.http_status}
              </p>
            )}
            {lead.redirect_url && (
              <p>
                <span className="text-muted-foreground">Redirect:</span>{" "}
                <span className="truncate block max-w-[200px]">
                  {lead.redirect_url}
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Lifecycle card */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Lifecycle</CardTitle>
            <CardDescription>Status history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LeadStatusUpdater
              businessId={lead.id}
              currentStatus={currentStatus}
            />
            {lifecycle.length > 0 && (
              <div className="mt-4 space-y-3 border-l-2 border-border pl-4">
                {lifecycle.map((entry, i) => (
                  <div key={i} className="relative -ml-[21px]">
                    <span className="absolute left-0 size-2 -translate-x-1/2 rounded-full bg-primary" />
                    <p className="text-xs font-medium">{entry.status}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(entry.changed_at)}
                    </p>
                    {entry.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}
