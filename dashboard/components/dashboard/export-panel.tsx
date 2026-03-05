"use client";

import { useState } from "react";
import { Download, Copy, Check, FileSpreadsheet, Filter } from "lucide-react";
import type { LeadWithDetails } from "@/types/database";

interface ExportPanelProps {
  leads: LeadWithDetails[];
  total: number;
}

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
  { key: "scraped_at", label: "Scraped Date" },
] as const;

type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

function escapeCsvField(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(leads: LeadWithDetails[], columns: ColumnKey[]): string {
  const colDefs = ALL_COLUMNS.filter((c) => columns.includes(c.key));
  const header = colDefs.map((c) => escapeCsvField(c.label)).join(",");

  const rows = leads.map((lead) =>
    colDefs
      .map((col) => {
        let value = lead[col.key as keyof LeadWithDetails];
        if (col.key === "scraped_at" && value) {
          value = new Date(value as string).toLocaleDateString();
        }
        return escapeCsvField(value as string | number | null);
      })
      .join(","),
  );

  return [header, ...rows].join("\n");
}

type FilterTier = "" | "HOT" | "WARM" | "COOL" | "COLD";
type FilterEmail = "" | "yes" | "no";

export function ExportPanel({ leads, total }: ExportPanelProps) {
  const [selectedCols, setSelectedCols] = useState<Set<ColumnKey>>(
    new Set(ALL_COLUMNS.map((c) => c.key)),
  );
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [tierFilter, setTierFilter] = useState<FilterTier>("");
  const [emailFilter, setEmailFilter] = useState<FilterEmail>("");

  const filteredLeads = leads.filter((l) => {
    if (tierFilter && l.tier !== tierFilter) return false;
    if (emailFilter === "yes" && !l.best_email) return false;
    if (emailFilter === "no" && l.best_email) return false;
    return true;
  });

  const toggleCol = (key: ColumnKey) => {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedCols(new Set(ALL_COLUMNS.map((c) => c.key)));
  const selectEssentials = () =>
    setSelectedCols(
      new Set<ColumnKey>(["name", "category", "city", "phone", "website", "best_email", "owner_name", "score", "tier"]),
    );

  const csv = buildCsv(filteredLeads, [...selectedCols]);

  const handleDownload = () => {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleCopy = async () => {
    const tsvRows = csv.split("\n").map((row) => {
      const fields: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (inQuotes) {
          if (ch === '"' && row[i + 1] === '"') {
            current += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            current += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          fields.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
      fields.push(current);
      return fields.join("\t");
    });
    await navigator.clipboard.writeText(tsvRows.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Leads</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{total.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">After Filters</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{filteredLeads.length.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Columns Selected</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {selectedCols.size} / {ALL_COLUMNS.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Filters */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Filters</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tier</label>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as FilterTier)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">All tiers</option>
                <option value="HOT">HOT</option>
                <option value="WARM">WARM</option>
                <option value="COOL">COOL</option>
                <option value="COLD">COLD</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Has Email</label>
              <select
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value as FilterEmail)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">All</option>
                <option value="yes">With email only</option>
                <option value="no">Without email only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Column picker */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Columns</h2>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
              >
                All
              </button>
              <button
                type="button"
                onClick={selectEssentials}
                className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
              >
                Essentials
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ALL_COLUMNS.map((col) => (
              <label
                key={col.key}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selectedCols.has(col.key)}
                  onChange={() => toggleCol(col.key)}
                  className="size-3.5 rounded border-border accent-primary"
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {downloaded ? <Check className="size-4" /> : <Download className="size-4" />}
          {downloaded ? "Downloaded!" : "Download CSV"}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
          {copied ? "Copied!" : "Copy for Google Sheets"}
        </button>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            Preview <span className="font-normal text-muted-foreground">(first 5 rows)</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                {ALL_COLUMNS.filter((c) => selectedCols.has(c.key)).map((col) => (
                  <th
                    key={col.key}
                    className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-muted-foreground"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeads.slice(0, 5).map((lead) => (
                <tr key={lead.id} className="border-b border-border last:border-0">
                  {ALL_COLUMNS.filter((c) => selectedCols.has(c.key)).map((col) => {
                    let value = lead[col.key as keyof LeadWithDetails];
                    if (col.key === "scraped_at" && value) {
                      value = new Date(value as string).toLocaleDateString();
                    }
                    return (
                      <td
                        key={col.key}
                        className="max-w-[200px] truncate whitespace-nowrap px-4 py-2 text-foreground"
                      >
                        {value != null ? String(value) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td
                    colSpan={selectedCols.size}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No leads match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
