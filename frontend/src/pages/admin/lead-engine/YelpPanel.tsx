import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

type YelpOp = 'scrape-yelp' | 'scrape-yelp-batch' | 'yelp-pipeline';

interface Operation {
  id: YelpOp;
  label: string;
  description: string;
  icon: string;
}

const OPERATIONS: Operation[] = [
  { id: 'scrape-yelp', label: 'Single Search', description: 'Scrape Yelp API for one niche + location', icon: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' },
  { id: 'scrape-yelp-batch', label: 'Batch Scrape', description: 'Scrape across all zip codes in a metro area', icon: 'M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3' },
  { id: 'yelp-pipeline', label: 'Full Pipeline', description: 'Batch scrape → triage → audit → score → enrich', icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
];

const NICHES = [
  'dentist', 'chiropractor', 'med spa', 'contractor', 'hvac',
  'plumber', 'roofing', 'electrician', 'landscaping', 'auto repair',
  'hair salon', 'barber', 'restaurant', 'veterinarian', 'realtor',
];

const METROS = [
  'Miami, FL', 'Tampa, FL', 'Houston, TX', 'Dallas, TX', 'Orlando, FL', 'Las Vegas, NV',
];

const MAX_OUTPUT_LINES = 5000;
type RunStatus = 'idle' | 'running' | 'completed' | 'error';

export function YelpPanel() {
  const [selectedOp, setSelectedOp] = useState<YelpOp>('scrape-yelp');
  const [niche, setNiche] = useState('dentist');
  const [location, setLocation] = useState('Miami, FL');
  const [metro, setMetro] = useState('Miami, FL');
  const [unclaimedOnly, setUnclaimedOnly] = useState(true);
  const [maxReviews, setMaxReviews] = useState(50);
  const [requireWebsite, setRequireWebsite] = useState(false);
  const [dryRun, setDryRun] = useState(false);

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
    const base: string[] = ['--niche', niche];
    if (selectedOp === 'scrape-yelp') {
      return [...base, '--location', location, unclaimedOnly ? '--unclaimed-only' : '--all-listings', '--max-reviews', String(maxReviews), ...(requireWebsite ? ['--require-website'] : [])];
    }
    return [...base, '--metro', metro, unclaimedOnly ? '--unclaimed-only' : '--all-listings', '--max-reviews', String(maxReviews), ...(dryRun ? ['--dry-run'] : [])];
  }, [selectedOp, niche, location, metro, unclaimedOnly, maxReviews, requireWebsite, dryRun]);

  const parseProgress = useCallback((line: string) => {
    let m = line.match(/yelp_search\s+.*results=(\d+)/);
    if (m) { setProgress(p => ({ current: (p?.current ?? 0) + parseInt(m![1], 10), total: p?.total ?? 0, label: `Fetched ${m![1]} results` })); return; }
    m = line.match(/yelp_batch\s+.*raw=(\d+).*filtered=(\d+)/);
    if (m) { setProgress({ current: parseInt(m[2], 10), total: parseInt(m[1], 10), label: `${m[2]} passed filters (${m[1]} raw)` }); return; }
    m = line.match(/yelp_saved\s+.*new=(\d+)/);
    if (m) { setProgress(p => p ? { ...p, label: `Saved ${m![1]} new` } : null); return; }
    m = line.match(/Step (\d+)\/(\d+)/);
    if (m) { setProgress({ current: parseInt(m[1], 10), total: parseInt(m[2], 10), label: `Pipeline step ${m[1]}/${m[2]}` }); }
  }, []);

  const runCommand = useCallback(async () => {
    if (status === 'running') return;
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

      if (!res.ok || !res.body) { setStatus('error'); setOutput(prev => [...prev, `[ERROR] HTTP ${res.status}`]); return; }

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
              const text = (data.text || '').trimEnd();
              if (text) {
                const lines = text.split('\n');
                for (const l of lines) parseProgress(l);
                setOutput(prev => { const next = [...prev, ...lines]; return next.length > MAX_OUTPUT_LINES ? next.slice(-MAX_OUTPUT_LINES) : next; });
              }
            } else if (data.type === 'exit') {
              setStatus(data.code === 0 ? 'completed' : 'error');
            } else if (data.type === 'error') {
              setStatus('error');
              setOutput(prev => [...prev, `[ERROR] ${data.message}`]);
            }
          } catch {}
        }
      }
      setStatus(prev => prev === 'running' ? 'completed' : prev);
    } catch (e: any) {
      if (e.name !== 'AbortError') { setStatus('error'); setOutput(prev => [...prev, `[ERROR] ${e.message}`]); }
    }
  }, [status, selectedOp, buildArgs, parseProgress]);

  const stopCommand = useCallback(async () => {
    abortRef.current?.abort();
    const token = localStorage.getItem('token');
    try { await fetch('/api/scraper/run', { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} }); } catch {}
    setStatus('error');
    setOutput(prev => [...prev, '\n[STOPPED by user]']);
  }, []);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const pctDone = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Yelp Scraper</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Search Yelp Fusion API for unclaimed local businesses</p>
      </div>

      {/* Operation selector */}
      <div className="grid gap-3 sm:grid-cols-3">
        {OPERATIONS.map(op => (
          <button
            key={op.id}
            onClick={() => setSelectedOp(op.id)}
            className={`rounded-xl border-2 p-4 text-left transition-all ${selectedOp === op.id ? 'border-neutral-900 bg-white dark:border-white dark:bg-[#0a0a0a]' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-[#1a1a1a] dark:bg-[#0a0a0a] dark:hover:border-[#333]'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={op.icon} /></svg>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{op.label}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{op.description}</p>
          </button>
        ))}
      </div>

      {/* Config form */}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Niche</label>
            <select value={niche} onChange={e => setNiche(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-100">
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {NICHES.slice(0, 8).map(n => (
                <button key={n} onClick={() => setNiche(n)} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${niche === n ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#111] dark:text-gray-400 dark:hover:bg-[#1a1a1a]'}`}>{n}</button>
              ))}
            </div>
          </div>

          {selectedOp === 'scrape-yelp' ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, ST or zip code" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-100" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Metro Area</label>
              <select value={metro} onChange={e => setMetro(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-100">
                {METROS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max Reviews: {maxReviews}</label>
            <input type="range" min={5} max={200} value={maxReviews} onChange={e => setMaxReviews(parseInt(e.target.value))} className="w-full accent-neutral-700 dark:accent-neutral-300" />
            <div className="flex justify-between text-[10px] text-gray-400"><span>5</span><span>200</span></div>
          </div>

          <div className="space-y-3">
            <Toggle label="Unclaimed Only" description="Filter to businesses that haven't claimed their Yelp listing" checked={unclaimedOnly} onChange={setUnclaimedOnly} />
            {selectedOp === 'scrape-yelp' && <Toggle label="Require Website" description="Only include listings that have a website URL" checked={requireWebsite} onChange={setRequireWebsite} />}
            {selectedOp !== 'scrape-yelp' && <Toggle label="Dry Run" description="Preview without actually scraping" checked={dryRun} onChange={setDryRun} />}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={runCommand} disabled={status === 'running'}>
            {status === 'running' ? 'Running...' : `Run ${OPERATIONS.find(o => o.id === selectedOp)?.label}`}
          </Button>
          {status === 'running' && <Button variant="danger" onClick={stopCommand}>Stop</Button>}
        </div>
      </Card>

      {/* Output terminal */}
      {output.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${status === 'running' ? 'animate-pulse bg-green-500' : status === 'completed' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-gray-400'}`} />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {status === 'running' ? 'Running' : status === 'completed' ? 'Completed' : status === 'error' ? 'Stopped' : 'Output'}
              </span>
            </div>
            <span className="font-mono text-xs text-gray-400">{fmtTime(elapsed)}</span>
          </div>

          {progress && (
            <div className="border-b border-gray-200 px-4 py-2 dark:border-[#1a1a1a]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">{progress.label}</span>
                <span className="text-xs font-mono text-gray-400">{pctDone}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#1a1a1a]">
                <div className={`h-full rounded-full transition-all ${status === 'completed' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-neutral-600 dark:bg-neutral-300'}`} style={{ width: `${pctDone}%` }} />
              </div>
            </div>
          )}

          <div ref={outputRef} className="max-h-96 overflow-y-auto bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-[#c9d1d9]">
            {output.map((line, i) => (
              <div key={i} className={line.startsWith('$') ? 'text-[#58a6ff]' : line.includes('[ERROR]') ? 'text-[#f85149]' : line.includes('[STOPPED]') ? 'text-[#d29922]' : line.includes('Saved') || line.includes('complete') ? 'text-[#3fb950]' : ''}>
                {line}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-neutral-700 dark:bg-neutral-300' : 'bg-gray-300 dark:bg-gray-600'}`} onClick={() => onChange(!checked)}>
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform dark:bg-black ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </label>
  );
}
