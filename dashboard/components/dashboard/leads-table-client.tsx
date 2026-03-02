"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { FavoriteButton } from "./favorite-button";

const TIERS = ["HOT", "WARM", "COOL", "COLD"] as const;
const SEGMENTS = ["ESTABLISHED", "NEW_SMALL"] as const;

type SortKey =
  | "name"
  | "city"
  | "category"
  | "score"
  | "tier"
  | "segment"
  | "email"
  | "triage"
  | "auditPdf";

const VALID_SORT_KEYS: SortKey[] = [
  "name", "city", "category", "score", "tier", "segment", "email", "triage", "auditPdf",
];

interface LeadsTableClientProps {
  initialLeads: LeadWithDetails[];
  initialTotal: number;
  cities: string[];
  auditPdfIds?: number[];
}

export function LeadsTableClient({
  initialLeads,
  initialTotal,
  cities,
  auditPdfIds = [],
}: LeadsTableClientProps) {
  const pdfIdSet = useMemo(() => new Set(auditPdfIds), [auditPdfIds]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [cityFilter, setCityFilter] = useState<string>(searchParams.get("city") ?? "all");
  const [tierFilter, setTierFilter] = useState<string>(searchParams.get("tier") ?? "all");
  const [segmentFilter, setSegmentFilter] = useState<string>(searchParams.get("segment") ?? "all");
  const [favoritesOnly, setFavoritesOnly] = useState(searchParams.get("fav") === "1");
  const [sortColumn, setSortColumn] = useState<SortKey | null>(() => {
    const s = searchParams.get("sort");
    return s && VALID_SORT_KEYS.includes(s as SortKey) ? (s as SortKey) : null;
  });

  const syncParams = useCallback(
    (overrides: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v === null || v === "" || v === "all" || v === "0") {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  useEffect(() => {
    syncParams({
      q: search || null,
      city: cityFilter === "all" ? null : cityFilter,
      tier: tierFilter === "all" ? null : tierFilter,
      segment: segmentFilter === "all" ? null : segmentFilter,
      fav: favoritesOnly ? "1" : null,
      sort: sortColumn,
    });
  }, [search, cityFilter, tierFilter, segmentFilter, favoritesOnly, sortColumn, syncParams]);

  const handleSort = (key: SortKey) => {
    setSortColumn((prev) => (prev === key ? null : key));
  };

  const filtered = useMemo(() => {
    let result = [...initialLeads];

    if (favoritesOnly) {
      result = result.filter((l) => l.favorited);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (l) =>
          (l.name && l.name.toLowerCase().includes(q)) ||
          (l.city && l.city.toLowerCase().includes(q)) ||
          (l.category && l.category.toLowerCase().includes(q)) ||
          (l.best_email && l.best_email.toLowerCase().includes(q))
      );
    }
    if (cityFilter !== "all") {
      result = result.filter((l) => l.city === cityFilter);
    }
    if (tierFilter !== "all") {
      result = result.filter((l) => l.tier === tierFilter);
    }
    if (segmentFilter !== "all") {
      result = result.filter((l) => l.segment === segmentFilter);
    }

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        if (sortColumn === "email") {
          const aHas = !!a.best_email?.trim();
          const bHas = !!b.best_email?.trim();
          if (aHas && !bHas) return -1;
          if (!aHas && bHas) return 1;
          if (!aHas && !bHas) return 0;
          return (a.best_email ?? "").toLowerCase().localeCompare((b.best_email ?? "").toLowerCase());
        }
        const av =
          sortColumn === "name"
            ? (a.name ?? "").toLowerCase()
            : sortColumn === "city"
              ? (a.city ?? "").toLowerCase()
              : sortColumn === "category"
                ? (a.category ?? "").toLowerCase()
                : sortColumn === "score"
                  ? a.score ?? -Infinity
                  : sortColumn === "tier"
                    ? (a.tier ?? "").toLowerCase()
                    : sortColumn === "segment"
                      ? (a.segment ?? "").toLowerCase()
                      : sortColumn === "triage"
                        ? (a.triage_status ?? "").toLowerCase()
                        : pdfIdSet.has(a.id)
                          ? 1
                          : 0;
        const bv =
          sortColumn === "name"
            ? (b.name ?? "").toLowerCase()
            : sortColumn === "city"
              ? (b.city ?? "").toLowerCase()
              : sortColumn === "category"
                ? (b.category ?? "").toLowerCase()
                : sortColumn === "score"
                  ? b.score ?? -Infinity
                  : sortColumn === "tier"
                    ? (b.tier ?? "").toLowerCase()
                    : sortColumn === "segment"
                      ? (b.segment ?? "").toLowerCase()
                      : sortColumn === "triage"
                        ? (b.triage_status ?? "").toLowerCase()
                        : pdfIdSet.has(b.id)
                          ? 1
                          : 0;
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        return String(av).localeCompare(String(bv));
      });
    } else {
      result = result.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }

    return result;
  }, [initialLeads, search, cityFilter, tierFilter, segmentFilter, favoritesOnly, sortColumn, pdfIdSet]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Input
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFavoritesOnly((p) => !p)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
              favoritesOnly
                ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                : "border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <svg
              className={cn("size-3.5", favoritesOnly ? "fill-amber-400 text-amber-400" : "fill-none text-current")}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            Favorites
          </button>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="all">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="all">All tiers</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="all">All segments</option>
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 font-medium hover:underline focus:outline-none focus:underline"
                >
                  Name
                  {sortColumn === "name" && (
                    <span className="text-muted-foreground" aria-label="sorted ascending">
                      ↑
                    </span>
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSort("city")}
                  className="flex items-center gap-1 font-medium hover:underline focus:outline-none focus:underline"
                >
                  City
                  {sortColumn === "city" && (
                    <span className="text-muted-foreground" aria-label="sorted ascending">
                      ↑
                    </span>
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSort("category")}
                  className="flex items-center gap-1 font-medium hover:underline focus:outline-none focus:underline"
                >
                  Category
                  {sortColumn === "category" && (
                    <span className="text-muted-foreground" aria-label="sorted ascending">
                      ↑
                    </span>
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSort("score")}
                  className="flex items-center gap-1 font-medium hover:underline focus:outline-none focus:underline"
                >
                  Score
                  {sortColumn === "score" && (
                    <span className="text-muted-foreground" aria-label="sorted ascending">
                      ↑
                    </span>
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSort("tier")}
                  className="flex items-center gap-1 font-medium hover:underline focus:outline-none focus:underline"
                >
                  Tier
                  {sortColumn === "tier" && (
                    <span className="text-muted-foreground" aria-label="sorted ascending">
                      ↑
                    </span>
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSort("segment")}
                  className="flex items-center gap-1 font-medium hover:underline focus:outline-none focus:underline"
                >
                  Segment
                  {sortColumn === "segment" && (
                    <span className="text-muted-foreground" aria-label="sorted ascending">
                      ↑
                    </span>
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSort("email")}
                  className="flex items-center gap-1 font-medium hover:underline focus:outline-none focus:underline"
                >
                  Email
                  {sortColumn === "email" && (
                    <span className="text-muted-foreground" aria-label="sorted ascending">
                      ↑
                    </span>
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSort("triage")}
                  className="flex items-center gap-1 font-medium hover:underline focus:outline-none focus:underline"
                >
                  Triage
                  {sortColumn === "triage" && (
                    <span className="text-muted-foreground" aria-label="sorted ascending">
                      ↑
                    </span>
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSort("auditPdf")}
                  className="flex items-center gap-1 font-medium hover:underline focus:outline-none focus:underline"
                >
                  Audit PDF
                  {sortColumn === "auditPdf" && (
                    <span className="text-muted-foreground" aria-label="sorted ascending">
                      ↑
                    </span>
                  )}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  No leads match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="w-10">
                    <FavoriteButton
                      businessId={lead.id}
                      isFavorited={lead.favorited ?? false}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/leads/${lead.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {lead.name}
                      </Link>
                      {lead.pipeline_status && lead.pipeline_status !== "lead" && (
                        <svg
                          className="size-4 shrink-0 text-emerald-500"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-label={`Status: ${lead.pipeline_status}`}
                        >
                          <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
                        </svg>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{lead.city ?? "—"}</TableCell>
                  <TableCell>{lead.category ?? "—"}</TableCell>
                  <TableCell>{lead.score ?? "—"}</TableCell>
                  <TableCell>
                    {lead.tier ? (
                      <Badge className={cn("text-xs", tierColor(lead.tier))}>
                        {lead.tier}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.segment ? (
                      <Badge className={cn("text-xs", segmentColor(lead.segment))}>
                        {lead.segment}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate">
                    {lead.best_email ? (
                      <span title={lead.best_email}>{lead.best_email}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{lead.triage_status ?? "—"}</TableCell>
                  <TableCell>
                    {pdfIdSet.has(lead.id) ? (
                      <span className="text-xs font-medium text-green-600">Yes</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {initialTotal} leads
      </p>
    </div>
  );
}
