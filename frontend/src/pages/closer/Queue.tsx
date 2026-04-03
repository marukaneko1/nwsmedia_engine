import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';

type Deal = {
  id: string;
  company_name: string;
  va_first?: string | null;
  va_last?: string | null;
  pain_point?: string | null;
  budget_range_min?: string | number | null;
  budget_range_max?: string | number | null;
  created_at: string;
  stage: string;
};

type DealsResponse = { data: Deal[] };

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

export function CloserQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error } = useApiQuery<DealsResponse>('/deals?stage=discovery&limit=200');

  const rows = useMemo(() => {
    const list = (data?.data ?? []).filter((d) => d.stage === 'discovery');
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [data?.data]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Qualified leads queue</h1>
        <p className="mt-1 text-gray-500">
          {user
            ? `Handoffs for ${user.first_name} — discovery-stage deals from VAs`
            : 'Recent discovery-stage deals handed off from VAs'}
        </p>
      </div>

      <Card>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <DataTable<Deal>
          loading={loading}
          data={rows}
          emptyMessage="No qualified leads in queue"
          onRowClick={(d) => navigate(`/closer/deals/${d.id}`)}
          columns={[
            {
              key: 'company_name',
              header: 'Company',
              render: (d) => <span className="font-medium text-gray-900">{d.company_name}</span>,
            },
            {
              key: 'va',
              header: 'VA who qualified',
              render: (d) => {
                const name = [d.va_first, d.va_last].filter(Boolean).join(' ');
                return name || '—';
              },
            },
            {
              key: 'pain_point',
              header: 'Pain point',
              render: (d) => (
                <span className="max-w-xs truncate block" title={d.pain_point ?? undefined}>
                  {d.pain_point || '—'}
                </span>
              ),
            },
            {
              key: 'budget',
              header: 'Budget range',
              render: (d) =>
                d.budget_range_min != null || d.budget_range_max != null
                  ? `${formatCurrency(num(d.budget_range_min))} – ${formatCurrency(num(d.budget_range_max))}`
                  : '—',
            },
            {
              key: 'created_at',
              header: 'Handoff date',
              render: (d) => new Date(d.created_at).toLocaleDateString(),
            },
            {
              key: 'go',
              header: '',
              className: 'w-28',
              render: (d) => (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/closer/deals/${d.id}`);
                  }}
                >
                  Open deal
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
