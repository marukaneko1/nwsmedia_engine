import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

type FilingsOp = 'import-filings' | 'enrich-filings';

interface Operation {
  id: FilingsOp;
  label: string;
  description: string;
  icon: string;
}

const OPERATIONS: Operation[] = [
  { id: 'import-filings', label: 'Import CSV', description: 'Load Secretary of State bulk CSV file (FL or TX)', icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5' },
  { id: 'enrich-filings', label: 'Apollo Enrich', description: 'Find owner email via Apollo.io for SoS records', icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75' },
];

const STATES = ['FL', 'TX', 'NV', 'NY', 'CA', 'WY', 'DE'];
const ENTITY_TYPES = ['LLC', 'Corporation', 'LP', 'Nonprofit'];

const MAX_OUTPUT_LINES = 5000;
type RunStatus = 'idle' | 'running' | 'completed' | 'error';

export function FilingsPanel() {
  const [selectedOp, setSelectedOp] = useState<FilingsOp>('import-filings');
  const [state, setState] = useState('FL');
  const [filePath, setFilePath] = useState('');
  const [daysMin, setDaysMin] = useState(14);
  const [daysMax, setDaysMax] = useState(75);
  const [entityTypes, setEntityTypes] = useState<string[]>(['LLC', 'Corporation']);
  const [enrichLimit, setEnrichLimit] = useState(100);
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
    if (selectedOp === 'import-filings') {
      return ['--state', state, '--file', filePath, '--days-min', String(daysMin), '--days-max', String(daysMax), '--entity-types', entityTypes.join(',')];
    }
    return ['--limit', String(enrichLimit), ...(dryRun ? ['--dry-run'] : [])];
  }, [selectedOp, state, filePath, daysMin, daysMax, entityTypes, enrichLimit, dryRun]);

  const canRun = useCallback((): boolean => {
    if (status === 'running') return false;
    if (selectedOp === 'import-filings') return filePath.trim() !== '' && state !== '';
    return true;
  }, [status, selectedOp, filePath, state]);

  const parseProgress = useCallback((line: string) => {
    let m = line.match(/Parsed\s+(\d+)\s+matching/);
    if (m) { setProgress({ current: parseInt(m[1], 10), total: parseInt(m[1], 10), label: `${m[1]} filings parsed` }); return; }
    m = line.match(/Saved\s+(\d+)\s+new/);
    if (m) { setProgress(p => p ? { ...p, label: `Saved ${m![1]} new` } : null); return; }
    m = line.match(/sos_enriched.*business=(.+?),/);
    if (m) { setProgress(p => ({ current: (p?.current ?? 0) + 1, total: p?.total ?? 0, label: `Enriched: ${m![1]}` })); return; }
    m = line.match(/Enriching\s+(\d+)\s+SoS/);
    if (m) { setProgress({ current: 0, total: parseInt(m[1], 10), label: 'Apollo enrichment' }); }
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
  }, [status, selectedOp, buildArgs, canRun, parseProgress]);

  const stopCommand = useCallback(async () => {
    abortRef.current?.abort();
    const token = localStorage.getItem('token');
    try { await fetch('/api/scraper/run', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); } catch {}
    setStatus('error');
    setOutput(prev => [...prev, '\n[STOPPED by user]']);
  }, []);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const pctDone = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const toggleEntityType = (t: string) => {
    setEntityTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">New Business Filings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Import Secretary of State LLC/Corp filings and enrich with Apollo.io</p>
      </div>

      {/* Operation selector */}
      <div className="grid gap-3 sm:grid-cols-2">
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
        {selectedOp === 'import-filings' ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">State</label>
                <div className="flex flex-wrap gap-2">
                  {STATES.map(s => (
                    <button key={s} onClick={() => setState(s)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${state === s ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#111] dark:text-gray-400 dark:hover:bg-[#1a1a1a]'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Entity Types</label>
                <div className="flex flex-wrap gap-2">
                  {ENTITY_TYPES.map(t => (
                    <button key={t} onClick={() => toggleEntityType(t)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${entityTypes.includes(t) ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#111] dark:text-gray-400 dark:hover:bg-[#1a1a1a]'}`}>{t}</button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">CSV File Path</label>
              <input value={filePath} onChange={e => setFilePath(e.target.value)} placeholder="/path/to/sunbiz_export.csv" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-100" />
              <p className="mt-1 text-[10px] text-gray-400">FL: pipe-delimited from Sunbiz.org ($50) · TX: standard CSV from SoS ($75)</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Min Days Since Filing: {daysMin}</label>
                <input type="range" min={1} max={60} value={daysMin} onChange={e => setDaysMin(parseInt(e.target.value))} className="w-full accent-neutral-700 dark:accent-neutral-300" />
                <div className="flex justify-between text-[10px] text-gray-400"><span>1 day</span><span>60 days</span></div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max Days Since Filing: {daysMax}</label>
                <input type="range" min={30} max={180} value={daysMax} onChange={e => setDaysMax(parseInt(e.target.value))} className="w-full accent-neutral-700 dark:accent-neutral-300" />
                <div className="flex justify-between text-[10px] text-gray-400"><span>30 days</span><span>180 days</span></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max Leads to Enrich: {enrichLimit}</label>
              <input type="range" min={10} max={500} step={10} value={enrichLimit} onChange={e => setEnrichLimit(parseInt(e.target.value))} className="w-full accent-neutral-700 dark:accent-neutral-300" />
              <div className="flex justify-between text-[10px] text-gray-400"><span>10</span><span>500</span></div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <div className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors ${dryRun ? 'bg-neutral-700 dark:bg-neutral-300' : 'bg-gray-300 dark:bg-gray-600'}`} onClick={() => setDryRun(!dryRun)}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform dark:bg-black ${dryRun ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Dry Run</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Only count leads, don't call Apollo API</p>
              </div>
            </label>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={runCommand} disabled={!canRun()}>
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
