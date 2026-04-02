"use client";

import { useState, useCallback, useEffect } from "react";
import { Download, Copy, Check, FileSpreadsheet, Filter, Calendar } from "lucide-react";

const BASELINE_KEY = "nwsmedia_export_max_id";
const CRAIGSLIST_BASELINE_KEY = "nwsmedia_export_craigslist_max_id";

function getStoredMaxId(source?: "craigslist" | null): number {
  if (typeof window === "undefined") return 0;
  const key = source === "craigslist" ? CRAIGSLIST_BASELINE_KEY : BASELINE_KEY;
  const v = localStorage.getItem(key);
  return v ? Number(v) : 0;
}

function setStoredMaxId(maxId: number, source?: "craigslist" | null): void {
  if (typeof window === "undefined") return;
  const key = source === "craigslist" ? CRAIGSLIST_BASELINE_KEY : BASELINE_KEY;
  localStorage.setItem(key, String(maxId));
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
  { key: "source_channel", label: "Source" },
  { key: "source_url", label: "Source URL" },
  { key: "scraped_at", label: "Scraped Date" },
] as const;

type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];
type FilterTier = "" | "HOT" | "WARM" | "COOL" | "COLD";
type FilterEmail = "" | "yes" | "no";
type ExportScope = "all" | "new";

interface ExportPanelLoaderProps {
  source?: "craigslist" | null;
}

export function ExportPanelLoader({ source = null }: ExportPanelLoaderProps) {
  const [selectedCols, setSelectedCols] = useState<Set<ColumnKey>>(
    new Set(ALL_COLUMNS.map((c) => c.key)),
  );
  const [tierFilter, setTierFilter] = useState<FilterTier>("");
  const [emailFilter, setEmailFilter] = useState<FilterEmail>("");
  const [exportScope, setExportScope] = useState<ExportScope>("all");
  const [maxExportedId, setMaxExportedId] = useState(0);
  const [baselineSet, setBaselineSet] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);

  const [totalLeads, setTotalLeads] = useState<number | null>(null);
  const [filteredCount, setFilteredCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(true);

  useEffect(() => {
    setMaxExportedId(getStoredMaxId(source));
  }, [source]);

  const fetchCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const params = new URLSearchParams({ count: "1" });
      if (tierFilter) params.set("tier", tierFilter);
      if (emailFilter === "yes") params.set("email", "yes");
      if (exportScope === "new" && maxExportedId > 0) params.set("minId", String(maxExportedId));
      if (source === "craigslist") params.set("source", "craigslist");

      const allParams = new URLSearchParams({ count: "1" });
      if (source === "craigslist") allParams.set("source", "craigslist");

      const [filteredRes, totalRes] = await Promise.all([
        fetch(`/api/leads/export?${params}`).then((r) => r.json()),
        fetch(`/api/leads/export?${allParams}`).then((r) => r.json()),
      ]);

      setFilteredCount(filteredRes.count ?? 0);
      setTotalLeads(totalRes.count ?? 0);
    } catch {
      setFilteredCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [tierFilter, emailFilter, exportScope, maxExportedId, source]);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  const buildExportUrl = useCallback((format: "csv" | "tsv") => {
    const params = new URLSearchParams({ format });
    params.set("columns", [...selectedCols].join(","));
    if (tierFilter) params.set("tier", tierFilter);
    if (emailFilter === "yes") params.set("email", "yes");
    if (exportScope === "new" && maxExportedId > 0) params.set("minId", String(maxExportedId));
    if (source === "craigslist") params.set("source", "craigslist");
    return `/api/leads/export?${params}`;
  }, [selectedCols, tierFilter, emailFilter, exportScope, maxExportedId, source]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const url = buildExportUrl("csv");
      const a = document.createElement("a");
      a.href = url;
      a.download =
        source === "craigslist"
          ? `craigslist_leads_export_${new Date().toISOString().slice(0, 10)}.csv`
          : `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } finally {
      setDownloading(false);
    }
  }, [buildExportUrl, source]);

  const handleCopy = useCallback(async () => {
    setCopying(true);
    try {
      const url = buildExportUrl("tsv");
      const res = await fetch(url);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } finally {
      setCopying(false);
    }
  }, [buildExportUrl]);

  const markCurrentAsExported = useCallback(async () => {
    try {
      if (source === "craigslist") {
        const params = new URLSearchParams({ count: "1", source: "craigslist" });
        if (tierFilter) params.set("tier", tierFilter);
        if (emailFilter === "yes") params.set("email", "yes");
        const res = await fetch(`/api/leads/export?${params}`);
        const data = await res.json();
        const finalId = data.maxId ?? 0;
        if (finalId > 0) {
          setStoredMaxId(finalId, source);
          setMaxExportedId(finalId);
        }
      } else {
        const res = await fetch("/api/leads?page=1&pageSize=1");
        const data = await res.json();
        const finalId = data.maxId ?? 0;
        if (finalId > 0) {
          setStoredMaxId(finalId, source);
          setMaxExportedId(finalId);
        }
      }
    } catch {
      /* ignore */
    }
    setExportScope("new");
    setBaselineSet(true);
    setTimeout(() => setBaselineSet(false), 3000);
  }, [source, tierFilter, emailFilter]);

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

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Leads</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {totalLeads != null ? totalLeads.toLocaleString() : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">After Filters</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {loadingCount ? "…" : filteredCount != null ? filteredCount.toLocaleString() : "—"}
          </p>
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Export scope</label>
              <select
                value={exportScope}
                onChange={(e) => setExportScope(e.target.value as ExportScope)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="all">All leads</option>
                <option value="new">New since last export</option>
              </select>
              {exportScope === "new" && (
                <div className="mt-2 space-y-2">
                  {maxExportedId <= 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Click &quot;Mark all current as exported&quot; to set the baseline.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Last exported up to lead #{maxExportedId.toLocaleString()}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={markCurrentAsExported}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    <Calendar className="size-3.5" />
                    {baselineSet ? "Done! Baseline updated" : "Mark all current as exported"}
                  </button>
                </div>
              )}
            </div>
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
              <button type="button" onClick={selectAll} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">All</button>
              <button type="button" onClick={selectEssentials} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">Essentials</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_COLUMNS.map((col) => (
              <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent">
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
          disabled={downloading || filteredCount === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="size-4" />
          {downloading ? "Preparing…" : "Download CSV"}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          disabled={copying || filteredCount === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
          {copying ? "Copying…" : copied ? "Copied!" : "Copy for Google Sheets"}
        </button>
        {filteredCount != null && filteredCount > 5000 && (
          <p className="self-center text-xs text-muted-foreground">
            {filteredCount.toLocaleString()} rows — copy may take a moment
          </p>
        )}
      </div>
    </div>
  );
}
