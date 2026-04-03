import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

type OperationId =
  | 'auto'
  | 'scrape'
  | 'scrape-batch'
  | 'pipeline'
  | 'triage'
  | 'audit'
  | 'score'
  | 'enrich'
  | 'backfill-emails'
  | 'generate-pdfs'
  | 'rescore'
  | 'dedup';

interface Operation {
  id: OperationId;
  label: string;
  description: string;
  icon: string;
}

const OPERATIONS: Operation[] = [
  { id: 'auto', label: 'Do it all', description: 'Batch scrape then full pipeline (triage \u2192 audit \u2192 score \u2192 enrich)', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z' },
  { id: 'scrape', label: 'Scrape', description: 'Scrape Google Maps for a niche + location', icon: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' },
  { id: 'scrape-batch', label: 'Batch Scrape', description: 'Run all preset niche + location combos', icon: 'M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3' },
  { id: 'pipeline', label: 'Pipeline', description: 'Full pipeline: Triage \u2192 Audit \u2192 Score \u2192 Enrich', icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
  { id: 'triage', label: 'Triage', description: 'Classify all untriaged businesses', icon: 'M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z' },
  { id: 'audit', label: 'Audit', description: 'Run website audits on triaged businesses', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
  { id: 'score', label: 'Score', description: 'Score all triaged businesses', icon: 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.541 0' },
  { id: 'enrich', label: 'Enrich', description: 'Find emails & socials for scored leads', icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75' },
  { id: 'backfill-emails', label: 'Backfill Emails', description: 'Re-scrape Maps for missing emails', icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75' },
  { id: 'generate-pdfs', label: 'Generate PDFs', description: 'Create audit PDF reports', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
  { id: 'rescore', label: 'Re-score', description: 'Clear and recalculate all lead scores', icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182' },
  { id: 'dedup', label: 'Deduplicate', description: 'Remove duplicate business entries', icon: 'M6 18L18 6M6 6l12 12' },
];

const PRESET_NICHES = [
  'HVAC contractor', 'plumber', 'roofer', 'electrician', 'general contractor',
  'landscaping company', 'pest control company', 'auto repair shop', 'tree service',
  'painting company', 'garage door repair',
];

const PRESET_LOCATIONS = [
  'San Antonio, TX', 'Denver, CO', 'Tampa, FL', 'Orlando, FL', 'Nashville, TN',
  'Charlotte, NC', 'Las Vegas, NV', 'Jacksonville, FL', 'Memphis, TN', 'Oklahoma City, OK',
];

const TOTAL_BATCH_RUNS = 4115;
const MAX_OUTPUT_LINES = 5000;

type RunStatus = 'idle' | 'running' | 'completed' | 'error';

export function ScraperPanel() {
  const [selectedOp, setSelectedOp] = useState<OperationId>('scrape');
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState(200);
  const [headless, setHeadless] = useState(true);
  const [maxPerRun, setMaxPerRun] = useState(75);
  const [maxRuns, setMaxRuns] = useState(50);
  const [dryRun, setDryRun] = useState(false);
  const [minScore, setMinScore] = useState(40);
  const [limit, setLimit] = useState('');
  const [backfillAll, setBackfillAll] = useState(false);

  const [status, setStatus] = useState<RunStatus>('idle');
  const [output, setOutput] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<{
    current: number; total: number; label: string;
    sub?: { current: number; total: number; label: string };
  } | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  useEffect(() => {
    if (status !== 'running' || !startTime) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [status, startTime]);

  const buildArgs = useCallback((): string[] => {
    switch (selectedOp) {
      case 'auto':
        return ['--max-per-run', String(maxPerRun), '--limit', String(maxRuns), headless ? '--headless' : '--no-headless', ...(dryRun ? ['--dry-run'] : [])];
      case 'scrape':
        return ['--niche', niche.trim(), '--location', location.trim(), '--max-results', String(maxResults), headless ? '--headless' : '--no-headless'];
      case 'scrape-batch':
        return ['--max-per-run', String(maxPerRun), '--limit', String(maxRuns), headless ? '--headless' : '--no-headless', ...(dryRun ? ['--dry-run'] : [])];
      case 'enrich':
        return ['--min-score', String(minScore), ...(limit ? ['--limit', limit] : [])];
      case 'backfill-emails':
        return [...(limit ? ['--limit', limit] : []), ...(backfillAll ? ['--all'] : []), headless ? '--headless' : '--no-headless'];
      case 'generate-pdfs':
        return ['--min-score', String(minScore), ...(limit ? ['--limit', limit] : [])];
      default:
        return [];
    }
  }, [selectedOp, niche, location, maxResults, headless, maxPerRun, maxRuns, dryRun, minScore, limit, backfillAll]);

  const canRun = useCallback((): boolean => {
    if (status === 'running') return false;
    if (selectedOp === 'scrape') return niche.trim() !== '' && location.trim() !== '';
    return true;
  }, [status, selectedOp, niche, location]);

  const parseProgress = useCallback((line: string) => {
    let m = line.match(/detail_extracted\s+i=(\d+)/);
    if (m) { setProgress((p) => ({ current: parseInt(m![1], 10), total: p?.total || maxResults, label: 'Extracting details', sub: p?.sub })); return; }
    m = line.match(/scroll_progress\s+.*listings=(\d+)/);
    if (m) { setProgress((p) => ({ current: parseInt(m![1], 10), total: p?.total || maxResults, label: 'Scrolling listings', sub: p?.sub })); return; }
    m = line.match(/Run\s+(\d+)\/(\d+):/);
    if (m) { setProgress((p) => ({ current: p?.current ?? 0, total: p?.total ?? 1, label: p?.label ?? 'Batch scrape', sub: { current: parseInt(m![1], 10), total: parseInt(m![2], 10), label: `Run ${m![1]}/${m![2]}` } })); return; }
    m = line.match(/Step\s+(\d+)\/(\d+):\s*(\w+)/);
    if (m) { setProgress({ current: parseInt(m[1], 10) - 1, total: parseInt(m[2], 10), label: m[3] }); return; }
    m = line.match(/Triaging\s+(\d+)\s+businesses/);
    if (m) { setProgress((p) => ({ current: 0, total: parseInt(m![1], 10), label: p?.label ?? 'Triaging', sub: p?.sub })); return; }
    m = line.match(/Auditing\s+(\d+)\s+websites/);
    if (m) { setProgress((p) => ({ current: 0, total: parseInt(m![1], 10), label: p?.label ?? 'Auditing', sub: p?.sub })); return; }
    m = line.match(/Enriching\s+(\d+)\s+leads/);
    if (m) { setProgress((p) => ({ current: 0, total: parseInt(m![1], 10), label: p?.label ?? 'Enriching', sub: p?.sub })); return; }
    m = line.match(/(Re-)?[Ss]coring\s+(\d+)\s+businesses/);
    if (m) { setProgress((p) => ({ current: 0, total: parseInt(m![2], 10), label: p?.label ?? 'Scoring', sub: p?.sub })); return; }
    m = line.match(/Businesses:\s+(\d+)/);
    if (m) { setProgress((p) => ({ current: 0, total: parseInt(m![1], 10), label: 'Backfilling emails', sub: p?.sub })); return; }
    m = line.match(/(?:Saved|Updated|email_updated|email_none|enriched|audited|scored|triaged)\D*(\d+)/i);
    if (m) { const n = parseInt(m[1], 10); if (n > 0) setProgress((p) => p ? { ...p, current: Math.min(p.current + n, p.total) } : p); }
  }, [maxResults]);

  const runCommand = useCallback(async () => {
    if (!canRun()) return;
    const args = buildArgs();
    const displayCmd = selectedOp === 'auto' ? 'Do it all: scrape-batch \u2192 pipeline' : `nwsmedia ${selectedOp} ${args.join(' ')}`;
    setOutput([`$ ${displayCmd}`, '']);
    setStatus('running');
    setStartTime(Date.now());
    setElapsed(0);
    setProgress(null);

    const controller = new AbortController();
    abortRef.current = controller;
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/scraper/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ command: selectedOp === 'auto' ? 'auto' : selectedOp, args }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errorText = await res.text();
        let msg = errorText;
        try { const j = JSON.parse(errorText); if (j?.error) msg = j.error; } catch { /* use raw */ }
        setOutput((prev) => [...prev, `Error: ${msg}`]);
        setStatus('error');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.type === 'stdout' || data.type === 'stderr') {
              const text = data.text.trimEnd();
              if (text) {
                const lines = text.split('\n');
                for (const l of lines) parseProgress(l);
                setOutput((prev) => { const next = [...prev, ...lines]; return next.length > MAX_OUTPUT_LINES ? next.slice(-MAX_OUTPUT_LINES) : next; });
              }
            } else if (data.type === 'step') {
              setProgress({ current: data.step - 1, total: data.total, label: data.command });
              setOutput((prev) => [...prev, '', `\u2014\u2014\u2014 Step ${data.step}/${data.total}: ${data.command} \u2014\u2014\u2014`, '']);
            } else if (data.type === 'exit') {
              const ok = data.code === 0;
              setStatus(ok ? 'completed' : 'error');
              if (ok) setProgress((p) => (p ? { ...p, current: p.total } : p));
              setOutput((prev) => [...prev, '', ok ? '\u2713 Process completed successfully' : `\u2717 Process exited with code ${data.code}`]);
            } else if (data.type === 'error') {
              setStatus('error');
              setOutput((prev) => [...prev, `Error: ${data.message}`]);
            }
          } catch { /* malformed SSE */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setOutput((prev) => [...prev, '', '\u23f9 Stopped by user']);
        setStatus('idle');
        setProgress(null);
      } else {
        setOutput((prev) => [...prev, `Error: ${(err as Error).message}`]);
        setStatus('error');
      }
    }
  }, [selectedOp, buildArgs, canRun, parseProgress]);

  const stopCommand = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    const token = localStorage.getItem('token');
    try { await fetch('/api/scraper/run', { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} }); } catch { /* ignore */ }
    setStatus('idle');
  }, []);

  const formatElapsed = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return m > 0 ? `${m}m ${sec}s` : `${sec}s`; };
  const selectedOperation = OPERATIONS.find((op) => op.id === selectedOp)!;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Google Maps Scraper</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Scrape, triage, audit, score, and enrich business leads</p>
      </div>

      {/* Operation selector */}
      <Card title="Select Operation">
        <div className="flex flex-wrap gap-2">
          {OPERATIONS.map((op) => (
            <button
              key={op.id}
              onClick={() => setSelectedOp(op.id)}
              disabled={status === 'running'}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                selectedOp === op.id
                  ? 'border-neutral-400 bg-neutral-100 text-neutral-900 dark:border-neutral-500 dark:bg-[#1a1a1a] dark:text-white'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:border-[#1a1a1a] dark:text-gray-400 dark:hover:bg-[#111] dark:hover:text-gray-200'
              }`}
            >
              <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={op.icon} />
              </svg>
              {op.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Progress bar */}
      {(status === 'running' || status === 'completed' || status === 'error') && progress && (
        <ProgressBar progress={progress} status={status} elapsed={elapsed} formatElapsed={formatElapsed} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <svg className="h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={selectedOperation.icon} />
            </svg>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{selectedOperation.label}</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{selectedOperation.description}</p>

          <div className="space-y-4">
            <FormFields
              selectedOp={selectedOp} niche={niche} setNiche={setNiche} location={location} setLocation={setLocation}
              maxResults={maxResults} setMaxResults={setMaxResults} headless={headless} setHeadless={setHeadless}
              maxPerRun={maxPerRun} setMaxPerRun={setMaxPerRun} maxRuns={maxRuns} setMaxRuns={setMaxRuns}
              dryRun={dryRun} setDryRun={setDryRun} minScore={minScore} setMinScore={setMinScore}
              limit={limit} setLimit={setLimit} backfillAll={backfillAll} setBackfillAll={setBackfillAll}
            />

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={runCommand} disabled={!canRun()}>
                {status === 'running' ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-black dark:border-t-transparent" />
                    Running\u2026
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                    Run {selectedOperation.label}
                  </span>
                )}
              </Button>
              {status === 'running' && (
                <Button variant="danger" onClick={stopCommand}>
                  <span className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                    Stop
                  </span>
                </Button>
              )}
              {status === 'running' && (
                <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">{formatElapsed(elapsed)}</span>
              )}
            </div>
          </div>
        </Card>

        {/* Output terminal */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Output</h3>
              {status === 'running' && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-600 dark:bg-neutral-400" />
                </span>
              )}
              {status === 'completed' && (
                <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {status === 'error' && (
                <svg className="h-4 w-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            {output.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setOutput([]); setStatus('idle'); setProgress(null); }}>
                Clear
              </Button>
            )}
          </div>
          <div
            ref={outputRef}
            className="h-[460px] overflow-y-auto rounded-lg bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-[#c9d1d9]"
          >
            {output.length === 0 ? (
              <span className="text-[#484f58]">Waiting for command\u2026</span>
            ) : (
              output.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.startsWith('$') ? 'text-[#58a6ff] font-semibold' :
                    line.startsWith('\u2713') ? 'text-[#3fb950] font-semibold' :
                    line.startsWith('\u2717') ? 'text-[#f85149] font-semibold' :
                    line.startsWith('\u23f9') ? 'text-[#d29922]' :
                    line.startsWith('Error') ? 'text-[#f85149]' : ''
                  }
                >
                  {line || '\u00A0'}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ───── Form fields ───── */

function FormFields({
  selectedOp, niche, setNiche, location, setLocation, maxResults, setMaxResults,
  headless, setHeadless, maxPerRun, setMaxPerRun, maxRuns, setMaxRuns,
  dryRun, setDryRun, minScore, setMinScore, limit, setLimit, backfillAll, setBackfillAll,
}: {
  selectedOp: OperationId; niche: string; setNiche: (v: string) => void; location: string; setLocation: (v: string) => void;
  maxResults: number; setMaxResults: (v: number) => void; headless: boolean; setHeadless: (v: boolean) => void;
  maxPerRun: number; setMaxPerRun: (v: number) => void; maxRuns: number; setMaxRuns: (v: number) => void;
  dryRun: boolean; setDryRun: (v: boolean) => void; minScore: number; setMinScore: (v: number) => void;
  limit: string; setLimit: (v: string) => void; backfillAll: boolean; setBackfillAll: (v: boolean) => void;
}) {
  switch (selectedOp) {
    case 'auto': {
      const estimatedLeads = maxRuns * maxPerRun;
      return (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Runs batch scrape (first {maxRuns} of {TOTAL_BATCH_RUNS.toLocaleString()} preset niche+location combos), then triage &rarr; audit &rarr; score &rarr; enrich.
          </p>
          <SliderField label="Max Runs" value={maxRuns} onChange={setMaxRuns} min={5} max={500} step={5} />
          <SliderField label="Max Per Run" value={maxPerRun} onChange={setMaxPerRun} min={10} max={300} step={5} />
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3 dark:border-[#1a1a1a] dark:bg-[#111]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Estimated Leads</span>
              <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">~{estimatedLeads.toLocaleString()}</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>{maxRuns} runs &times; {maxPerRun} per run = up to {estimatedLeads.toLocaleString()} leads</p>
              <p className="opacity-70">{TOTAL_BATCH_RUNS.toLocaleString()} total combos available (90 niches &times; up to 100 locations). Duplicates are filtered automatically.</p>
            </div>
          </div>
          <Toggle label="Headless Mode" checked={headless} onChange={setHeadless} />
          <Toggle label="Dry Run" description="Only run scrape-batch in preview mode (no pipeline)" checked={dryRun} onChange={setDryRun} />
        </>
      );
    }
    case 'scrape':
      return (
        <>
          <Field label="Niche">
            <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder='e.g. "dentist" or "HVAC contractor"' />
            <PresetChips items={PRESET_NICHES} selected={niche} onSelect={setNiche} />
          </Field>
          <Field label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder='e.g. "Austin, TX"' />
            <PresetChips items={PRESET_LOCATIONS} selected={location} onSelect={setLocation} />
          </Field>
          <SliderField label="Max Results" value={maxResults} onChange={setMaxResults} min={10} max={500} step={10} />
          <Toggle label="Headless Mode" description="Run browser without visible window" checked={headless} onChange={setHeadless} />
        </>
      );
    case 'scrape-batch':
      return (
        <>
          <SliderField label="Max Runs" value={maxRuns} onChange={setMaxRuns} min={5} max={500} step={5} />
          <p className="text-xs text-gray-500 dark:text-gray-400">First {maxRuns} of {TOTAL_BATCH_RUNS.toLocaleString()} niche+location combos (~{(maxRuns * maxPerRun).toLocaleString()} leads max)</p>
          <SliderField label="Max Per Run" value={maxPerRun} onChange={setMaxPerRun} min={10} max={300} step={5} />
          <Toggle label="Headless Mode" checked={headless} onChange={setHeadless} />
          <Toggle label="Dry Run" description="Preview what would run without scraping" checked={dryRun} onChange={setDryRun} />
        </>
      );
    case 'enrich':
      return (
        <>
          <SliderField label="Min Score" value={minScore} onChange={setMinScore} min={0} max={100} step={5} />
          <Field label="Limit" hint="optional">
            <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" min={1} />
          </Field>
        </>
      );
    case 'backfill-emails':
      return (
        <>
          <Field label="Limit" hint="optional">
            <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" min={1} />
          </Field>
          <Toggle label="Backfill All" description="Process all businesses, not just missing email" checked={backfillAll} onChange={setBackfillAll} />
          <Toggle label="Headless Mode" checked={headless} onChange={setHeadless} />
        </>
      );
    case 'generate-pdfs':
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
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-[#1a1a1a] dark:bg-[#111] dark:text-gray-400">
          No configurable parameters. Click the button below to run.
        </div>
      );
  }
}

/* ───── Reusable sub-components ───── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {label}
        {hint && <span className="ml-1 font-normal text-gray-500 dark:text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function SliderField({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</label>
        <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-neutral-700 dark:accent-neutral-300" />
      <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function PresetChips({ items, selected, onSelect }: { items: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onSelect(item)}
          className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
            selected === item
              ? 'border-neutral-400 bg-neutral-100 text-neutral-900 dark:border-neutral-500 dark:bg-[#1a1a1a] dark:text-white'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-[#1a1a1a] dark:text-gray-400 dark:hover:bg-[#111]'
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          checked ? 'bg-neutral-700 dark:bg-neutral-300' : 'bg-gray-300 dark:bg-[#333]'
        }`}
      >
        <span className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform dark:bg-black ${checked ? 'translate-x-[19px]' : 'translate-x-[3px]'}`} />
      </button>
    </div>
  );
}

function ProgressBar({ progress, status, elapsed, formatElapsed }: {
  progress: { current: number; total: number; label: string; sub?: { current: number; total: number; label: string } };
  status: RunStatus; elapsed: number; formatElapsed: (s: number) => string;
}) {
  const pct = progress.total > 0 ? Math.min((progress.current / progress.total) * 100, 100) : 0;
  const subPct = progress.sub && progress.sub.total > 0 ? Math.min((progress.sub.current / progress.sub.total) * 100, 100) : null;
  const done = status === 'completed';
  const failed = status === 'error';

  return (
    <Card>
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {status === 'running' && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-600 border-t-transparent dark:border-neutral-300 dark:border-t-transparent" />}
              {done && <svg className="h-3.5 w-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              {failed && <svg className="h-3.5 w-3.5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              <span className="font-medium text-gray-900 dark:text-gray-100">{progress.label}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
              {status === 'running' && <span className="tabular-nums">{formatElapsed(elapsed)}</span>}
              <span className="tabular-nums font-medium">{progress.current}/{progress.total}</span>
              <span className="tabular-nums w-12 text-right">{Math.round(pct)}%</span>
            </div>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#1a1a1a]">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${done ? 'bg-green-600 dark:bg-green-500' : failed ? 'bg-red-600 dark:bg-red-500' : 'bg-neutral-700 dark:bg-neutral-300'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {progress.sub && (
          <div className="space-y-1.5 pl-5">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{progress.sub.label}</span>
              <span className="tabular-nums">{progress.sub.current}/{progress.sub.total} &middot; {subPct !== null ? `${Math.round(subPct)}%` : '0%'}</span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#1a1a1a]">
              <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${done ? 'bg-green-500/70' : 'bg-neutral-500/60'}`} style={{ width: `${subPct ?? 0}%` }} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
