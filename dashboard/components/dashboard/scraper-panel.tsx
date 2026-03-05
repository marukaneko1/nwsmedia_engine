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
  Zap,
  Filter,
  FileSearch,
  Award,
  Mail,
  FileText,
  Play,
  Square,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Terminal,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type OperationId =
  | "auto"
  | "scrape"
  | "scrape-batch"
  | "pipeline"
  | "triage"
  | "audit"
  | "score"
  | "enrich"
  | "backfill-emails"
  | "generate-pdfs"
  | "rescore";

interface Operation {
  id: OperationId;
  label: string;
  description: string;
  icon: typeof Search;
}

const OPERATIONS: Operation[] = [
  { id: "auto", label: "Do it all", description: "Batch scrape then full pipeline (triage → audit → score → enrich)", icon: Sparkles },
  { id: "scrape", label: "Scrape", description: "Scrape Google Maps for a niche + location", icon: Search },
  { id: "scrape-batch", label: "Batch Scrape", description: "Run all preset niche + location combos", icon: Layers },
  { id: "pipeline", label: "Pipeline", description: "Full pipeline: Triage → Audit → Score → Enrich", icon: Zap },
  { id: "triage", label: "Triage", description: "Classify all untriaged businesses", icon: Filter },
  { id: "audit", label: "Audit", description: "Run website audits on triaged businesses", icon: FileSearch },
  { id: "score", label: "Score", description: "Score all triaged businesses", icon: Award },
  { id: "enrich", label: "Enrich", description: "Find emails & socials for scored leads", icon: Mail },
  { id: "backfill-emails", label: "Backfill Emails", description: "Re-scrape Maps for missing emails", icon: Mail },
  { id: "generate-pdfs", label: "Generate PDFs", description: "Create audit PDF reports", icon: FileText },
  { id: "rescore", label: "Re-score", description: "Clear and recalculate all lead scores", icon: RefreshCw },
];

const PRESET_NICHES = [
  "HVAC contractor",
  "plumber",
  "roofer",
  "electrician",
  "general contractor",
  "landscaping company",
  "pest control company",
  "auto repair shop",
  "tree service",
  "painting company",
  "garage door repair",
];

const PRESET_LOCATIONS = [
  "San Antonio, TX",
  "Denver, CO",
  "Tampa, FL",
  "Orlando, FL",
  "Nashville, TN",
  "Charlotte, NC",
  "Las Vegas, NV",
  "Jacksonville, FL",
  "Memphis, TN",
  "Oklahoma City, OK",
];

const BATCH_CONFIGS_SUMMARY = {
  niches: [
    { niche: "HVAC contractor", count: 10 },
    { niche: "plumber", count: 10 },
    { niche: "roofer", count: 10 },
    { niche: "electrician", count: 8 },
    { niche: "general contractor", count: 7 },
    { niche: "landscaping company", count: 7 },
    { niche: "pest control company", count: 10 },
    { niche: "auto repair shop", count: 10 },
    { niche: "tree service", count: 9 },
    { niche: "painting company", count: 8 },
    { niche: "garage door repair", count: 8 },
  ],
  get totalRuns() {
    return this.niches.reduce((sum, n) => sum + n.count, 0);
  },
};

const MAX_OUTPUT_LINES = 5000;

type RunStatus = "idle" | "running" | "completed" | "error";

export function ScraperPanel() {
  const [selectedOp, setSelectedOp] = useState<OperationId>("scrape");
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState(200);
  const [headless, setHeadless] = useState(true);
  const [maxPerRun, setMaxPerRun] = useState(75);
  const [dryRun, setDryRun] = useState(false);
  const [minScore, setMinScore] = useState(40);
  const [limit, setLimit] = useState("");
  const [backfillAll, setBackfillAll] = useState(false);

  const [status, setStatus] = useState<RunStatus>("idle");
  const [output, setOutput] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    label: string;
    sub?: { current: number; total: number; label: string };
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
    switch (selectedOp) {
      case "auto":
        return [
          "--max-per-run", String(maxPerRun),
          headless ? "--headless" : "--no-headless",
          ...(dryRun ? ["--dry-run"] : []),
        ];
      case "scrape":
        return [
          "--niche", niche.trim(),
          "--location", location.trim(),
          "--max-results", String(maxResults),
          headless ? "--headless" : "--no-headless",
        ];
      case "scrape-batch":
        return [
          "--max-per-run", String(maxPerRun),
          headless ? "--headless" : "--no-headless",
          ...(dryRun ? ["--dry-run"] : []),
        ];
      case "enrich":
        return [
          "--min-score", String(minScore),
          ...(limit ? ["--limit", limit] : []),
        ];
      case "backfill-emails":
        return [
          ...(limit ? ["--limit", limit] : []),
          ...(backfillAll ? ["--all"] : []),
          headless ? "--headless" : "--no-headless",
        ];
      case "generate-pdfs":
        return [
          "--min-score", String(minScore),
          ...(limit ? ["--limit", limit] : []),
        ];
      default:
        return [];
    }
  }, [selectedOp, niche, location, maxResults, headless, maxPerRun, dryRun, minScore, limit, backfillAll]);

  const canRun = useCallback((): boolean => {
    if (status === "running") return false;
    if (selectedOp === "scrape") return niche.trim() !== "" && location.trim() !== "";
    return true;
  }, [status, selectedOp, niche, location]);

  const parseProgress = useCallback(
    (line: string) => {
      // scrape single: detail_extracted i=15
      let m = line.match(/detail_extracted\s+i=(\d+)/);
      if (m) {
        const i = parseInt(m[1], 10);
        setProgress((p) => ({
          current: i,
          total: p?.total || maxResults,
          label: `Extracting details`,
          sub: p?.sub,
        }));
        return;
      }

      // scrape single: scroll_progress round=X listings=Y
      m = line.match(/scroll_progress\s+.*listings=(\d+)/);
      if (m) {
        const count = parseInt(m[1], 10);
        setProgress((p) => ({
          current: count,
          total: p?.total || maxResults,
          label: `Scrolling listings`,
          sub: p?.sub,
        }));
        return;
      }

      // scrape-batch / auto: Run 5/47:
      m = line.match(/Run\s+(\d+)\/(\d+):/);
      if (m) {
        const cur = parseInt(m[1], 10);
        const tot = parseInt(m[2], 10);
        setProgress((p) => ({
          current: p?.current ?? 0,
          total: p?.total ?? 1,
          label: p?.label ?? "Batch scrape",
          sub: { current: cur, total: tot, label: `Run ${cur}/${tot}` },
        }));
        return;
      }

      // pipeline: Step 1/4: Triage / Step 2/4: Audit / etc.
      m = line.match(/Step\s+(\d+)\/(\d+):\s*(\w+)/);
      if (m) {
        const step = parseInt(m[1], 10);
        const tot = parseInt(m[2], 10);
        setProgress((p) => ({
          current: step - 1,
          total: tot,
          label: m![3],
          sub: undefined,
        }));
        return;
      }

      // triage: Triaging N businesses
      m = line.match(/Triaging\s+(\d+)\s+businesses/);
      if (m) {
        setProgress((p) => ({
          current: 0,
          total: parseInt(m![1], 10),
          label: p?.label ?? "Triaging",
          sub: p?.sub,
        }));
        return;
      }

      // audit: Auditing N websites
      m = line.match(/Auditing\s+(\d+)\s+websites/);
      if (m) {
        setProgress((p) => ({
          current: 0,
          total: parseInt(m![1], 10),
          label: p?.label ?? "Auditing",
          sub: p?.sub,
        }));
        return;
      }

      // enrich: Enriching N leads
      m = line.match(/Enriching\s+(\d+)\s+leads/);
      if (m) {
        setProgress((p) => ({
          current: 0,
          total: parseInt(m![1], 10),
          label: p?.label ?? "Enriching",
          sub: p?.sub,
        }));
        return;
      }

      // score/rescore: Scoring/Re-scoring N businesses
      m = line.match(/(Re-)?[Ss]coring\s+(\d+)\s+businesses/);
      if (m) {
        setProgress((p) => ({
          current: 0,
          total: parseInt(m![2], 10),
          label: p?.label ?? "Scoring",
          sub: p?.sub,
        }));
        return;
      }

      // backfill: Businesses: N
      m = line.match(/Businesses:\s+(\d+)/);
      if (m) {
        setProgress((p) => ({
          current: 0,
          total: parseInt(m![1], 10),
          label: "Backfilling emails",
          sub: p?.sub,
        }));
        return;
      }

      // generic per-item counters: Saved N, Updated N, enriched, etc.
      m = line.match(/(?:Saved|Updated|email_updated|email_none|enriched|audited|scored|triaged)\D*(\d+)/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > 0) {
          setProgress((p) =>
            p ? { ...p, current: Math.min(p.current + n, p.total) } : p
          );
        }
      }
    },
    [maxResults]
  );

  const runCommand = useCallback(async () => {
    if (!canRun()) return;

    const args = buildArgs();
    const displayCmd = selectedOp === "auto"
      ? "Do it all: scrape-batch → pipeline"
      : `nwsmedia ${selectedOp} ${args.join(" ")}`;
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
        body: JSON.stringify({
          command: selectedOp === "auto" ? "auto" : selectedOp,
          args,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errorText = await res.text();
        let msg = errorText;
        try {
          const j = JSON.parse(errorText) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* use raw text */
        }
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
            } else if (data.type === "step") {
              setProgress({
                current: data.step - 1,
                total: data.total,
                label: data.command,
              });
              setOutput((prev) => [
                ...prev,
                "",
                `——— Step ${data.step}/${data.total}: ${data.command} ———`,
                "",
              ]);
            } else if (data.type === "exit") {
              const ok = data.code === 0;
              setStatus(ok ? "completed" : "error");
              if (ok) {
                setProgress((p) => (p ? { ...p, current: p.total } : p));
              }
              setOutput((prev) => [
                ...prev,
                "",
                ok ? "✓ Process completed successfully" : `✗ Process exited with code ${data.code}`,
              ]);
            } else if (data.type === "error") {
              setStatus("error");
              setOutput((prev) => [...prev, `Error: ${data.message}`]);
            }
          } catch {
            /* malformed SSE event */
          }
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
    try {
      await fetch("/api/scrape", { method: "DELETE" });
    } catch {
      /* ignore */
    }
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
          <CardTitle className="text-base">Select Operation</CardTitle>
          <CardDescription>Choose a command to run</CardDescription>
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
        <ProgressBar progress={progress} status={status} elapsed={elapsed} formatElapsed={formatElapsed} />
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
            <FormFields
              selectedOp={selectedOp}
              niche={niche}
              setNiche={setNiche}
              location={location}
              setLocation={setLocation}
              maxResults={maxResults}
              setMaxResults={setMaxResults}
              headless={headless}
              setHeadless={setHeadless}
              maxPerRun={maxPerRun}
              setMaxPerRun={setMaxPerRun}
              dryRun={dryRun}
              setDryRun={setDryRun}
              minScore={minScore}
              setMinScore={setMinScore}
              limit={limit}
              setLimit={setLimit}
              backfillAll={backfillAll}
              setBackfillAll={setBackfillAll}
            />

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

/* ───── Form fields (rendered based on selected operation) ───── */

function FormFields({
  selectedOp,
  niche,
  setNiche,
  location,
  setLocation,
  maxResults,
  setMaxResults,
  headless,
  setHeadless,
  maxPerRun,
  setMaxPerRun,
  dryRun,
  setDryRun,
  minScore,
  setMinScore,
  limit,
  setLimit,
  backfillAll,
  setBackfillAll,
}: {
  selectedOp: OperationId;
  niche: string;
  setNiche: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  maxResults: number;
  setMaxResults: (v: number) => void;
  headless: boolean;
  setHeadless: (v: boolean) => void;
  maxPerRun: number;
  setMaxPerRun: (v: number) => void;
  dryRun: boolean;
  setDryRun: (v: boolean) => void;
  minScore: number;
  setMinScore: (v: number) => void;
  limit: string;
  setLimit: (v: string) => void;
  backfillAll: boolean;
  setBackfillAll: (v: boolean) => void;
}) {
  switch (selectedOp) {
    case "auto": {
      const totalRuns = BATCH_CONFIGS_SUMMARY.totalRuns;
      const estimatedLeads = totalRuns * maxPerRun;
      return (
        <>
          <p className="text-sm text-muted-foreground">
            Runs batch scrape (all preset niches + locations), then triage → audit → score → enrich.
          </p>
          <SliderField
            label="Max Per Run"
            value={maxPerRun}
            onChange={setMaxPerRun}
            min={10}
            max={300}
            step={5}
          />

          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Estimated Leads</span>
              <span className="text-lg font-bold tabular-nums text-primary">
                ~{estimatedLeads.toLocaleString()}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{totalRuns} runs × {maxPerRun} per run = up to {estimatedLeads.toLocaleString()} leads</p>
              <p className="text-[11px] opacity-70">Actual count depends on available listings per area. Duplicates are filtered automatically.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {BATCH_CONFIGS_SUMMARY.niches.map(({ niche, count }) => (
                <div key={niche} className="flex items-center justify-between rounded-md bg-background px-2.5 py-1.5 text-xs">
                  <span className="truncate text-foreground">{niche}</span>
                  <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">{count} × {maxPerRun}</span>
                </div>
              ))}
            </div>
          </div>

          <Toggle label="Headless Mode" checked={headless} onChange={setHeadless} />
          <Toggle label="Dry Run" description="Only run scrape-batch in preview mode (no pipeline)" checked={dryRun} onChange={setDryRun} />
        </>
      );
    }

    case "scrape":
      return (
        <>
          <Field label="Niche">
            <Input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder='e.g. "dentist" or "HVAC contractor"'
              list="niche-presets"
            />
            <datalist id="niche-presets">
              {PRESET_NICHES.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <PresetChips items={PRESET_NICHES} selected={niche} onSelect={setNiche} />
          </Field>

          <Field label="Location">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder='e.g. "Austin, TX"'
              list="location-presets"
            />
            <datalist id="location-presets">
              {PRESET_LOCATIONS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
            <PresetChips items={PRESET_LOCATIONS} selected={location} onSelect={setLocation} />
          </Field>

          <SliderField
            label="Max Results"
            value={maxResults}
            onChange={setMaxResults}
            min={10}
            max={500}
            step={10}
          />

          <Toggle label="Headless Mode" description="Run browser without visible window" checked={headless} onChange={setHeadless} />
        </>
      );

    case "scrape-batch":
      return (
        <>
          <SliderField
            label="Max Per Run"
            value={maxPerRun}
            onChange={setMaxPerRun}
            min={10}
            max={300}
            step={5}
          />
          <Toggle label="Headless Mode" checked={headless} onChange={setHeadless} />
          <Toggle label="Dry Run" description="Preview what would run without scraping" checked={dryRun} onChange={setDryRun} />
        </>
      );

    case "enrich":
      return (
        <>
          <SliderField label="Min Score" value={minScore} onChange={setMinScore} min={0} max={100} step={5} />
          <Field label="Limit" hint="optional">
            <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" min={1} />
          </Field>
        </>
      );

    case "backfill-emails":
      return (
        <>
          <Field label="Limit" hint="optional">
            <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" min={1} />
          </Field>
          <Toggle label="Backfill All" description="Process all businesses, not just missing email" checked={backfillAll} onChange={setBackfillAll} />
          <Toggle label="Headless Mode" checked={headless} onChange={setHeadless} />
        </>
      );

    case "generate-pdfs":
      return (
        <>
          <SliderField label="Min Score" value={minScore} onChange={setMinScore} min={0} max={100} step={5} />
          <Field label="Limit" hint="optional">
            <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" min={1} />
          </Field>
        </>
      );

    default:
      return (
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          No configurable parameters. Click the button below to run.
        </div>
      );
  }
}

/* ───── Reusable sub-components ───── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="text-sm tabular-nums text-muted-foreground">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function PresetChips({
  items,
  selected,
  onSelect,
}: {
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onSelect(item)}
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs transition-colors",
            selected === item
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-accent"
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function Toggle({
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

function ProgressBar({
  progress,
  status,
  elapsed,
  formatElapsed,
}: {
  progress: {
    current: number;
    total: number;
    label: string;
    sub?: { current: number; total: number; label: string };
  };
  status: RunStatus;
  elapsed: number;
  formatElapsed: (s: number) => string;
}) {
  const pct = progress.total > 0 ? Math.min((progress.current / progress.total) * 100, 100) : 0;
  const subPct = progress.sub && progress.sub.total > 0
    ? Math.min((progress.sub.current / progress.sub.total) * 100, 100)
    : null;
  const done = status === "completed";
  const failed = status === "error";

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        {/* Main bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {status === "running" && <Loader2 className="size-3.5 animate-spin text-primary" />}
              {done && <CheckCircle2 className="size-3.5 text-success" />}
              {failed && <XCircle className="size-3.5 text-destructive" />}
              <span className="font-medium text-foreground">{progress.label}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              {status === "running" && (
                <span className="tabular-nums">{formatElapsed(elapsed)}</span>
              )}
              <span className="tabular-nums font-medium">
                {progress.current}/{progress.total}
              </span>
              <span className="tabular-nums w-12 text-right">{Math.round(pct)}%</span>
            </div>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out",
                done ? "bg-success" : failed ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
            {status === "running" && pct < 100 && (
              <div
                className="absolute inset-y-0 left-0 animate-pulse rounded-full bg-primary/40"
                style={{ width: `${Math.min(pct + 3, 100)}%` }}
              />
            )}
          </div>
        </div>

        {/* Sub-progress (e.g. Run 5/47 inside batch scrape or auto) */}
        {progress.sub && (
          <div className="space-y-1.5 pl-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{progress.sub.label}</span>
              <span className="tabular-nums">
                {progress.sub.current}/{progress.sub.total}
                {" · "}
                {subPct !== null ? `${Math.round(subPct)}%` : "0%"}
              </span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out",
                  done ? "bg-success/70" : "bg-primary/60"
                )}
                style={{ width: `${subPct ?? 0}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
