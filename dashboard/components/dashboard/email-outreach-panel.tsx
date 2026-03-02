"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Lock, Mail, Send, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sendOutreachEmail } from "@/lib/actions";
import { getSenderAccounts, type SenderAccount } from "@/lib/email-accounts";
import {
  getTemplateForStep,
  fillTemplate,
  buildIssuesFound,
  SEQUENCE_LABELS,
  type EmailTemplate,
} from "@/lib/email-templates";

interface OutreachEntry {
  outreach_type: string | null;
  source_channel: string | null;
  follow_up_count: number | null;
  status: string | null;
  email_sent_to: string | null;
  sent_at: string | null;
}

interface LeadData {
  id: number;
  name: string;
  category: string | null;
  city: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  best_email?: string | null;
  email: string | null;
  owner_name?: string | null;
  triage_status?: string | null;
  performance_score?: number | null;
  seo_score?: number | null;
  ssl_valid?: boolean | null;
  mobile_friendly?: boolean | null;
}

interface EmailOutreachPanelProps {
  lead: LeadData;
  outreach: OutreachEntry[];
}

function formatSentDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getFirstName(ownerName: string | null | undefined): string {
  if (!ownerName) return "there";
  return ownerName.split(" ")[0];
}

export function EmailOutreachPanel({ lead, outreach }: EmailOutreachPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [senderAccounts, setSenderAccounts] = useState<SenderAccount[]>([]);
  const [selectedSender, setSelectedSender] = useState("");

  useEffect(() => {
    getSenderAccounts().then((accounts) => {
      setSenderAccounts(accounts);
      if (accounts.length > 0) setSelectedSender(accounts[0].email);
    });
  }, []);

  const recipientEmail = lead.best_email || lead.email;

  const sentSteps = new Set<number>();
  const sentDates: Record<number, string | null> = {};
  for (const o of outreach) {
    if (
      o.outreach_type === "email" &&
      o.status === "sent" &&
      o.follow_up_count != null
    ) {
      sentSteps.add(o.follow_up_count);
      if (!sentDates[o.follow_up_count]) {
        sentDates[o.follow_up_count] = o.sent_at;
      }
    }
  }

  const nextStepIndex = [0, 1, 2, 3, 4].find((i) => !sentSteps.has(i)) ?? null;
  const allSent = nextStepIndex === null;

  const templateVars = {
    company_name: lead.name,
    first_name: getFirstName(lead.owner_name),
    review_count: String(lead.review_count ?? "N/A"),
    rating: String(lead.rating ?? "N/A"),
    category: lead.category ?? "business",
    city: lead.city ?? "your area",
    website: lead.website ?? "",
    issues_found: buildIssuesFound(lead),
  };

  function getFilledTemplate(stepIndex: number): EmailTemplate {
    const raw = getTemplateForStep(lead.triage_status ?? null, stepIndex);
    return fillTemplate(raw, templateVars);
  }

  function handleExpand(stepIndex: number) {
    if (expandedStep === stepIndex) {
      setExpandedStep(null);
      setEditing(false);
      return;
    }
    setExpandedStep(stepIndex);
    setEditing(false);
    setSendError(null);
    setSendSuccess(null);
    const filled = getFilledTemplate(stepIndex);
    setEditSubject(filled.subject);
    setEditBody(filled.body);
  }

  function handleEdit() {
    if (!editing && expandedStep != null) {
      const filled = getFilledTemplate(expandedStep);
      setEditSubject(filled.subject);
      setEditBody(filled.body);
    }
    setEditing(!editing);
  }

  function handleSend(stepIndex: number) {
    if (!recipientEmail) {
      setSendError("No email address available for this lead.");
      return;
    }

    setSendError(null);
    setSendSuccess(null);

    const subject = editing ? editSubject : getFilledTemplate(stepIndex).subject;
    const body = editing ? editBody : getFilledTemplate(stepIndex).body;

    startTransition(async () => {
      const result = await sendOutreachEmail({
        businessId: lead.id,
        to: recipientEmail,
        subject,
        body,
        followUpCount: stepIndex,
        senderEmail: selectedSender || undefined,
      });

      if (result.ok) {
        setSendSuccess(`${SEQUENCE_LABELS[stepIndex]} sent successfully!`);
        setExpandedStep(null);
        setEditing(false);
        router.refresh();
      } else {
        setSendError(result.error ?? "Failed to send email.");
      }
    });
  }

  const triageLabel =
    lead.triage_status?.replace(/_/g, " ") ?? "UNKNOWN";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-5" />
              Email Outreach
            </CardTitle>
            <CardDescription>
              Sequence:{" "}
              <Badge variant="outline" className="ml-1 text-[10px]">
                {triageLabel}
              </Badge>
            </CardDescription>
          </div>
          {allSent && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
              Sequence Complete
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!recipientEmail && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            No email address found for this lead. Enrich the lead first to
            unlock email outreach.
          </div>
        )}

        {recipientEmail && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">To: </span>
            <span className="font-medium">{recipientEmail}</span>
          </div>
        )}

        {senderAccounts.length > 1 && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm flex items-center gap-2">
            <span className="text-muted-foreground shrink-0">From:</span>
            <select
              value={selectedSender}
              onChange={(e) => setSelectedSender(e.target.value)}
              className="flex-1 bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
            >
              {senderAccounts.map((a) => (
                <option key={a.email} value={a.email}>
                  {a.displayName} &lt;{a.email}&gt;
                </option>
              ))}
            </select>
          </div>
        )}

        {sendSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            {sendSuccess}
          </div>
        )}

        {sendError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {sendError}
          </div>
        )}

        <div className="space-y-1">
          {SEQUENCE_LABELS.map((label, i) => {
            const isSent = sentSteps.has(i);
            const isNext = i === nextStepIndex && !!recipientEmail;
            const isLocked = !isSent && !isNext;
            const isExpanded = expandedStep === i;

            return (
              <div key={i} className="rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (isSent || isNext) handleExpand(i);
                  }}
                  disabled={isLocked}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                    isLocked
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-muted/50 cursor-pointer"
                  } ${isExpanded ? "bg-muted/40" : ""}`}
                >
                  {isSent && (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="size-3" />
                    </span>
                  )}
                  {isNext && !isSent && (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50 dark:bg-blue-950">
                      <Circle className="size-2 fill-blue-500 text-blue-500" />
                    </span>
                  )}
                  {isLocked && (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border">
                      <Lock className="size-2.5 text-muted-foreground" />
                    </span>
                  )}

                  <span className="flex-1 font-medium">
                    {label}
                  </span>

                  {isSent && sentDates[i] && (
                    <span className="text-xs text-muted-foreground">
                      {formatSentDate(sentDates[i])}
                    </span>
                  )}

                  {isNext && !isSent && (
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px]">
                      Ready
                    </Badge>
                  )}

                  {(isSent || isNext) && (
                    isExpanded ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border bg-background p-4 space-y-3">
                    {editing ? (
                      <>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Subject
                          </label>
                          <input
                            type="text"
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Body
                          </label>
                          <textarea
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            rows={12}
                            className="w-full rounded-lg border border-input bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Subject
                          </p>
                          <p className="text-sm font-medium">
                            {getFilledTemplate(i).subject}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Body
                          </p>
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                            {getFilledTemplate(i).body}
                          </pre>
                        </div>
                      </>
                    )}

                    {isNext && !isSent && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleEdit}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
                        >
                          <Pencil className="size-3" />
                          {editing ? "Preview" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSend(i)}
                          disabled={isPending}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Send className="size-3" />
                          {isPending
                            ? "Sending..."
                            : `Send ${label}`}
                        </button>
                      </div>
                    )}

                    {isSent && (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <Check className="size-3.5" />
                        Sent {sentDates[i] ? formatSentDate(sentDates[i]) : ""}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
