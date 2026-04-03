import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import type { Lead, LeadSource, LeadStage } from '@nws/shared';

type PaginatedLeads = { data: Lead[]; total: number; page: number; pages: number };
type PaginatedUsers = { data: { id: string; first_name: string; last_name: string; role: string }[] };

const PAGE_SIZE = 50;

function sourceVariant(s: LeadSource): 'blue' | 'purple' | 'yellow' | 'green' | 'gray' {
  switch (s) {
    case 'referral': return 'green';
    case 'meta_ad': case 'instagram_dm': return 'purple';
    case 'cold_call': return 'blue';
    default: return 'gray';
  }
}

function stageVariant(stage: LeadStage): 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' {
  switch (stage) {
    case 'qualified': case 'converted': return 'green';
    case 'new': return 'blue';
    case 'contacted': return 'yellow';
    case 'nurture': return 'purple';
    case 'lost': return 'red';
    default: return 'gray';
  }
}

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debouncedValue;
}

function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  const pageNums: (number | '...')[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) pageNums.push(i);
  } else {
    pageNums.push(1);
    if (page > 3) pageNums.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) pageNums.push(i);
    if (page < pages - 2) pageNums.push('...');
    pageNums.push(pages);
  }

  return (
    <div className="flex items-center justify-between border-t px-4 py-3 dark:border-[#1a1a1a]">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {start}–{end} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1}
          className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-[#111]">
          Prev
        </button>
        {pageNums.map((n, i) =>
          n === '...' ? (
            <span key={`e${i}`} className="px-1 text-gray-400">...</span>
          ) : (
            <button key={n} onClick={() => onPage(n)}
              className={`min-w-[2rem] rounded px-2 py-1 text-sm font-medium ${
                n === page
                  ? 'bg-neutral-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#111]'
              }`}>
              {n}
            </button>
          )
        )}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages}
          className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-[#111]">
          Next
        </button>
      </div>
    </div>
  );
}

const LEAD_FIELDS = [
  { value: '', label: '— Skip —' },
  { value: 'full_name', label: 'Full Name (splits into first + last)' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'company_name', label: 'Company' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'industry', label: 'Industry' },
  { value: 'location_city', label: 'City' },
  { value: 'location_state', label: 'State' },
  { value: 'location_zip', label: 'ZIP' },
  { value: 'website_url', label: 'Website URL' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'source', label: 'Source' },
  { value: 'source_detail', label: 'Source Detail / Link' },
  { value: 'utm_source', label: 'UTM Source' },
  { value: 'utm_medium', label: 'UTM Medium' },
  { value: 'utm_campaign', label: 'UTM Campaign' },
  { value: 'company_size_min', label: 'Company Size (Min)' },
  { value: 'company_size_max', label: 'Company Size (Max)' },
  { value: 'estimated_revenue', label: 'Est. Revenue' },
  { value: 'tags', label: 'Tags' },
  { value: 'notes', label: 'Notes' },
];

function DetailField({ label, value, link }: { label: string; value?: string | null; link?: boolean }) {
  if (!value) return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm text-gray-300 dark:text-gray-600">—</p>
    </div>
  );
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      {link ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">{value}</a>
      ) : (
        <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
      )}
    </div>
  );
}

function autoMapByHeader(header: string): string {
  const h = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  const map: Record<string, string> = {
    name: 'full_name', fullname: 'full_name', contactname: 'full_name', contact: 'full_name',
    ownerfullname: 'full_name', ownername: 'full_name', personname: 'full_name', leadname: 'full_name',
    firstname: 'first_name', first: 'first_name', fname: 'first_name', givenname: 'first_name',
    lastname: 'last_name', last: 'last_name', lname: 'last_name', surname: 'last_name', familyname: 'last_name',
    company: 'company_name', companyname: 'company_name', business: 'company_name',
    businessname: 'company_name', organization: 'company_name', org: 'company_name',
    ownerusername: 'company_name', username: 'company_name',
    email: 'email', emailaddress: 'email', mail: 'email', emailid: 'email',
    phone: 'phone', phonenumber: 'phone', tel: 'phone', mobile: 'phone', cell: 'phone',
    telephone: 'phone', cellphone: 'phone', mobilenumber: 'phone', mobilephone: 'phone',
    primaryphone: 'phone', workphone: 'phone',
    industry: 'industry', sector: 'industry', vertical: 'industry', niche: 'industry',
    category: 'industry', businesstype: 'industry', querytag: 'industry', hashtag: 'industry',
    city: 'location_city', locationcity: 'location_city', town: 'location_city',
    state: 'location_state', locationstate: 'location_state', province: 'location_state', region: 'location_state',
    zip: 'location_zip', zipcode: 'location_zip', postalcode: 'location_zip', postal: 'location_zip', locationzip: 'location_zip',
    website: 'website_url', websiteurl: 'website_url', web: 'website_url',
    domain: 'website_url', siteurl: 'website_url', homepage: 'website_url',
    linkedin: 'linkedin_url', linkedinurl: 'linkedin_url', linkedinprofile: 'linkedin_url', linkedinlink: 'linkedin_url',
    source: 'source', leadsource: 'source', origin: 'source',
    sourcedetail: 'source_detail', sourcedescription: 'source_detail', sourceinfo: 'source_detail',
    craigslistlink: 'source_detail', cllink: 'source_detail', postingurl: 'source_detail',
    adlink: 'source_detail', listingurl: 'source_detail', posting: 'source_detail',
    craigslist: 'source_detail', adurl: 'source_detail', listinglink: 'source_detail',
    utmsource: 'utm_source', utmmedium: 'utm_medium', utmcampaign: 'utm_campaign',
    companysize: 'company_size_min', companysizemin: 'company_size_min',
    employees: 'company_size_min', numberofemployees: 'company_size_min',
    teamsize: 'company_size_min', headcount: 'company_size_min', staffcount: 'company_size_min',
    companysizemax: 'company_size_max',
    revenue: 'estimated_revenue', estimatedrevenue: 'estimated_revenue',
    annualrevenue: 'estimated_revenue', yearlyrevenue: 'estimated_revenue', income: 'estimated_revenue',
    tags: 'tags', tag: 'tags', labels: 'tags', keywords: 'tags',
    notes: 'notes', note: 'notes', comments: 'notes', comment: 'notes',
    description: 'notes', caption: 'notes', bio: 'notes', about: 'notes', firstcomment: 'notes',
  };

  if (map[h]) return map[h];

  const raw = header.toLowerCase().trim();
  if (raw.includes('craigslist') || raw.includes('cl link')) return 'source_detail';
  if (raw.includes('linkedin')) return 'linkedin_url';
  if (raw.includes('website') || raw.includes('site url')) return 'website_url';
  if (raw.includes('email')) return 'email';
  if (raw.includes('phone') || raw.includes('cell') || raw.includes('mobile')) return 'phone';
  if (raw.includes('first') && raw.includes('name')) return 'first_name';
  if (raw.includes('last') && raw.includes('name')) return 'last_name';
  if (raw.includes('company') || raw.includes('business')) return 'company_name';
  if (raw.includes('url') || raw.includes('link')) return 'website_url';

  return '';
}

function detectFieldFromData(samples: string[]): string {
  const vals = samples.filter(Boolean).map((v) => String(v).trim());
  if (vals.length === 0) return '';

  const US_STATES = new Set(['al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy','dc']);

  let emails = 0, phones = 0, urls = 0, linkedins = 0, craigslist = 0, states = 0, zips = 0, allNumbers = 0;
  for (const v of vals) {
    const lower = v.toLowerCase();
    if (/@/.test(v) && /\.\w{2,}/.test(v)) emails++;
    if (/^\+?[\d\s()./-]{7,15}$/.test(v.replace(/\s/g, ''))) phones++;
    if (/^https?:\/\//i.test(v) || /\.\w{2,}\//.test(v)) urls++;
    if (lower.includes('linkedin.com')) linkedins++;
    if (lower.includes('craigslist')) craigslist++;
    if (US_STATES.has(lower) || /^[A-Z]{2}$/.test(v)) states++;
    if (/^\d{5}(-\d{4})?$/.test(v)) zips++;
    if (/^[\d,.]+$/.test(v) && v.length <= 12) allNumbers++;
  }

  const threshold = vals.length * 0.5;
  if (emails >= threshold) return 'email';
  if (linkedins >= threshold) return 'linkedin_url';
  if (craigslist >= threshold) return 'source_detail';
  if (phones >= threshold) return 'phone';
  if (states >= threshold) return 'location_state';
  if (zips >= threshold) return 'location_zip';
  if (urls >= threshold) return 'website_url';

  return '';
}

function autoMapColumn(header: string, samples: string[]): string {
  const byHeader = autoMapByHeader(header);
  if (byHeader) return byHeader;
  return detectFieldFromData(samples);
}

export function AdminLeads() {
  const { user } = useAuth();

  // ── Tab state ──────────────────────────────────────────────────
  const [tab, setTab] = useState<'leads' | 'import' | 'distribute'>('leads');

  // ── Leads pagination & search ──────────────────────────────────
  const [leadsPage, setLeadsPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchInput, 300);

  const leadsQuery = useMemo(() => {
    const params = new URLSearchParams({ page: String(leadsPage), limit: String(PAGE_SIZE) });
    if (debouncedSearch) params.set('search', debouncedSearch);
    return `/leads?${params}`;
  }, [leadsPage, debouncedSearch]);

  const { data, loading, error, refetch } = useApiQuery<PaginatedLeads>(leadsQuery);

  useEffect(() => { setLeadsPage(1); }, [debouncedSearch]);

  // ── Distribute pagination ──────────────────────────────────────
  const [distPage, setDistPage] = useState(1);
  const [distSearch, setDistSearch] = useState('');
  const debouncedDistSearch = useDebounce(distSearch, 300);

  const distQuery = useMemo(() => {
    const params = new URLSearchParams({ page: String(distPage), limit: String(PAGE_SIZE), unassigned: 'true' });
    if (debouncedDistSearch) params.set('search', debouncedDistSearch);
    return `/leads?${params}`;
  }, [distPage, debouncedDistSearch]);

  const { data: distData, loading: distLoading, refetch: distRefetch } = useApiQuery<PaginatedLeads>(distQuery);

  useEffect(() => { setDistPage(1); }, [debouncedDistSearch]);

  // ── VA data ────────────────────────────────────────────────────
  const { data: vaData } = useApiQuery<PaginatedUsers>('/users?role=va&limit=200');

  const vaMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of vaData?.data ?? []) m.set(u.id, `${u.first_name} ${u.last_name}`);
    return m;
  }, [vaData]);

  const vaOptions = useMemo(() => [
    { value: '', label: 'Select VA...' },
    ...(vaData?.data ?? []).map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name}` })),
  ], [vaData]);

  const rows = data?.data ?? [];
  const totalLeads = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;
  const distRows = distData?.data ?? [];
  const distTotal = distData?.total ?? 0;
  const distTotalPages = distData?.pages ?? 1;

  // ── Import state ───────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; duplicates: number; errors: number } | null>(null);

  const handleFile = useCallback((file: File) => {
    setImportResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
      if (json.length === 0) return;
      const headers = Object.keys(json[0]);
      setRawHeaders(headers);
      setRawRows(json);
      const autoMap: Record<string, string> = {};
      for (const h of headers) {
        const samples = json.slice(0, 20).map((r) => String(r[h] ?? ''));
        autoMap[h] = autoMapColumn(h, samples);
      }
      setColumnMap(autoMap);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const includedHeaders = useMemo(() => rawHeaders.filter((h) => columnMap[h]), [rawHeaders, columnMap]);
  const mappedCount = includedHeaders.length;

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const leads = rawRows.map((row) => {
        const obj: Record<string, string> = {};
        for (const [header, field] of Object.entries(columnMap)) {
          if (!field || !row[header]) continue;
          if (field === 'full_name') {
            const parts = row[header].trim().split(/\s+/);
            obj.first_name = obj.first_name || parts[0] || '';
            obj.last_name = obj.last_name || parts.slice(1).join(' ') || '';
          } else {
            obj[field] = row[header];
          }
        }
        return obj;
      });
      const res = await api.post<{ results: { created: number; duplicates: number; errors: number } }>('/leads/import', {
        leads,
        source: 'csv_import',
      });
      setImportResult(res.results);
      refetch(); distRefetch();
    } catch {
      setImportResult({ created: 0, duplicates: 0, errors: rawRows.length });
    }
    setImporting(false);
  };

  const resetImport = () => {
    setFileName('');
    setRawHeaders([]);
    setRawRows([]);
    setColumnMap({});
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Distribute state ──────────────────────────────────────────
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [distributeVaIds, setDistributeVaIds] = useState<string[]>([]);
  const [distributing, setDistributing] = useState(false);
  const [distributeResult, setDistributeResult] = useState<{ updated: number } | null>(null);
  const [assignModal, setAssignModal] = useState(false);
  const [assignVaId, setAssignVaId] = useState('');

  const toggleLead = (id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => {
    if (selectedLeadIds.size === distRows.length && distRows.length > 0) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(distRows.map((l) => l.id)));
    }
  };

  const handleDistribute = async () => {
    if (selectedLeadIds.size === 0 || distributeVaIds.length === 0) return;
    setDistributing(true);
    setDistributeResult(null);
    try {
      const res = await api.post<{ updated: number }>('/leads/distribute', {
        lead_ids: Array.from(selectedLeadIds),
        va_ids: distributeVaIds,
      });
      setDistributeResult(res);
      setSelectedLeadIds(new Set());
      refetch(); distRefetch();
    } catch { /* silent */ }
    setDistributing(false);
  };

  const handleBulkAssign = async () => {
    if (selectedLeadIds.size === 0 || !assignVaId) return;
    setDistributing(true);
    try {
      await api.post('/leads/bulk-assign', {
        assignments: [{ lead_ids: Array.from(selectedLeadIds), va_id: assignVaId }],
      });
      setSelectedLeadIds(new Set());
      setAssignModal(false);
      refetch(); distRefetch();
    } catch { /* silent */ }
    setDistributing(false);
  };

  const toggleDistributeVa = (vaId: string) => {
    setDistributeVaIds((prev) => prev.includes(vaId) ? prev.filter((id) => id !== vaId) : [...prev, vaId]);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Leads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{totalLeads.toLocaleString()} total leads</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-[#0a0a0a]">
        {([
          { key: 'leads' as const, label: 'All Leads', count: totalLeads },
          { key: 'import' as const, label: 'Import Leads', count: null },
          { key: 'distribute' as const, label: 'Distribute', count: distTotal },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-[#111] dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t.label}{t.count !== null ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {/* ── All Leads Tab ──────────────────────────────────────── */}
      {tab === 'leads' && (
        <Card>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by name, company, email, phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-200 dark:placeholder-gray-500"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              {debouncedSearch ? 'No leads match your search.' : 'No leads yet. Import some from the Import tab.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-[#0a0a0a]">
                    <tr>
                      <th className="w-8 px-2 py-3"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Company</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">ICP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Stage</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Assigned VA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {rows.map((l) => {
                      const isExpanded = expandedLeadId === l.id;
                      return (
                        <>
                          <tr
                            key={l.id}
                            onClick={() => setExpandedLeadId(isExpanded ? null : l.id)}
                            className={`cursor-pointer transition-colors ${isExpanded ? 'bg-gray-50 dark:bg-[#111]' : 'hover:bg-gray-50 dark:hover:bg-[#111]'}`}
                          >
                            <td className="w-8 px-2 py-3 text-gray-400">
                              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{l.company_name || '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{[l.first_name, l.last_name].filter(Boolean).join(' ') || '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{l.phone || '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{l.email || '—'}</td>
                            <td className="px-4 py-3"><Badge variant={sourceVariant(l.source)}>{l.source.replace(/_/g, ' ')}</Badge></td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{l.icp_score != null ? String(l.icp_score) : '—'}</td>
                            <td className="px-4 py-3"><Badge variant={stageVariant(l.stage)}>{l.stage}</Badge></td>
                            <td className="px-4 py-3 text-sm">{l.assigned_va_id ? vaMap.get(l.assigned_va_id) ?? '—' : <span className="text-gray-400">Unassigned</span>}</td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${l.id}-detail`} className="bg-gray-50/50 dark:bg-[#0a0a0a]">
                              <td colSpan={9} className="px-6 py-4">
                                <div className="grid grid-cols-2 gap-x-12 gap-y-3 md:grid-cols-3 lg:grid-cols-4">
                                  <DetailField label="First Name" value={l.first_name} />
                                  <DetailField label="Last Name" value={l.last_name} />
                                  <DetailField label="Company" value={l.company_name} />
                                  <DetailField label="Phone" value={l.phone} />
                                  <DetailField label="Email" value={l.email} />
                                  <DetailField label="Industry" value={l.industry} />
                                  <DetailField label="City" value={l.location_city} />
                                  <DetailField label="State" value={l.location_state} />
                                  <DetailField label="ZIP" value={l.location_zip} />
                                  <DetailField label="Website" value={l.website_url} link />
                                  <DetailField label="LinkedIn" value={l.linkedin_url} link />
                                  <DetailField label="Source" value={l.source} />
                                  <DetailField label="Source Detail" value={l.source_detail} />
                                  <DetailField label="UTM Source" value={l.utm_source} />
                                  <DetailField label="UTM Medium" value={l.utm_medium} />
                                  <DetailField label="UTM Campaign" value={l.utm_campaign} />
                                  <DetailField label="Company Size" value={
                                    l.company_size_min != null || l.company_size_max != null
                                      ? `${l.company_size_min ?? '?'}–${l.company_size_max ?? '?'}`
                                      : undefined
                                  } />
                                  <DetailField label="Est. Revenue" value={l.estimated_revenue != null ? `$${Number(l.estimated_revenue).toLocaleString()}` : undefined} />
                                  <DetailField label="ICP Score" value={l.icp_score != null ? String(l.icp_score) : undefined} />
                                  <DetailField label="Stage" value={l.stage} />
                                  <DetailField label="Contact Attempts" value={String(l.contact_attempts ?? 0)} />
                                  <DetailField label="Last Contacted" value={l.last_contacted_at ? new Date(l.last_contacted_at).toLocaleString() : undefined} />
                                  <DetailField label="Next Follow-up" value={l.next_followup_at ? new Date(l.next_followup_at).toLocaleString() : undefined} />
                                  <DetailField label="Tags" value={l.tags?.length ? l.tags.join(', ') : undefined} />
                                  <DetailField label="Created" value={new Date(l.created_at).toLocaleString()} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={leadsPage} pages={totalPages} total={totalLeads} onPage={setLeadsPage} />
            </>
          )}
        </Card>
      )}

      {/* ── Import Tab ─────────────────────────────────────────── */}
      {tab === 'import' && (
        <div className="space-y-6">
          {/* Upload area */}
          {rawRows.length === 0 ? (
            <Card>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center transition-colors hover:border-neutral-400 hover:bg-neutral-50/30 dark:border-[#262626] dark:bg-[#0a0a0a] dark:hover:border-neutral-500"
              >
                <svg className="mb-4 h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                  Drop your CSV or Excel file here
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">or click to browse</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={onFileChange}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  style={{ position: 'relative', marginTop: '1rem', width: 'auto' }}
                />
                <Button variant="secondary" className="mt-4" onClick={() => fileRef.current?.click()}>
                  Choose File
                </Button>
                <p className="mt-3 text-xs text-gray-400">Supports .csv, .xlsx, .xls</p>
              </div>
            </Card>
          ) : (
            <>
              {/* File info bar */}
              <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                    <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{fileName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{rawRows.length} rows &middot; {rawHeaders.length} columns &middot; {mappedCount} selected</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={resetImport}>Remove</Button>
              </div>

              {/* Data preview with column checkboxes */}
              <Card title="Data Preview">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Check the columns you want to import. {mappedCount} of {rawHeaders.length} columns selected.
                </p>
                <div className="overflow-x-auto rounded-lg border dark:border-[#1a1a1a]" style={{ maxHeight: '28rem' }}>
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#0a0a0a]">
                      <tr className="border-b dark:border-[#1a1a1a]">
                        {rawHeaders.map((header) => {
                          const isChecked = !!columnMap[header];
                          const mappedField = LEAD_FIELDS.find((f) => f.value === columnMap[header]);
                          return (
                            <th key={header} className="px-3 py-2 text-left whitespace-nowrap">
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setColumnMap((prev) => {
                                      const next = { ...prev };
                                      if (next[header]) {
                                        next[header] = '';
                                      } else {
                                        const samples = rawRows.slice(0, 20).map((r) => String(r[header] ?? ''));
                                        next[header] = autoMapColumn(header, samples) || 'first_name';
                                      }
                                      return next;
                                    });
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-neutral-700 focus:ring-neutral-500 dark:border-[#262626] dark:bg-[#111]"
                                />
                                <span className="flex flex-col leading-tight">
                                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{header}</span>
                                  {isChecked && mappedField && (
                                    <select
                                      value={columnMap[header] || ''}
                                      onChange={(e) => { e.stopPropagation(); setColumnMap((prev) => ({ ...prev, [header]: e.target.value })); }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-0.5 rounded border border-green-300 bg-green-50 px-1 py-0.5 text-[10px] font-medium text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
                                    >
                                      {LEAD_FIELDS.filter((f) => f.value).map((f) => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                      ))}
                                    </select>
                                  )}
                                </span>
                              </label>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b dark:border-[#1a1a1a] hover:bg-gray-50/50 dark:hover:bg-[#111]">
                          {rawHeaders.map((header) => (
                            <td
                              key={header}
                              className={`px-3 py-1.5 truncate max-w-[220px] ${
                                columnMap[header]
                                  ? 'text-gray-800 dark:text-gray-200'
                                  : 'text-gray-400 dark:text-gray-600'
                              }`}
                              title={row[header] || ''}
                            >
                              {row[header] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Previewing 5 of {rawRows.length} rows. Unchecked columns will be skipped. Click the green label to change what a column maps to.
                </p>
              </Card>

              {/* Import result */}
              {importResult && (
                <div className={`rounded-lg border p-4 ${importResult.created > 0 ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${importResult.created > 0 ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
                      {importResult.created > 0 ? (
                        <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {importResult.created} leads imported
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {importResult.duplicates > 0 && `${importResult.duplicates} duplicates skipped. `}
                        {importResult.errors > 0 && `${importResult.errors} errors.`}
                      </p>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <Button variant="secondary" size="sm" onClick={resetImport}>Import More</Button>
                      <Button size="sm" onClick={() => setTab('distribute')}>Distribute Leads</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Import button */}
              {!importResult && (
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={resetImport}>Cancel</Button>
                  <Button onClick={handleImport} disabled={importing || mappedCount === 0}>
                    {importing ? 'Importing...' : `Import ${rawRows.length} Leads`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Distribute Tab ─────────────────────────────────────── */}
      {tab === 'distribute' && (
        <div className="space-y-6">
          {/* VA selector */}
          <Card title="Select Sales Reps to Distribute To">
            <div className="flex flex-wrap gap-2">
              {(vaData?.data ?? []).map((va) => {
                const selected = distributeVaIds.includes(va.id);
                return (
                  <button
                    key={va.id}
                    onClick={() => toggleDistributeVa(va.id)}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-neutral-500 bg-neutral-50 text-neutral-800 ring-2 ring-neutral-200 dark:border-neutral-700 dark:bg-[#111] dark:text-white dark:ring-neutral-800'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 dark:border-[#262626] dark:text-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      selected ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-600 dark:bg-[#111] dark:text-gray-400'
                    }`}>
                      {va.first_name[0]}{va.last_name[0]}
                    </div>
                    <div className="text-left">
                      <p>{va.first_name} {va.last_name}</p>
                    </div>
                    {selected && (
                      <svg className="h-5 w-5 text-neutral-700 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Unassigned leads table */}
          <Card title={`Unassigned Leads (${distTotal.toLocaleString()})`} action={
            <div className="flex gap-2">
              {selectedLeadIds.size > 0 && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => { setAssignVaId(''); setAssignModal(true); }}>
                    Assign to One VA ({selectedLeadIds.size})
                  </Button>
                  <Button size="sm" onClick={handleDistribute} disabled={distributing || distributeVaIds.length === 0}>
                    {distributing ? 'Distributing...' : `Distribute Evenly (${selectedLeadIds.size} → ${distributeVaIds.length} VAs)`}
                  </Button>
                </>
              )}
            </div>
          }>
            {distributeResult && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                {distributeResult.updated} leads distributed successfully.
              </div>
            )}

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search unassigned leads..."
                value={distSearch}
                onChange={(e) => setDistSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-200 dark:placeholder-gray-500"
              />
            </div>

            {distLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
              </div>
            ) : distRows.length === 0 ? (
              <p className="py-8 text-center text-gray-500 dark:text-gray-400">
                {debouncedDistSearch ? 'No unassigned leads match your search.' : 'All leads are assigned. Import more from the Import tab.'}
              </p>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.size === distRows.length && distRows.length > 0}
                      onChange={selectAll}
                      className="rounded border-gray-300"
                    />
                    Select all on this page ({distRows.length})
                  </label>
                  {selectedLeadIds.size > 0 && (
                    <span className="text-sm font-medium text-neutral-700 dark:text-white">{selectedLeadIds.size} selected</span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-[#0a0a0a]">
                      <tr>
                        <th className="w-10 px-3 py-3"></th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Company</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Contact</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Source</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">ICP</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {distRows.map((l) => (
                        <tr key={l.id} className={`cursor-pointer transition-colors ${selectedLeadIds.has(l.id) ? 'bg-neutral-50 dark:bg-[#111]' : 'hover:bg-gray-50 dark:hover:bg-[#111]'}`} onClick={() => toggleLead(l.id)}>
                          <td className="w-10 px-3 py-3">
                            <input type="checkbox" checked={selectedLeadIds.has(l.id)} onChange={() => toggleLead(l.id)} className="rounded border-gray-300" />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{l.company_name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{[l.first_name, l.last_name].filter(Boolean).join(' ') || l.email || '—'}</td>
                          <td className="px-4 py-3"><Badge variant={sourceVariant(l.source)}>{l.source.replace(/_/g, ' ')}</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{l.icp_score ?? '—'}</td>
                          <td className="px-4 py-3"><Badge variant={stageVariant(l.stage)}>{l.stage}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={distPage} pages={distTotalPages} total={distTotal} onPage={setDistPage} />
              </>
            )}
          </Card>
        </div>
      )}

      {/* Assign to single VA modal */}
      <Modal open={assignModal} onClose={() => setAssignModal(false)} title={`Assign ${selectedLeadIds.size} Leads`}>
        <div className="space-y-4">
          <Select label="Select VA" options={vaOptions} value={assignVaId} onChange={(e) => setAssignVaId(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignModal(false)}>Cancel</Button>
            <Button onClick={handleBulkAssign} disabled={!assignVaId || distributing}>
              {distributing ? 'Assigning...' : 'Assign'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
