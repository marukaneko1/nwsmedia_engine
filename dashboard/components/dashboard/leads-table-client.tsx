"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { LeadWithDetails } from "@/types/database";
import { cn, tierColor, segmentColor } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";
import { FavoriteButton } from "./favorite-button";

const TIERS = ["HOT", "WARM", "COOL", "COLD"] as const;
const SEGMENTS = ["ESTABLISHED", "NEW_SMALL"] as const;
const TRIAGES = ["HAS_WEBSITE", "NO_WEBSITE", "DEAD_WEBSITE", "FREE_SUBDOMAIN", "PAGE_BUILDER"] as const;
const PAGE_SIZE = 100;

interface LeadsTableProps {
  sourceChannel?: string;
}

export function LeadsTableClient({ sourceChannel }: LeadsTableProps = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [leads, setLeads] = useState<LeadWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [page, setPage] = useState(() => Math.max(1, parseInt(searchParams.get("page") ?? "1", 10)));
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [cityFilter, setCityFilter] = useState(searchParams.get("city") ?? "all");
  const [tierFilter, setTierFilter] = useState(searchParams.get("tier") ?? "all");
  const [segmentFilter, setSegmentFilter] = useState(searchParams.get("segment") ?? "all");
  const [emailFilter, setEmailFilter] = useState(searchParams.get("email") ?? "all");
  const [triageFilter, setTriageFilter] = useState(searchParams.get("triage") ?? "all");

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setDataError(null);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (sourceChannel) params.set("source", sourceChannel);
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (cityFilter !== "all") params.set("city", cityFilter);
    if (tierFilter !== "all") params.set("tier", tierFilter);
    if (segmentFilter !== "all") params.set("segment", segmentFilter);
    if (emailFilter !== "all") params.set("email", emailFilter);
    if (triageFilter !== "all") params.set("triage", triageFilter);

    try {
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      if (data.error) {
        setDataError(data.error);
      } else {
        setLeads(data.leads);
        setTotal(data.total);
        setPages(data.pages);
        if (data.cities) setCities(data.cities);
      }
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, cityFilter, tierFilter, segmentFilter, emailFilter, triageFilter, sourceChannel]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (cityFilter !== "all") params.set("city", cityFilter);
    if (tierFilter !== "all") params.set("tier", tierFilter);
    if (segmentFilter !== "all") params.set("segment", segmentFilter);
    if (emailFilter !== "all") params.set("email", emailFilter);
    if (triageFilter !== "all") params.set("triage", triageFilter);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [page, debouncedSearch, cityFilter, tierFilter, segmentFilter, emailFilter, triageFilter, router, pathname]);

  const hasFilters = cityFilter !== "all" || tierFilter !== "all" || segmentFilter !== "all" || emailFilter !== "all" || triageFilter !== "all";

  const resetFilters = () => {
    setCityFilter("all");
    setTierFilter("all");
    setSegmentFilter("all");
    setEmailFilter("all");
    setTriageFilter("all");
    setPage(1);
  };

  const setFilter = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Input
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          <select value={cityFilter} onChange={setFilter(setCityFilter)} className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm">
            <option value="all">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={tierFilter} onChange={setFilter(setTierFilter)} className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm">
            <option value="all">All tiers</option>
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={segmentFilter} onChange={setFilter(setSegmentFilter)} className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm">
            <option value="all">All segments</option>
            {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={emailFilter} onChange={setFilter(setEmailFilter)} className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm">
            <option value="all">Email: All</option>
            <option value="yes">Has email</option>
            <option value="no">No email</option>
          </select>
          <select value={triageFilter} onChange={setFilter(setTriageFilter)} className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm">
            <option value="all">All triage</option>
            {TRIAGES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-accent"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading && leads.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">Loading leads...</div>
      ) : dataError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {dataError}
        </div>
      ) : (
        <>
          <div className={cn("rounded-lg border border-border", loading && "opacity-60 pointer-events-none")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Category</TableHead>
                  {sourceChannel && <TableHead>Listing</TableHead>}
                  <TableHead>Score</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Triage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={sourceChannel ? 10 : 9} className="py-8 text-center text-muted-foreground">
                      No leads match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="w-10">
                        <FavoriteButton businessId={lead.id} isFavorited={lead.favorited ?? false} />
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                          {lead.name}
                        </Link>
                      </TableCell>
                      <TableCell>{lead.city ?? "—"}</TableCell>
                      <TableCell>{lead.category ?? "—"}</TableCell>
                      {sourceChannel && (
                        <TableCell>
                          {lead.source_url ? (
                            <a
                              href={lead.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              View <ExternalLink className="size-3.5" />
                            </a>
                          ) : "—"}
                        </TableCell>
                      )}
                      <TableCell>{lead.score ?? "—"}</TableCell>
                      <TableCell>
                        {lead.tier ? <Badge className={cn("text-xs", tierColor(lead.tier))}>{lead.tier}</Badge> : "—"}
                      </TableCell>
                      <TableCell>
                        {lead.segment ? <Badge className={cn("text-xs", segmentColor(lead.segment))}>{lead.segment}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate">
                        {lead.best_email ? <span title={lead.best_email}>{lead.best_email}</span> : "—"}
                      </TableCell>
                      <TableCell>{lead.triage_status ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total > 0 ? `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()} leads` : "0 leads"}
            </p>
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-3 text-sm tabular-nums text-muted-foreground">
                  Page {page} of {pages}
                </span>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
