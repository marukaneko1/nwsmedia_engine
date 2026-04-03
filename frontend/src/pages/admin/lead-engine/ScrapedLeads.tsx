import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../utils/api';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';

type Lead = {
  id: string;
  name: string;
  category: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  website: string;
  rating: number;
  review_count: number;
  source_channel: string;
  score: number | null;
  tier: string | null;
  segment: string | null;
  triage_status: string | null;
  scraped_at: string;
};

type LeadsResponse = {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const TIER_OPTIONS = [
  { value: '', label: 'All Tiers' },
  { value: 'HOT', label: 'HOT' },
  { value: 'WARM', label: 'WARM' },
  { value: 'COOL', label: 'COOL' },
  { value: 'COLD', label: 'COLD' },
  { value: 'SKIP', label: 'Skip' },
];

const SEGMENT_OPTIONS = [
  { value: '', label: 'All Segments' },
  { value: 'ESTABLISHED', label: 'Established' },
  { value: 'NEW_SMALL', label: 'New / Small' },
];

const EMAIL_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'has', label: 'Has Email' },
  { value: 'no', label: 'No Email' },
];

const TRIAGE_OPTIONS = [
  { value: '', label: 'All Triage' },
  { value: 'HAS_WEBSITE', label: 'Has Website' },
  { value: 'NO_WEBSITE', label: 'No Website' },
  { value: 'DEAD_WEBSITE', label: 'Dead Website' },
  { value: 'FREE_SUBDOMAIN', label: 'Free Subdomain' },
  { value: 'PAGE_BUILDER', label: 'Page Builder' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'google_maps', label: 'Google Maps' },
  { value: 'craigslist', label: 'Craigslist' },
  { value: 'yelp', label: 'Yelp' },
  { value: 'sos_fl', label: 'FL Filings' },
  { value: 'sos_tx', label: 'TX Filings' },
];

function tierBadgeVariant(tier: string | null): 'red' | 'yellow' | 'blue' | 'gray' {
  switch (tier) {
    case 'HOT': return 'red';
    case 'WARM': return 'yellow';
    case 'COOL': return 'blue';
    default: return 'gray';
  }
}

function segmentBadgeVariant(segment: string | null): 'green' | 'purple' | 'gray' {
  switch (segment) {
    case 'ESTABLISHED': return 'green';
    case 'NEW_SMALL': return 'purple';
    default: return 'gray';
  }
}

export function ScrapedLeads() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<string[]>([]);

  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('q') || '';
  const city = searchParams.get('city') || '';
  const tier = searchParams.get('tier') || '';
  const segment = searchParams.get('segment') || '';
  const email = searchParams.get('email') || '';
  const triage = searchParams.get('triage') || '';
  const source = searchParams.get('source') || '';

  const updateParam = useCallback((key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.set('page', '1');
      return next;
    });
  }, [setSearchParams]);

  useEffect(() => {
    api.get<string[]>('/scraper/leads/cities').then(setCities).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '100');
    if (search) params.set('q', search);
    if (city) params.set('city', city);
    if (tier) params.set('tier', tier);
    if (segment) params.set('segment', segment);
    if (email) params.set('email', email);
    if (triage) params.set('triage', triage);
    if (source) params.set('source', source);

    api.get<LeadsResponse>(`/scraper/leads?${params.toString()}`)
      .then((data) => {
        setLeads(data.leads);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, city, tier, segment, email, triage, source]);

  const cityOptions = [{ value: '', label: 'All Cities' }, ...cities.map((c) => ({ value: c, label: c }))];

  const columns = [
    {
      key: 'name',
      header: 'Business',
      render: (lead: Lead) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{lead.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{lead.category}</p>
        </div>
      ),
    },
    { key: 'city', header: 'City', render: (lead: Lead) => `${lead.city || ''}${lead.state ? `, ${lead.state}` : ''}` },
    {
      key: 'score',
      header: 'Score',
      render: (lead: Lead) => (
        <span className="font-mono text-sm font-medium tabular-nums">{lead.score ?? '\u2014'}</span>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      render: (lead: Lead) => lead.tier ? <Badge variant={tierBadgeVariant(lead.tier)}>{lead.tier}</Badge> : <span className="text-gray-400">\u2014</span>,
    },
    {
      key: 'segment',
      header: 'Segment',
      render: (lead: Lead) => lead.segment ? <Badge variant={segmentBadgeVariant(lead.segment)}>{lead.segment.replace('_', ' ')}</Badge> : <span className="text-gray-400">\u2014</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (lead: Lead) => lead.email ? (
        <span className="text-sm text-gray-700 dark:text-gray-300">{lead.email}</span>
      ) : (
        <span className="text-gray-400">\u2014</span>
      ),
    },
    {
      key: 'triage_status',
      header: 'Triage',
      render: (lead: Lead) => lead.triage_status ? (
        <span className="text-xs text-gray-600 dark:text-gray-400">{lead.triage_status.replace(/_/g, ' ')}</span>
      ) : (
        <span className="text-gray-400">\u2014</span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Scraped Leads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{total.toLocaleString()} total leads</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search"
            placeholder="Name, category, email..."
            value={search}
            onChange={(e) => updateParam('q', e.target.value)}
          />
          <Select label="City" options={cityOptions} value={city} onChange={(e) => updateParam('city', e.target.value)} />
          <Select label="Tier" options={TIER_OPTIONS} value={tier} onChange={(e) => updateParam('tier', e.target.value)} />
          <Select label="Segment" options={SEGMENT_OPTIONS} value={segment} onChange={(e) => updateParam('segment', e.target.value)} />
          <Select label="Email" options={EMAIL_OPTIONS} value={email} onChange={(e) => updateParam('email', e.target.value)} />
          <Select label="Triage" options={TRIAGE_OPTIONS} value={triage} onChange={(e) => updateParam('triage', e.target.value)} />
          <Select label="Source" options={SOURCE_OPTIONS} value={source} onChange={(e) => updateParam('source', e.target.value)} />
          {(search || city || tier || segment || email || triage || source) && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={() => setSearchParams({})}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        <DataTable
          columns={columns}
          data={leads}
          loading={loading}
          emptyMessage="No leads found matching your filters"
          onRowClick={(lead) => navigate(`/admin/lead-engine/leads/${lead.id}`)}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-[#1a1a1a]">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages} ({total.toLocaleString()} leads)
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParam('page', String(page - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateParam('page', String(page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
