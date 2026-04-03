import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

type CraigslistOp = 'scrape-craigslist' | 'scrape-craigslist-batch';

interface Operation {
  id: CraigslistOp;
  label: string;
  description: string;
  icon: string;
}

const OPERATIONS: Operation[] = [
  { id: 'scrape-craigslist', label: 'Single City', description: 'Scrape Craigslist services for one city + category', icon: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' },
  { id: 'scrape-craigslist-batch', label: 'Batch Scrape', description: 'Run all configured city + category + keyword combos', icon: 'M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3' },
];

const CL_CITIES = [
  'San Antonio, TX', 'Denver, CO', 'Tampa, FL', 'Orlando, FL',
  'Nashville, TN', 'Charlotte, NC', 'Las Vegas, NV', 'Jacksonville, FL',
  'Austin, TX', 'Houston, TX', 'Dallas, TX', 'Phoenix, AZ',
  'Atlanta, GA', 'Miami, FL', 'Portland, OR', 'Sacramento, CA',
  'Minneapolis, MN', 'Detroit, MI', 'Pittsburgh, PA', 'Columbus, OH',
  'Kansas City, MO', 'Raleigh, NC', 'Richmond, VA', 'Louisville, KY',
  'Indianapolis, IN', 'Omaha, NE', 'Birmingham, AL', 'Knoxville, TN',
  'Boise, ID', 'Salt Lake City, UT',
];

const CL_CATEGORIES: { code: string; label: string }[] = [
  { code: 'bbb', label: 'All Services' },
  { code: 'hss', label: 'Household Services' },
  { code: 'sks', label: 'Skilled Trades' },
  { code: 'fgs', label: 'Farm & Garden' },
  { code: 'cps', label: 'Computer Services' },
  { code: 'crs', label: 'Creative Services' },
  { code: 'evs', label: 'Event Services' },
  { code: 'pas', label: 'Pet Services' },
  { code: 'rts', label: 'Real Estate Services' },
  { code: 'lgs', label: 'Lessons & Tutoring' },
];

const CL_KEYWORDS = [
  'landscaping', 'painting', 'cleaning', 'plumbing', 'roofing',
  'electrical', 'handyman', 'pressure washing', 'tree service',
  'junk removal', 'fencing', 'concrete', 'HVAC',
];

const MAX_OUTPUT_LINES = 5000;
type RunStatus = 'idle' | 'running' | 'completed' | 'error';

export function CraigslistPanel() {
  const [selectedOp, setSelectedOp] = useState<CraigslistOp>('scrape-craigslist');
  const [city, setCity] = useState('Austin, TX');
  const [category, setCategory] = useState('bbb');
  const [keyword, setKeyword] = useState('');
  const [maxPages, setMaxPages] = useState(3);
  const [headless, setHeadless] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [batchLimit, setBatchLimit] = useState(20);

  const [status, setStatus] = useState<RunStatus>('idle');
  const [output, setOutput] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, [output]);

  useEffect(() => {
    if (status !== 'running' || !startTime) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [status, startTime]);

  const buildArgs = useCallback((): string[] => {
    if (selectedOp === 'scrape-craigslist') {
      return ['--city', city, '--category', category, ...(keyword.trim() ? ['--keyword', keyword.trim()] : []), '--max-pages', String(maxPages), headless ? '--headless' : '--no-headless'];
    }
    return ['--max-pages', String(maxPages), '--limit', String(batchLimit), headless ? '--headless' : '--no-headless', ...(dryRun ? ['--dry-run'] : [])];
  }, [selectedOp, city, category, keyword, maxPages, headless, dryRun, batchLimit]);

  const canRun = useCallback((): boolean => {
    if (status === 'running') return false;
    if (selectedOp === 'scrape-craigslist') return city.trim() !== '';
    return true;
  }, [status, selectedOp, city]);

  const parseProgress = useCallback((line: string) => {
    let m = line.match(/cl_detail_fetch\s+.*i=(\d+).*total=(\d+)/);
    if (m) { setProgress({ current: parseInt(m[1], 10), total: parseInt(m[2], 10), label: 'Extracting details' }); return; }
    m = line.match(/cl_page_results\s+.*count=(\d+)/);
    if (m) { setProgress((p) => ({ current: 0, total: parseInt(m![1], 10), label: p?.label ?? 'Loading listings' })); return; }
    m = line.match(/Run\s+(\d+)\/(\d+):/);
    if (m) { setProgress({ current: parseInt(m[1], 10), total: parseInt(m[2], 10), label: `Batch run ${m[1]}/${m[2]}` }); return; }
    m = line.match(/cl_businesses_saved\s+.*new=(\d+)/);
    if (m) { setProgress((p) => p ? { ...p, current: p.total, label: `Saved ${m![1]} new` } : p); }
  }, []);

  const runCommand = useCallback(async () => {
    if (!canRun()) return;
    const args = buildArgs();
    const displayCmd = `nwsmedia ${selectedOp} ${args.join(' ')}`;
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
        body: JSON.stringify({ command: selectedOp, args }),
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Craigslist Scraper</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Scrape service listings from Craigslist</p>
      </div>

      {/* Operation selector */}
      <Card title="Craigslist Services Scraper">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Scrape service listings &mdash; landscapers, painters, handymen, and more
        </p>
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
        <Card>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {status === 'running' && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-600 border-t-transparent dark:border-neutral-300 dark:border-t-transparent" />}
                {status === 'completed' && <svg className="h-3.5 w-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                {status === 'error' && <svg className="h-3.5 w-3.5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                <span className="font-medium text-gray-900 dark:text-gray-100">{progress.label}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                {status === 'running' && <span className="tabular-nums">{formatElapsed(elapsed)}</span>}
                <span className="tabular-nums font-medium">{progress.current}/{progress.total}</span>
                <span className="tabular-nums w-12 text-right">{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%</span>
              </div>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#1a1a1a]">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${status === 'completed' ? 'bg-green-600 dark:bg-green-500' : status === 'error' ? 'bg-red-600 dark:bg-red-500' : 'bg-neutral-700 dark:bg-neutral-300'}`}
                style={{ width: `${progress.total > 0 ? Math.min((progress.current / progress.total) * 100, 100) : 0}%` }}
              />
            </div>
          </div>
        </Card>
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
            {selectedOp === 'scrape-craigslist' ? (
              <>
                {/* City */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">City</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#111] dark:border-[#333] dark:text-gray-100"
                  >
                    {CL_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CL_CATEGORIES.map((cat) => (
                      <button
                        key={cat.code}
                        type="button"
                        onClick={() => setCategory(cat.code)}
                        className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                          category === cat.code
                            ? 'border-neutral-400 bg-neutral-100 text-neutral-900 dark:border-neutral-500 dark:bg-[#1a1a1a] dark:text-white'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-[#1a1a1a] dark:text-gray-400 dark:hover:bg-[#111]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keyword */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Keyword <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
                  </label>
                  <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder='e.g. "landscaping" or "plumbing"' />
                  <div className="flex flex-wrap gap-1.5">
                    {CL_KEYWORDS.map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => setKeyword(kw)}
                        className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                          keyword === kw
                            ? 'border-neutral-400 bg-neutral-100 text-neutral-900 dark:border-neutral-500 dark:bg-[#1a1a1a] dark:text-white'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-[#1a1a1a] dark:text-gray-400 dark:hover:bg-[#111]'
                        }`}
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Pages */}
                <SliderField label="Max Pages" value={maxPages} onChange={setMaxPages} min={1} max={10} step={1} />
                <Toggle label="Headless Mode" description="Run browser without visible window" checked={headless} onChange={setHeadless} />
              </>
            ) : (
              <>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2 dark:border-[#1a1a1a] dark:bg-[#111]">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Runs through all 100 mapped cities with configured categories and keywords.
                    Each combo scrapes up to {maxPages * 120} listings.
                  </p>
                </div>
                <SliderField label="Batch Limit" value={batchLimit} onChange={setBatchLimit} min={5} max={200} step={5} />
                <SliderField label="Max Pages per Run" value={maxPages} onChange={setMaxPages} min={1} max={10} step={1} />
                <Toggle label="Headless Mode" checked={headless} onChange={setHeadless} />
                <Toggle label="Dry Run" description="Preview what would run without scraping" checked={dryRun} onChange={setDryRun} />
              </>
            )}

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
              {status === 'running' && <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">{formatElapsed(elapsed)}</span>}
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
              {status === 'completed' && <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              {status === 'error' && <svg className="h-4 w-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            </div>
            {output.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setOutput([]); setStatus('idle'); setProgress(null); }}>Clear</Button>
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

/* ───── Sub-components ───── */

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
