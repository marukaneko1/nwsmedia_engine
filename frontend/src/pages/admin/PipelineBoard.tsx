import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Badge } from '../../components/ui/Badge';
import { StatsCard } from '../../components/ui/StatsCard';

type Deal = {
  id: string;
  company_name: string;
  contact_name: string;
  stage: string;
  estimated_value: string | number | null;
  close_probability: number | null;
  created_at: string;
  closer_first?: string;
  closer_last?: string;
  assigned_closer_id?: string | null;
};

type PaginatedDeals = { data: Deal[] };

const STAGES = [
  { key: 'discovery', label: 'Discovery', color: 'border-blue-500', bg: 'bg-blue-500', cardBorder: 'border-l-blue-500', badge: 'blue' as const },
  { key: 'proposal_sent', label: 'Proposal Sent', color: 'border-yellow-500', bg: 'bg-yellow-500', cardBorder: 'border-l-yellow-500', badge: 'yellow' as const },
  { key: 'contract_sent', label: 'Contract Sent', color: 'border-purple-500', bg: 'bg-purple-500', cardBorder: 'border-l-purple-500', badge: 'purple' as const },
  { key: 'awaiting_deposit', label: 'Awaiting Deposit', color: 'border-orange-500', bg: 'bg-orange-500', cardBorder: 'border-l-orange-500', badge: 'yellow' as const },
  { key: 'won', label: 'Won', color: 'border-green-500', bg: 'bg-green-500', cardBorder: 'border-l-green-500', badge: 'green' as const },
  { key: 'lost', label: 'Lost', color: 'border-red-500', bg: 'bg-red-500', cardBorder: 'border-l-red-500', badge: 'red' as const },
] as const;

function formatCurrency(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function toNum(value: string | number | null | undefined): number {
  return typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
}

export function AdminPipelineBoard() {
  const navigate = useNavigate();
  const { data, loading, error } = useApiQuery<PaginatedDeals>('/deals?limit=500');

  const deals = data?.data ?? [];

  const grouped = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const s of STAGES) map[s.key] = [];
    for (const d of deals) {
      if (map[d.stage]) map[d.stage].push(d);
    }
    return map;
  }, [deals]);

  const stats = useMemo(() => {
    const total = deals.length;
    const totalValue = deals.reduce((sum, d) => sum + toNum(d.estimated_value), 0);
    const won = grouped['won']?.length ?? 0;
    const lost = grouped['lost']?.length ?? 0;
    const closed = won + lost;
    const winRate = closed > 0 ? ((won / closed) * 100).toFixed(1) : '0.0';
    const avgSize = total > 0 ? totalValue / total : 0;
    return { total, totalValue, avgSize, winRate };
  }, [deals, grouped]);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pipeline Board</h1>
        <p className="mt-1 text-sm text-gray-500">
          Total pipeline value: {loading ? '—' : formatCurrency(stats.totalValue)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Deals" value={loading ? '—' : stats.total} />
        <StatsCard title="Pipeline Value" value={loading ? '—' : formatCurrency(stats.totalValue)} />
        <StatsCard title="Avg Deal Size" value={loading ? '—' : formatCurrency(stats.avgSize)} />
        <StatsCard title="Win Rate" value={loading ? '—' : `${stats.winRate}%`} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageDeals = grouped[stage.key] ?? [];
            const stageValue = stageDeals.reduce((sum, d) => sum + toNum(d.estimated_value), 0);
            return (
              <div key={stage.key} className="min-w-[280px] flex-shrink-0">
                <div className={`rounded-xl border-t-4 ${stage.color} bg-gray-50`}>
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">{stage.label}</h3>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-700">
                        {stageDeals.length}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{formatCurrency(stageValue)}</p>
                  </div>

                  <div className="space-y-3 p-3" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                    {stageDeals.length === 0 && (
                      <p className="py-8 text-center text-xs text-gray-400">No deals</p>
                    )}
                    {stageDeals.map((deal) => {
                      const closer = [deal.closer_first, deal.closer_last].filter(Boolean).join(' ');
                      return (
                        <div
                          key={deal.id}
                          onClick={() => navigate(`/admin/deals/${deal.id}`)}
                          className={`border-l-4 ${stage.cardBorder} p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer`}
                        >
                          <p className="text-sm font-semibold text-gray-900 truncate">{deal.company_name}</p>
                          <p className="mt-0.5 text-xs text-gray-500 truncate">{deal.contact_name}</p>

                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(deal.estimated_value)}
                            </span>
                            {deal.close_probability != null && (
                              <Badge variant={stage.badge}>{deal.close_probability}%</Badge>
                            )}
                          </div>

                          {closer && (
                            <p className="mt-2 text-xs text-gray-500">
                              <span className="font-medium text-gray-600">Closer:</span> {closer}
                            </p>
                          )}

                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(deal.created_at).toLocaleDateString()}
                          </p>
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
    </div>
  );
}
