import { useMemo } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Card } from '../../components/ui/Card';
import { StatsCard } from '../../components/ui/StatsCard';
import { DataTable } from '../../components/ui/DataTable';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts';

type RevenuePoint = { period: string; revenue: string };
type FunnelStage = { stage: string; count: number; percentage: number };
type Forecast = {
  weighted_pipeline: number;
  avg_close_rate: number;
  projected_monthly_revenue: number;
  deals_by_stage: { stage: string; count: number; value: number }[];
};
type VaRow = {
  id: string;
  first_name: string;
  last_name: string;
  total_leads: string | number;
  total_calls: string | number;
  qualified_leads: string | number;
  conversion_rate: string | number;
  avg_icp_qualified: string | number;
};
type CloserRow = {
  id: string;
  first_name: string;
  last_name: string;
  total_deals: string | number;
  won_deals: string | number;
  lost_deals: string | number;
  win_rate: string | number;
  avg_deal_size: string | number;
  avg_cycle_days: string | number;
};

function formatCurrency(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function toNum(value: string | number | null | undefined): number {
  return typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
}

function formatPct(value: string | number | null | undefined): string {
  return `${toNum(value).toFixed(1)}%`;
}

function formatMonth(period: string): string {
  const d = new Date(period);
  if (isNaN(d.getTime())) return period;
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

const FUNNEL_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#22c55e'];
const STAGE_COLORS: Record<string, string> = {
  discovery: '#3b82f6',
  proposal_sent: '#eab308',
  contract_sent: '#a855f7',
  awaiting_deposit: '#f97316',
  won: '#22c55e',
  lost: '#ef4444',
};

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );
}

export function AdminAnalytics() {
  const revenue = useApiQuery<{ data: RevenuePoint[] }>('/analytics/revenue-timeseries?period=monthly&months=12');
  const funnel = useApiQuery<{ funnel: FunnelStage[] }>('/analytics/conversion-funnel');
  const forecast = useApiQuery<Forecast>('/analytics/forecasting');
  const vaData = useApiQuery<{ data: VaRow[] }>('/analytics/va-effectiveness');
  const closerData = useApiQuery<{ data: CloserRow[] }>('/analytics/closer-metrics');

  const anyLoading = revenue.loading || funnel.loading || forecast.loading || vaData.loading || closerData.loading;
  const errors = [revenue.error, funnel.error, forecast.error, vaData.error, closerData.error].filter(Boolean);

  const revenueChart = useMemo(
    () =>
      (revenue.data?.data ?? []).map((p) => ({
        month: formatMonth(p.period),
        revenue: toNum(p.revenue),
      })),
    [revenue.data],
  );

  const pipelineChart = useMemo(
    () =>
      (forecast.data?.deals_by_stage ?? []).map((s) => ({
        stage: s.stage.replace(/_/g, ' '),
        rawStage: s.stage,
        count: s.count,
        value: s.value,
      })),
    [forecast.data],
  );

  const funnelChart = useMemo(
    () =>
      (funnel.data?.funnel ?? []).map((s) => ({
        stage: s.stage.replace(/_/g, ' '),
        count: s.count,
        percentage: s.percentage,
      })),
    [funnel.data],
  );

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Revenue, pipeline, and team performance</p>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          {errors.map((e, i) => (
            <p key={i} className="text-sm text-red-600">{e}</p>
          ))}
        </div>
      )}

      {/* Forecasting summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard
          title="Weighted Pipeline"
          value={forecast.loading ? '—' : formatCurrency(forecast.data?.weighted_pipeline)}
        />
        <StatsCard
          title="Avg Close Rate"
          value={forecast.loading ? '—' : formatPct(forecast.data?.avg_close_rate)}
        />
        <StatsCard
          title="Projected Monthly Revenue"
          value={forecast.loading ? '—' : formatCurrency(forecast.data?.projected_monthly_revenue)}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Trend */}
        <Card title="Revenue Trend">
          {revenue.loading ? (
            <Spinner />
          ) : revenueChart.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No revenue data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueChart} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Pipeline by Stage */}
        <Card title="Pipeline by Stage">
          {forecast.loading ? (
            <Spinner />
          ) : pipelineChart.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No pipeline data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pipelineChart} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === 'value' ? [formatCurrency(Number(value)), 'Value'] : [String(value), 'Count']
                  }
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                  {pipelineChart.map((entry) => (
                    <Cell key={entry.rawStage} fill={STAGE_COLORS[entry.rawStage] ?? '#6b7280'} fillOpacity={0.7} />
                  ))}
                </Bar>
                <Bar yAxisId="right" dataKey="value" name="Value" radius={[4, 4, 0, 0]}>
                  {pipelineChart.map((entry) => (
                    <Cell key={entry.rawStage} fill={STAGE_COLORS[entry.rawStage] ?? '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Conversion Funnel */}
      <Card title="Conversion Funnel">
        {funnel.loading ? (
          <Spinner />
        ) : funnelChart.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No funnel data</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, funnelChart.length * 50 + 40)}>
            <BarChart data={funnelChart} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} stroke="#9ca3af" width={90} />
              <Tooltip
                formatter={(value, _name, props) => [
                  `${value} (${((props as any)?.payload?.percentage ?? 0).toFixed(1)}%)`,
                  'Count',
                ]}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {funnelChart.map((_entry, i) => (
                  <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* VA Effectiveness */}
      <Card title="VA Effectiveness">
        <DataTable
          loading={vaData.loading}
          data={vaData.data?.data ?? []}
          emptyMessage="No VA data available"
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (r) => `${r.first_name} ${r.last_name}`,
            },
            { key: 'total_leads', header: 'Total Leads', render: (r) => toNum(r.total_leads) },
            { key: 'total_calls', header: 'Calls Made', render: (r) => toNum(r.total_calls) },
            { key: 'qualified_leads', header: 'Qualified Leads', render: (r) => toNum(r.qualified_leads) },
            { key: 'conversion_rate', header: 'Conversion Rate', render: (r) => formatPct(r.conversion_rate) },
            {
              key: 'avg_icp_qualified',
              header: 'Avg ICP Score',
              render: (r) => toNum(r.avg_icp_qualified).toFixed(1),
            },
          ]}
        />
      </Card>

      {/* Closer Performance */}
      <Card title="Closer Performance">
        <DataTable
          loading={closerData.loading}
          data={closerData.data?.data ?? []}
          emptyMessage="No closer data available"
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (r) => `${r.first_name} ${r.last_name}`,
            },
            { key: 'total_deals', header: 'Total Deals', render: (r) => toNum(r.total_deals) },
            { key: 'won_deals', header: 'Won', render: (r) => toNum(r.won_deals) },
            { key: 'lost_deals', header: 'Lost', render: (r) => toNum(r.lost_deals) },
            { key: 'win_rate', header: 'Win Rate', render: (r) => formatPct(r.win_rate) },
            { key: 'avg_deal_size', header: 'Avg Deal Size', render: (r) => formatCurrency(r.avg_deal_size) },
            { key: 'avg_cycle_days', header: 'Avg Cycle (days)', render: (r) => toNum(r.avg_cycle_days) },
          ]}
        />
      </Card>
    </div>
  );
}
