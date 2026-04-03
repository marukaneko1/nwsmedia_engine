import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DataTable } from '../../components/ui/DataTable';
import { StatsCard } from '../../components/ui/StatsCard';
import type { Deal, DealStage } from '@nws/shared';

type DealRow = Deal & { closer_first?: string; closer_last?: string };
type PaginatedDeals = { data: DealRow[]; total: number; page: number; pages: number };

function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function stageVariant(stage: DealStage): 'blue' | 'yellow' | 'purple' | 'green' | 'red' | 'gray' {
  switch (stage) {
    case 'won': return 'green';
    case 'lost': return 'red';
    case 'discovery': return 'blue';
    case 'proposal_sent': return 'yellow';
    case 'contract_sent': return 'purple';
    case 'awaiting_deposit': return 'green';
    default: return 'gray';
  }
}

function toNum(value: string | number | null | undefined): number {
  return typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
}

const STAGES = [
  { key: 'discovery', label: 'Discovery', color: 'border-blue-500', cardBorder: 'border-l-blue-500', badge: 'blue' as const },
  { key: 'proposal_sent', label: 'Proposal Sent', color: 'border-yellow-500', cardBorder: 'border-l-yellow-500', badge: 'yellow' as const },
  { key: 'contract_sent', label: 'Contract Sent', color: 'border-purple-500', cardBorder: 'border-l-purple-500', badge: 'purple' as const },
  { key: 'awaiting_deposit', label: 'Awaiting Deposit', color: 'border-orange-500', cardBorder: 'border-l-orange-500', badge: 'yellow' as const },
  { key: 'won', label: 'Won', color: 'border-green-500', cardBorder: 'border-l-green-500', badge: 'green' as const },
  { key: 'lost', label: 'Lost', color: 'border-red-500', cardBorder: 'border-l-red-500', badge: 'red' as const },
] as const;

export function AdminDeals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'board'>('list');
  const { data, loading, error } = useApiQuery<PaginatedDeals>('/deals?limit=500');

  const rows = data?.data ?? [];

  const grouped: Record<string, DealRow[]> = {};
  for (const s of STAGES) grouped[s.key] = [];
  for (const d of rows) { if (grouped[d.stage]) grouped[d.stage].push(d); }

  const totalValue = rows.reduce((sum, d) => sum + toNum(d.estimated_value), 0);
  const won = grouped['won']?.length ?? 0;
  const lost = grouped['lost']?.length ?? 0;
  const closed = won + lost;
  const winRate = closed > 0 ? ((won / closed) * 100).toFixed(1) : '0';

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Deals</h1>
          {user && <p className="text-sm text-gray-500 dark:text-gray-400">Full pipeline visibility &middot; {rows.length} deals</p>}
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-[#0a0a0a] p-1">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === 'list' ? 'bg-white text-gray-900 shadow-sm dark:bg-[#111] dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>
            List
          </button>
          <button
            onClick={() => setView('board')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === 'board' ? 'bg-white text-gray-900 shadow-sm dark:bg-[#111] dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125c-.621 0-1.125.504-1.125 1.125v12.75c0 .621.504 1.125 1.125 1.125z" /></svg>
            Board
          </button>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {view === 'board' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Total Deals" value={loading ? '—' : rows.length} />
            <StatsCard title="Pipeline Value" value={loading ? '—' : formatCurrency(totalValue)} />
            <StatsCard title="Avg Deal Size" value={loading ? '—' : formatCurrency(rows.length > 0 ? totalValue / rows.length : 0)} />
            <StatsCard title="Win Rate" value={loading ? '—' : `${winRate}%`} />
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STAGES.map((stage) => {
                const stageDeals = grouped[stage.key] ?? [];
                const stageValue = stageDeals.reduce((sum, d) => sum + toNum(d.estimated_value), 0);
                return (
                  <div key={stage.key} className="min-w-[280px] flex-shrink-0">
                    <div className={`rounded-xl border-t-4 ${stage.color} bg-gray-50 dark:bg-[#0a0a0a]`}>
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-[#1a1a1a]">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{stage.label}</h3>
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 dark:bg-[#111] text-xs font-medium text-gray-700 dark:text-gray-300">{stageDeals.length}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{formatCurrency(stageValue)}</p>
                      </div>
                      <div className="space-y-3 p-3" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                        {stageDeals.length === 0 && <p className="py-8 text-center text-xs text-gray-400">No deals</p>}
                        {stageDeals.map((deal) => {
                          const closer = [deal.closer_first, deal.closer_last].filter(Boolean).join(' ');
                          return (
                            <div key={deal.id} onClick={() => navigate(`/admin/deals/${deal.id}`)} className={`border-l-4 ${stage.cardBorder} p-4 bg-white dark:bg-[#0a0a0a] rounded-lg shadow-sm border border-gray-200 dark:border-[#1a1a1a] hover:shadow-md transition-shadow cursor-pointer`}>
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{deal.company_name}</p>
                              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">{deal.contact_name}</p>
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(deal.estimated_value)}</span>
                                {deal.close_probability != null && <Badge variant={stage.badge}>{deal.close_probability}%</Badge>}
                              </div>
                              {closer && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400"><span className="font-medium text-gray-600 dark:text-gray-300">Closer:</span> {closer}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {view === 'list' && (
        <Card>
          <DataTable
            loading={loading}
            data={rows}
            emptyMessage="No deals found"
            onRowClick={(d) => navigate(`/admin/deals/${d.id}`)}
            columns={[
              { key: 'company_name', header: 'Company' },
              { key: 'contact_name', header: 'Contact' },
              { key: 'closer', header: 'Closer', render: (d) => [d.closer_first, d.closer_last].filter(Boolean).join(' ') || '—' },
              { key: 'stage', header: 'Stage', render: (d) => <Badge variant={stageVariant(d.stage)}>{d.stage.replace(/_/g, ' ')}</Badge> },
              { key: 'value', header: 'Value', render: (d) => formatCurrency(d.estimated_value ?? d.actual_value) },
              { key: 'close_probability', header: 'Probability', render: (d) => (d.close_probability != null ? `${d.close_probability}%` : '—') },
              { key: 'created_at', header: 'Created', render: (d) => new Date(d.created_at).toLocaleDateString() },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
