import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../utils/api';
import { StatsCard } from '../../../components/ui/StatsCard';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

type EngineStats = {
  total_leads: string;
  with_email: string;
  hot_leads: string;
  warm_leads: string;
  cool_leads: string;
  cold_leads: string;
  craigslist_leads: string;
  gmaps_leads: string;
  leads_24h: string;
  leads_7d: string;
};

export function EngineOverview() {
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<EngineStats>('/scraper/leads/stats')
      .then(setStats)
      .catch((err) => setError(err.message || 'Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Lead Engine</h1>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Lead Engine</h1>
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-2">Unable to connect to engine database</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">{error}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-4">
              Make sure <code className="text-gray-600 dark:text-gray-300">ENGINE_DATABASE_URL</code> is set in <code className="text-gray-600 dark:text-gray-300">backend/.env</code>
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const s = stats!;
  const num = (v: string) => parseInt(v, 10) || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Lead Engine</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Automated lead scraping and enrichment pipeline</p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Scraped Leads" value={num(s.total_leads).toLocaleString()} subtitle={`${num(s.leads_24h)} in last 24h`} />
        <StatsCard title="With Email" value={num(s.with_email).toLocaleString()} subtitle={`${num(s.total_leads) > 0 ? Math.round((num(s.with_email) / num(s.total_leads)) * 100) : 0}% of total`} />
        <StatsCard title="HOT Leads" value={num(s.hot_leads).toLocaleString()} subtitle={`${num(s.warm_leads)} warm`} />
        <StatsCard title="New This Week" value={num(s.leads_7d).toLocaleString()} />
      </div>

      {/* Tier Breakdown */}
      <Card title="Lead Tiers">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/10">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">HOT</p>
            <p className="text-2xl font-bold text-red-900 dark:text-red-300 mt-1">{num(s.hot_leads).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/40 dark:bg-yellow-900/10">
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">WARM</p>
            <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-300 mt-1">{num(s.warm_leads).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-900/10">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">COOL</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-300 mt-1">{num(s.cool_leads).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-400">COLD</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-300 mt-1">{num(s.cold_leads).toLocaleString()}</p>
          </div>
        </div>
      </Card>

      {/* Source Breakdown + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Lead Sources">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Google Maps</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{num(s.gmaps_leads).toLocaleString()} leads</p>
                </div>
              </div>
              <Link to="/admin/lead-engine/scraper">
                <Button variant="ghost" size="sm">Open Scraper</Button>
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Craigslist</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{num(s.craigslist_leads).toLocaleString()} leads</p>
                </div>
              </div>
              <Link to="/admin/lead-engine/craigslist">
                <Button variant="ghost" size="sm">Open Scraper</Button>
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                  <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Yelp</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Unclaimed local businesses</p>
                </div>
              </div>
              <Link to="/admin/lead-engine/yelp">
                <Button variant="ghost" size="sm">Open Scraper</Button>
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">New Business Filings</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">SoS LLC/Corp incorporations</p>
                </div>
              </div>
              <Link to="/admin/lead-engine/filings">
                <Button variant="ghost" size="sm">Open Importer</Button>
              </Link>
            </div>
          </div>
        </Card>

        <Card title="Quick Actions">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/admin/lead-engine/scraper" className="block">
              <div className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 dark:border-[#1a1a1a] dark:hover:bg-[#111] transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Google Maps Scraper</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Scrape & pipeline</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link to="/admin/lead-engine/craigslist" className="block">
              <div className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 dark:border-[#1a1a1a] dark:hover:bg-[#111] transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Craigslist Scraper</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Services listings</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link to="/admin/lead-engine/yelp" className="block">
              <div className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 dark:border-[#1a1a1a] dark:hover:bg-[#111] transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Yelp Scraper</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Unclaimed businesses</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link to="/admin/lead-engine/filings" className="block">
              <div className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 dark:border-[#1a1a1a] dark:hover:bg-[#111] transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-green-500 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">New Business Filings</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">SoS import + enrich</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link to="/admin/lead-engine/leads" className="block">
              <div className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 dark:border-[#1a1a1a] dark:hover:bg-[#111] transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Scraped Leads</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">View all leads</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link to="/admin/lead-engine/leads?tier=HOT" className="block">
              <div className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 dark:border-[#1a1a1a] dark:hover:bg-[#111] transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">HOT Leads</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{num(s.hot_leads)} ready to contact</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
