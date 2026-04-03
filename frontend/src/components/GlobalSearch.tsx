import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

const typeConfig: Record<string, { icon: string; color: string; label: string }> = {
  lead: { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400', label: 'Lead' },
  deal: { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2', color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400', label: 'Deal' },
  user: { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400', label: 'User' },
  project: { icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400', label: 'Project' },
};

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.length < 2) { setResults([]); setOpen(false); return; }

    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(query)}`);
        setResults(res.results);
        setOpen(true);
        setSelectedIdx(-1);
      } catch { /* ignore */ }
      setLoading(false);
    }, 250);

    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    setQuery('');
    navigate(result.link);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((p) => Math.min(p + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((p) => Math.max(p - 1, 0)); }
    else if (e.key === 'Enter' && selectedIdx >= 0) { handleSelect(results[selectedIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search leads, deals, users...  ⌘K"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-neutral-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-[#262626] dark:bg-[#111] dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-[#1a1a1a]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-[#1a1a1a] dark:bg-[#0a0a0a] overflow-hidden">
          {results.map((r, i) => {
            const cfg = typeConfig[r.type] || typeConfig.lead;
            return (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => handleSelect(r)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selectedIdx ? 'bg-neutral-100 dark:bg-[#1a1a1a]' : 'hover:bg-gray-50 dark:hover:bg-[#111]'
                }`}
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.color}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.subtitle}</p>
                </div>
                <span className="rounded bg-gray-100 dark:bg-[#1a1a1a] px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400">{cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-400 shadow-xl dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
          No results found for "{query}"
        </div>
      )}
    </div>
  );
}
