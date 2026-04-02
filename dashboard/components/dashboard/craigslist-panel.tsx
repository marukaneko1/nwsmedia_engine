"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Layers,
  Play,
  Square,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CraigslistOp = "scrape-craigslist" | "scrape-craigslist-batch";

interface Operation {
  id: CraigslistOp;
  label: string;
  description: string;
  icon: typeof Search;
}

const OPERATIONS: Operation[] = [
  {
    id: "scrape-craigslist",
    label: "Single City",
    description: "Scrape Craigslist services for one city + category",
    icon: Search,
  },
  {
    id: "scrape-craigslist-batch",
    label: "Batch Scrape",
    description: "Run all configured city + category + keyword combos",
    icon: Layers,
  },
];

const CL_CITIES = [
  "San Antonio, TX", "Denver, CO", "Tampa, FL", "Orlando, FL",
  "Nashville, TN", "Charlotte, NC", "Las Vegas, NV", "Jacksonville, FL",
  "Austin, TX", "Houston, TX", "Dallas, TX", "Phoenix, AZ",
  "Atlanta, GA", "Miami, FL", "Portland, OR", "Sacramento, CA",
  "Minneapolis, MN", "Detroit, MI", "Pittsburgh, PA", "Columbus, OH",
  "Kansas City, MO", "Raleigh, NC", "Richmond, VA", "Louisville, KY",
  "Indianapolis, IN", "Omaha, NE", "Birmingham, AL", "Knoxville, TN",
  "Boise, ID", "Salt Lake City, UT",
];

const CL_CATEGORIES: { code: string; label: string }[] = [
  { code: "bbb", label: "All Services" },
  { code: "hss", label: "Household Services" },
  { code: "sks", label: "Skilled Trades" },
  { code: "fgs", label: "Farm & Garden" },
  { code: "cps", label: "Computer Services" },
  { code: "crs", label: "Creative Services" },
  { code: "evs", label: "Event Services" },
  { code: "pas", label: "Pet Services" },
  { code: "rts", label: "Real Estate Services" },
  { code: "lgs", label: "Lessons & Tutoring" },
];

const CL_KEYWORDS = [
  "landscaping", "painting", "cleaning", "plumbing", "roofing",
  "electrical", "handyman", "pressure washing", "tree service",
  "junk removal", "fencing", "concrete", "HVAC",
];

const MAX_OUTPUT_LINES = 5000;

type RunStatus = "idle" | "running" | "completed" | "error";

export function CraigslistPanel() {
  const [selectedOp, setSelectedOp] = useState<CraigslistOp>("scrape-craigslist");
  const [city, setCity] = useState("Austin, TX");
  const [category, setCategory] = useState("bbb");
  const [keyword, setKeyword] = useState("");
  const [maxPages, setMaxPages] = useState(3);
  const [headless, setHeadless] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [batchLimit, setBatchLimit] = useState(20);

  const [status, setStatus] = useState<RunStatus>("idle");
  const [output, setOutput] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    if (status !== "running" || !startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status, startTime]);

  const buildArgs = useCallback((): string[] => {
    if (selectedOp === "scrape-craigslist") {
      return [
        "--city", city,
        "--category", category,
        ...(keyword.trim() ? ["--keyword", keyword.trim()] : []),
        "--max-pages", String(maxPages),
        headless ? "--headless" : "--no-headless",
      ];
    }
    return [
      "--max-pages", String(maxPages),
      "--limit", String(batchLimit),
      headless ? "--headless" : "--no-headless",
      ...(dryRun ? ["--dry-run"] : []),
    ];
  }, [selectedOp, city, category, keyword, maxPages, headless, dryRun, batchLimit]);

  const canRun = useCallback((): boolean => {
    if (status === "running") return false;
    if (selectedOp === "scrape-craigslist") return city.trim() !== "";
    return true;
  }, [status, selectedOp, city]);

  const parseProgress = useCallback((line: string) => {
    let m = line.match(/cl_detail_fetch\s+.*i=(\d+).*total=(\d+)/);
    if (m) {
      setProgress({
        current: parseInt(m[1], 10),
        total: parseInt(m[2], 10),
        label: "Extracting details",
      });
      return;
    }

    m = line.match(/cl_page_results\s+.*count=(\d+)/);
    if (m) {
      setProgress((p) => ({
        current: 0,
        total: parseInt(m![1], 10),
        label: p?.label ?? "Loading listings",
      }));
      return;
    }

    m = line.match(/Run\s+(\d+)\/(\d+):/);
    if (m) {
      setProgress({
        current: parseInt(m[1], 10),
        total: parseInt(m[2], 10),
        label: `Batch run ${m[1]}/${m[2]}`,
      });
      return;
    }

    m = line.match(/cl_businesses_saved\s+.*new=(\d+)/);
    if (m) {
      setProgress((p) => p ? { ...p, current: p.total, label: `Saved ${m![1]} new` } : p);
    }
  }, []);

  const runCommand = useCallback(async () => {
    if (!canRun()) return;

    const args = buildArgs();
    const displayCmd = `nwsmedia ${selectedOp} ${args.join(" ")}`;
    setOutput([`$ ${displayCmd}`, ""]);
    setStatus("running");
    setStartTime(Date.now());
    setElapsed(0);
    setProgress(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: selectedOp, args }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errorText = await res.text();
        let msg = errorText;
        try {
          const j = JSON.parse(errorText) as { error?: string };
          if (j?.error) msg = j.error;
        } catch { /* use raw text */ }
        setOutput((prev) => [...prev, `Error: ${msg}`]);
        setStatus("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.type === "stdout" || data.type === "stderr") {
              const text = data.text.trimEnd();
              if (text) {
                const lines = text.split("\n");
                for (const line of lines) parseProgress(line);
                setOutput((prev) => {
                  const next = [...prev, ...lines];
                  return next.length > MAX_OUTPUT_LINES ? next.slice(-MAX_OUTPUT_LINES) : next;
                });
              }
            } else if (data.type === "exit") {
              const ok = data.code === 0;
              setStatus(ok ? "completed" : "error");
              if (ok) setProgress((p) => (p ? { ...p, current: p.total } : p));
              setOutput((prev) => [
                ...prev, "",
                ok ? "✓ Process completed successfully" : `✗ Process exited with code ${data.code}`,
              ]);
            } else if (data.type === "error") {
              setStatus("error");
              setOutput((prev) => [...prev, `Error: ${data.message}`]);
            }
          } catch { /* malformed SSE event */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setOutput((prev) => [...prev, "", "⏹ Stopped by user"]);
        setStatus("idle");
        setProgress(null);
      } else {
        setOutput((prev) => [...prev, `Error: ${(err as Error).message}`]);
        setStatus("error");
      }
    }
  }, [selectedOp, buildArgs, canRun, parseProgress]);

  const stopCommand = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    try { await fetch("/api/scrape", { method: "DELETE" }); } catch { /* ignore */ }
    setStatus("idle");
  }, []);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const selectedOperation = OPERATIONS.find((op) => op.id === selectedOp)!;

  return (
    <div className="space-y-6">
      {/* Operation selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Craigslist Services Scraper</CardTitle>
          <CardDescription>
            Scrape service listings from Craigslist — landscapers, painters, handymen, and more
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {OPERATIONS.map((op) => {
              const Icon = op.icon;
              return (
                <button
                  key={op.id}
                  onClick={() => setSelectedOp(op.id)}
                  disabled={status === "running"}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                    selectedOp === op.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {op.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Progress bar */}
      {(status === "running" || status === "completed" || status === "error") && progress && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {status === "running" && <Loader2 className="size-3.5 animate-spin text-primary" />}
                  {status === "completed" && <CheckCircle2 className="size-3.5 text-success" />}
                  {status === "error" && <XCircle className="size-3.5 text-destructive" />}
                  <span className="font-medium text-foreground">{progress.label}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  {status === "running" && (
                    <span className="tabular-nums">{formatElapsed(elapsed)}</span>
                  )}
                  <span className="tabular-nums font-medium">
                    {progress.current}/{progress.total}
                  </span>
                  <span className="tabular-nums w-12 text-right">
                    {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out",
                    status === "completed" ? "bg-success" : status === "error" ? "bg-destructive" : "bg-primary"
                  )}
                  style={{
                    width: `${progress.total > 0 ? Math.min((progress.current / progress.total) * 100, 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <selectedOperation.icon className="size-4 text-primary" />
              <CardTitle className="text-base">{selectedOperation.label}</CardTitle>
            </div>
            <CardDescription>{selectedOperation.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedOp === "scrape-craigslist" ? (
              <>
                {/* City */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">City</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {CL_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CL_CATEGORIES.map((cat) => (
                      <button
                        key={cat.code}
                        type="button"
                        onClick={() => setCategory(cat.code)}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs transition-colors",
                          category === cat.code
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-accent"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keyword */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Keyword <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder='e.g. "landscaping" or "plumbing"'
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {CL_KEYWORDS.map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => setKeyword(kw)}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs transition-colors",
                          keyword === kw
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-accent"
                        )}
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Pages */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Max Pages</label>
                    <span className="text-sm tabular-nums text-muted-foreground">{maxPages}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>1</span>
                    <span>10</span>
                  </div>
                </div>

                {/* Headless */}
                <ToggleSwitch label="Headless Mode" description="Run browser without visible window" checked={headless} onChange={setHeadless} />
              </>
            ) : (
              <>
                {/* Batch config */}
                <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Runs through all 100 mapped cities with configured categories and keywords.
                    Each combo scrapes up to {maxPages * 120} listings.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Batch Limit</label>
                    <span className="text-sm tabular-nums text-muted-foreground">{batchLimit}</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={200}
                    step={5}
                    value={batchLimit}
                    onChange={(e) => setBatchLimit(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>5</span>
                    <span>200</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Max Pages per Run</label>
                    <span className="text-sm tabular-nums text-muted-foreground">{maxPages}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>1</span>
                    <span>10</span>
                  </div>
                </div>

                <ToggleSwitch label="Headless Mode" checked={headless} onChange={setHeadless} />
                <ToggleSwitch label="Dry Run" description="Preview what would run without scraping" checked={dryRun} onChange={setDryRun} />
              </>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={runCommand} disabled={!canRun()} className="gap-2">
                {status === "running" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                {status === "running" ? "Running…" : `Run ${selectedOperation.label}`}
              </Button>

              {status === "running" && (
                <Button variant="destructive" onClick={stopCommand} className="gap-2">
                  <Square className="size-3.5" />
                  Stop
                </Button>
              )}

              {status === "running" && (
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatElapsed(elapsed)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Output terminal */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Output</CardTitle>
              {status === "running" && (
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
              )}
              {status === "completed" && <CheckCircle2 className="size-4 text-success" />}
              {status === "error" && <XCircle className="size-4 text-destructive" />}
            </div>
            {output.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOutput([]);
                  setStatus("idle");
                  setProgress(null);
                }}
                className="gap-1.5"
              >
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div
              ref={outputRef}
              className="h-[460px] overflow-y-auto rounded-lg bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-[#c9d1d9]"
            >
              {output.length === 0 ? (
                <span className="text-[#484f58]">Waiting for command…</span>
              ) : (
                output.map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      line.startsWith("$") && "text-[#58a6ff] font-semibold",
                      line.startsWith("✓") && "text-[#3fb950] font-semibold",
                      line.startsWith("✗") && "text-[#f85149] font-semibold",
                      line.startsWith("⏹") && "text-[#d29922]",
                      line.startsWith("Error") && "text-[#f85149]",
                    )}
                  >
                    {line || "\u00A0"}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[19px]" : "translate-x-[3px]"
          )}
        />
      </button>
    </div>
  );
}
