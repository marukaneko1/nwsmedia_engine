"use client";

import { useState, useMemo, useTransition, useRef, type DragEvent } from "react";
import Link from "next/link";
import type { LeadWithDetails } from "@/types/database";
import { updateLeadStatus } from "@/lib/lifecycle-actions";
import { cn, tierColor, segmentColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "./favorite-button";

const COLUMNS: { key: string; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
  { key: "meeting", label: "Meeting" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

const TIERS = ["HOT", "WARM", "COOL", "COLD"] as const;
const SEGMENTS = ["ESTABLISHED", "NEW_SMALL"] as const;

interface Filters {
  search: string;
  tier: string;
  segment: string;
  category: string;
  favoritesOnly: boolean;
}

const emptyFilters: Filters = { search: "", tier: "", segment: "", category: "", favoritesOnly: false };

interface PipelineBoardProps {
  initialData: Record<string, LeadWithDetails[]>;
}

interface DragPayload {
  businessId: number;
  fromStatus: string;
}

function LeadCard({
  lead,
  columnKey,
  onMove,
  isMoving,
  onDragStart,
}: {
  lead: LeadWithDetails;
  columnKey: string;
  onMove: (status: string) => void;
  isMoving: boolean;
  onDragStart: (e: DragEvent, payload: DragPayload) => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const hasEmail = !!lead.best_email && lead.best_email.trim() !== "";

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    onDragStart(e, { businessId: lead.id, fromStatus: columnKey });
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable={!isMoving}
      onDragStart={handleDragStart}
      className={cn(
        "group relative rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing",
        isMoving && "opacity-60 pointer-events-none"
      )}
      onClick={() => setShowDropdown((p) => !p)}
    >
      <div className="flex items-start justify-between gap-2">
        <FavoriteButton
          businessId={lead.id}
          isFavorited={lead.favorited ?? false}
          size="sm"
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[lead.city, lead.category].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <Link
          href={`/dashboard/leads/${lead.id}`}
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.stopPropagation()}
          draggable={false}
          title="View lead details"
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
        >
          <svg
            className="size-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
            />
          </svg>
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {lead.score != null && (
          <Badge
            className={cn(
              "text-[10px] px-1.5 py-0",
              lead.tier ? tierColor(lead.tier) : ""
            )}
          >
            {lead.score}
          </Badge>
        )}
        {lead.segment && (
          <Badge
            className={cn("text-[10px] px-1.5 py-0", segmentColor(lead.segment))}
          >
            {lead.segment}
          </Badge>
        )}
        <span className="ml-1 flex items-center gap-1">
          <span
            className={cn(
              "size-1.5 rounded-full",
              hasEmail ? "bg-green-500" : "bg-muted-foreground/50"
            )}
            aria-hidden
          />
        </span>
      </div>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(false);
            }}
          />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-card text-card-foreground shadow-lg overflow-hidden">
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
                  col.key === columnKey && "bg-accent/60 font-medium"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(col.key);
                  setShowDropdown(false);
                }}
              >
                {col.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function matchesFilters(lead: LeadWithDetails, filters: Filters): boolean {
  if (filters.favoritesOnly && !lead.favorited) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const haystack = [lead.name, lead.city, lead.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (filters.tier && lead.tier !== filters.tier) return false;
  if (filters.segment && lead.segment !== filters.segment) return false;
  if (filters.category && lead.category !== filters.category) return false;
  return true;
}

function FilterBar({
  filters,
  onChange,
  categories,
  totalVisible,
  totalAll,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  categories: string[];
  totalVisible: number;
  totalAll: number;
}) {
  const hasFilters = filters.search || filters.tier || filters.segment || filters.category || filters.favoritesOnly;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => onChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
          filters.favoritesOnly
            ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        <svg
          className={cn("size-3.5", filters.favoritesOnly ? "fill-amber-400 text-amber-400" : "fill-none text-current")}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
        Favorites
      </button>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search leads..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-8 w-48 rounded-md border border-border bg-card pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <select
        value={filters.tier}
        onChange={(e) => onChange({ ...filters, tier: e.target.value })}
        className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All Tiers</option>
        {TIERS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <select
        value={filters.segment}
        onChange={(e) => onChange({ ...filters, segment: e.target.value })}
        className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All Segments</option>
        {SEGMENTS.map((s) => (
          <option key={s} value={s}>
            {s.replaceAll("_", " ")}
          </option>
        ))}
      </select>

      {categories.length > 0 && (
        <select
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
          className="h-8 max-w-[200px] rounded-md border border-border bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={() => onChange(emptyFilters)}
          className="h-8 rounded-md border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          Clear filters
        </button>
      )}

      {hasFilters && (
        <span className="text-xs text-muted-foreground">
          {totalVisible} of {totalAll} leads
        </span>
      )}
    </div>
  );
}

export function PipelineBoard({ initialData }: PipelineBoardProps) {
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [pendingMoves, setPendingMoves] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragPayloadRef = useRef<DragPayload | null>(null);

  const allLeads = useMemo(
    () => Object.values(data).flat(),
    [data]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const lead of allLeads) {
      if (lead.category) set.add(lead.category);
    }
    return [...set].sort();
  }, [allLeads]);

  const filteredData = useMemo(() => {
    const hasFilters = filters.search || filters.tier || filters.segment || filters.category || filters.favoritesOnly;
    if (!hasFilters) return data;

    const result: Record<string, LeadWithDetails[]> = {};
    for (const col of COLUMNS) {
      result[col.key] = (data[col.key] ?? []).filter((l) => matchesFilters(l, filters));
    }
    return result;
  }, [data, filters]);

  const totalVisible = useMemo(
    () => Object.values(filteredData).reduce((s, arr) => s + arr.length, 0),
    [filteredData]
  );

  const handleMove = (businessId: number, fromStatus: string, toStatus: string) => {
    if (fromStatus === toStatus) return;
    setPendingMoves((prev) => new Set(prev).add(businessId));

    startTransition(async () => {
      try {
        await updateLeadStatus(businessId, toStatus);
        setData((prev) => {
          const next = { ...prev };
          const lead = next[fromStatus]?.find((l) => l.id === businessId);
          if (lead) {
            next[fromStatus] = next[fromStatus].filter((l) => l.id !== businessId);
            next[toStatus] = [...(next[toStatus] || []), { ...lead, pipeline_status: toStatus }];
          }
          return next;
        });
      } finally {
        setPendingMoves((prev) => {
          const next = new Set(prev);
          next.delete(businessId);
          return next;
        });
      }
    });
  };

  const handleDragStart = (_e: DragEvent, payload: DragPayload) => {
    dragPayloadRef.current = payload;
  };

  const handleDragOver = (e: DragEvent, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnKey);
  };

  const handleDragLeave = (e: DragEvent, columnKey: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX, clientY } = e;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      if (dragOverColumn === columnKey) setDragOverColumn(null);
    }
  };

  const handleDrop = (e: DragEvent, toStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const payload = dragPayloadRef.current;
    if (!payload) return;
    dragPayloadRef.current = null;
    handleMove(payload.businessId, payload.fromStatus, toStatus);
  };

  const handleDragEnd = () => {
    dragPayloadRef.current = null;
    setDragOverColumn(null);
  };

  return (
    <div>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        categories={categories}
        totalVisible={totalVisible}
        totalAll={allLeads.length}
      />
      <div className="overflow-x-auto pb-4" onDragEnd={handleDragEnd}>
        <div className="flex gap-4 min-w-max">
          {COLUMNS.map((col) => {
            const leads = filteredData[col.key] ?? [];
            const isOver = dragOverColumn === col.key;
            return (
              <div
                key={col.key}
                className={cn(
                  "flex min-w-[240px] flex-col gap-2 rounded-lg bg-muted/50 p-3 transition-colors duration-150",
                  isOver && "bg-primary/10 ring-2 ring-primary/40"
                )}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={(e) => handleDragLeave(e, col.key)}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {col.label}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {leads.length}
                  </Badge>
                </div>
                <div className="flex flex-col gap-2 min-h-[60px]">
                  {leads.map((lead, idx) => (
                    <LeadCard
                      key={`${lead.id}-${idx}`}
                      lead={lead}
                      columnKey={col.key}
                      onMove={(toStatus) =>
                        handleMove(lead.id, col.key, toStatus)
                      }
                      isMoving={pendingMoves.has(lead.id)}
                      onDragStart={handleDragStart}
                    />
                  ))}
                  {leads.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground/60">
                      Drop leads here
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
