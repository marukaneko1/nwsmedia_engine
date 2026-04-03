import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatsCard } from '../../components/ui/StatsCard';

type Deal = {
  id: string;
  company_name: string;
  estimated_value: string | number | null;
  actual_value: string | number | null;
  stage: string;
  close_date: string | null;
  created_at: string;
  days_in_pipeline: number | null;
};

type DealsResponse = { data: Deal[]; total: number };
type CommissionsResponse = { total_pending: number };

const KANBAN_STAGES = [
  'discovery',
  'proposal_sent',
  'contract_sent',
  'awaiting_deposit',
  'won',
] as const;

const STAGE_BORDER: Record<string, string> = {
  discovery: 'border-t-4 border-t-blue-500',
  proposal_sent: 'border-t-4 border-t-yellow-400',
  contract_sent: 'border-t-4 border-t-purple-500',
  awaiting_deposit: 'border-t-4 border-t-yellow-400',
  won: 'border-t-4 border-t-green-500',
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  const x = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(x) ? x : 0;
}

function formatStageTitle(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysInPipeline(deal: Deal): number {
  if (deal.days_in_pipeline != null) return deal.days_in_pipeline;
  const created = new Date(deal.created_at).getTime();
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

export function CloserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: dealsRes, loading: dealsLoading, error: dealsError } = useApiQuery<DealsResponse>('/deals?limit=500');
  const { data: commRes } = useApiQuery<CommissionsResponse>('/commissions?limit=1');

  const deals = dealsRes?.data ?? [];

  const stats = useMemo(() => {
    const openStages = new Set(['discovery', 'proposal_sent', 'contract_sent', 'awaiting_deposit']);
    const activeDeals = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
    const pipelineValue = deals
      .filter((d) => openStages.has(d.stage))
      .reduce((sum, d) => sum + num(d.estimated_value), 0);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const wonThisMonth = deals.filter((d) => {
      if (d.stage !== 'won' || !d.close_date) return false;
      const cd = new Date(d.close_date);
      return cd >= startOfMonth && cd <= now;
    });
    const wonThisMonthValue = wonThisMonth.reduce((sum, d) => sum + num(d.actual_value || d.estimated_value), 0);

    return {
      activeCount: activeDeals.length,
      pipelineValue,
      wonThisMonthCount: wonThisMonth.length,
      wonThisMonthValue,
      pendingCommissions: commRes?.total_pending ?? 0,
    };
  }, [deals, commRes?.total_pending]);

  const byStage = useMemo(() => {
    const m = new Map<string, Deal[]>();
    for (const s of KANBAN_STAGES) m.set(s, []);
    for (const d of deals) {
      if (m.has(d.stage)) m.get(d.stage)!.push(d);
    }
    return m;
  }, [deals]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Closer dashboard</h1>
          <p className="mt-1 text-gray-500">
            {user ? `${user.first_name}, here is your pipeline at a glance.` : 'Pipeline overview'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/closer/deals')}>
          Open pipeline table
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Active deals" value={stats.activeCount} subtitle="Excludes won and lost" />
        <StatsCard title="Pipeline value" value={formatCurrency(stats.pipelineValue)} subtitle="Open stages only" />
        <StatsCard
          title="Won this month"
          value={formatCurrency(stats.wonThisMonthValue)}
          subtitle={`${stats.wonThisMonthCount} deal${stats.wonThisMonthCount === 1 ? '' : 's'}`}
        />
        <StatsCard title="Pending commissions" value={formatCurrency(stats.pendingCommissions)} />
      </div>

      <Card title="Pipeline board">
        {dealsError && <p className="text-sm text-red-600">{dealsError}</p>}
        {dealsLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2">
            {KANBAN_STAGES.map((stage) => (
              <div
                key={stage}
                className={`flex w-72 flex-shrink-0 flex-col rounded-lg border border-gray-200 bg-gray-50 ${STAGE_BORDER[stage] ?? ''}`}
              >
                <div className="border-b border-gray-200 bg-white px-3 py-2 rounded-t-lg">
                  <h4 className="text-sm font-semibold text-gray-900">{formatStageTitle(stage)}</h4>
                  <p className="text-xs text-gray-500">{byStage.get(stage)?.length ?? 0} deals</p>
                </div>
                <div className="flex flex-col gap-2 p-2 max-h-[min(70vh,560px)] overflow-y-auto">
                  {(byStage.get(stage) ?? []).map((deal) => (
                    <div
                      key={deal.id}
                      className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                    >
                      <p className="font-medium text-gray-900">{deal.company_name}</p>
                      <p className="mt-1 text-sm text-gray-600">{formatCurrency(num(deal.estimated_value))}</p>
                      <p className="mt-1 text-xs text-gray-500">{daysInPipeline(deal)} days in pipeline</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
