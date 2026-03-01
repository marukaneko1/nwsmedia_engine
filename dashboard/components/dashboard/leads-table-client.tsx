"use client";

import { useState, useMemo } from "react";
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
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<SortKey | null>(null);

  const handleSort = (key: SortKey) => {
    setSortColumn((prev) => (prev === key ? null : key));
  };

  const filtered = useMemo(() => {
    let result = [...initialLeads];

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
  }, [initialLeads, search, cityFilter, tierFilter, segmentFilter, sortColumn, pdfIdSet]);

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
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  No leads match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {lead.name}
                    </Link>
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
