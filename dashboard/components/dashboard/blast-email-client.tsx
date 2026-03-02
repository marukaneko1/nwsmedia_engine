"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { cn, tierColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { sendBlastEmails, type BlastResult } from "@/lib/blast-email-action";
import { getSenderAccounts, type SenderAccount } from "@/lib/email-accounts";

interface BlastLead {
  id: number;
  name: string;
  category: string | null;
  city: string | null;
  email: string;
  rating: number | null;
  review_count: number | null;
  triage_status: string | null;
  score: number | null;
  tier: string | null;
  pipeline_status: string | null;
  outreach_count: number;
  favorited: boolean;
}

type FilterPreset = "all" | "not_contacted" | "contacted" | "favorites";

export function BlastEmailClient({ leads }: { leads: BlastLead[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<FilterPreset>("not_contacted");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<BlastResult[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [senderAccounts, setSenderAccounts] = useState<SenderAccount[]>([]);
  const [selectedSender, setSelectedSender] = useState("");

  useEffect(() => {
    getSenderAccounts().then((accounts) => {
      setSenderAccounts(accounts);
      if (accounts.length > 0) setSelectedSender(accounts[0].email);
    });
  }, []);

  const filtered = useMemo(() => {
    let list = [...leads];

    if (preset === "not_contacted") {
      list = list.filter((l) => !l.pipeline_status || l.pipeline_status === "lead");
    } else if (preset === "contacted") {
      list = list.filter((l) => l.pipeline_status && l.pipeline_status !== "lead");
    } else if (preset === "favorites") {
      list = list.filter((l) => l.favorited);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.city && l.city.toLowerCase().includes(q)) ||
          (l.category && l.category.toLowerCase().includes(q)) ||
          l.email.toLowerCase().includes(q)
      );
    }

    return list;
  }, [leads, preset, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selected);
      for (const l of filtered) next.delete(l.id);
      setSelected(next);
    } else {
      const next = new Set(selected);
      for (const l of filtered) next.add(l.id);
      setSelected(next);
    }
  };

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleSend = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;

    setSending(true);
    setResults(null);
    setProgress(`Sending to ${ids.length} leads...`);

    try {
      const res = await sendBlastEmails(ids, selectedSender || undefined);
      setResults(res);
      const ok = res.filter((r) => r.ok).length;
      const fail = res.filter((r) => !r.ok).length;
      setProgress(`Done! ${ok} sent${fail > 0 ? `, ${fail} failed` : ""}`);
      setSelected(new Set());
    } catch {
      setProgress("Blast failed — check server logs");
    } finally {
      setSending(false);
    }
  };

  const pipelineLabel = (status: string | null) => {
    if (!status || status === "lead") return null;
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const countNotContacted = leads.filter((l) => !l.pipeline_status || l.pipeline_status === "lead").length;
  const countContacted = leads.filter((l) => l.pipeline_status && l.pipeline_status !== "lead").length;
  const countFavorites = leads.filter((l) => l.favorited).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Total with Email</p>
            <p className="text-2xl font-semibold mt-1">{leads.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Not Contacted</p>
            <p className="text-2xl font-semibold mt-1 text-blue-600">{countNotContacted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Already Contacted</p>
            <p className="text-2xl font-semibold mt-1 text-emerald-600">{countContacted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Selected</p>
            <p className="text-2xl font-semibold mt-1 text-primary">{selected.size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + send bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-[220px]"
          />
          {(
            [
              ["not_contacted", `Not Contacted (${countNotContacted})`],
              ["all", `All (${leads.length})`],
              ["contacted", `Contacted (${countContacted})`],
              ["favorites", `Favorites (${countFavorites})`],
            ] as [FilterPreset, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={cn(
                "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                preset === key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {progress && (
            <p className={cn(
              "text-sm font-medium",
              results && results.some((r) => !r.ok) ? "text-amber-600" : "text-emerald-600"
            )}>
              {progress}
            </p>
          )}
          {senderAccounts.length > 1 && (
            <select
              value={selectedSender}
              onChange={(e) => setSelectedSender(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {senderAccounts.map((a) => (
                <option key={a.email} value={a.email}>
                  {a.displayName} &lt;{a.email}&gt;
                </option>
              ))}
            </select>
          )}
          <Button
            onClick={handleSend}
            disabled={selected.size === 0 || sending}
            size="sm"
            className="gap-2"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            {sending
              ? "Sending..."
              : `Send to ${selected.size} lead${selected.size !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </div>

      {/* Results */}
      {results && results.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-sm font-medium mb-2">Blast Results</p>
            {results.map((r) => (
              <div
                key={r.businessId}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  r.ok ? "text-emerald-700" : "text-red-600"
                )}
              >
                {r.ok ? (
                  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">{r.email}</span>
                {r.error && <span className="text-red-500">— {r.error}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  className="size-4 rounded border-border"
                />
              </TableHead>
              <TableHead>Business</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Emails Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No leads match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lead) => (
                <TableRow
                  key={lead.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selected.has(lead.id) && "bg-primary/5"
                  )}
                  onClick={() => toggle(lead.id)}
                >
                  <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggle(lead.id)}
                      className="size-4 rounded border-border"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {lead.favorited && (
                        <svg className="size-3.5 shrink-0 fill-amber-400 text-amber-400" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      )}
                      <Link
                        href={`/dashboard/leads/${lead.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-primary hover:underline"
                      >
                        {lead.name}
                      </Link>
                      {lead.pipeline_status && lead.pipeline_status !== "lead" && (
                        <svg className="size-3.5 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
                        </svg>
                      )}
                    </div>
                    {lead.category && (
                      <p className="text-xs text-muted-foreground">{lead.category}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{lead.city ?? "—"}</TableCell>
                  <TableCell className="text-sm font-mono max-w-[180px] truncate">
                    {lead.email}
                  </TableCell>
                  <TableCell className="text-sm">{lead.score ?? "—"}</TableCell>
                  <TableCell>
                    {lead.tier ? (
                      <Badge className={cn("text-xs", tierColor(lead.tier))}>
                        {lead.tier}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const ps = pipelineLabel(lead.pipeline_status);
                      if (!ps) return <span className="text-xs text-muted-foreground">New</span>;
                      return (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 text-xs">
                          {ps}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-sm text-center">
                    {lead.outreach_count > 0 ? (
                      <span className="font-medium">{lead.outreach_count}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} leads · {selected.size} selected
      </p>
    </div>
  );
}
