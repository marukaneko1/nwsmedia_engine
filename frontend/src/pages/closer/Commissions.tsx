import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DataTable } from '../../components/ui/DataTable';
import { StatsCard } from '../../components/ui/StatsCard';

type CommissionRow = {
  id: string;
  deal_company: string | null;
  commission_type: string;
  commission_amount: string | number;
  commission_percentage: string | number | null;
  status: string;
  created_at: string;
  triggered_at?: string | null;
};

type CommissionsResponse = {
  data: CommissionRow[];
  total_pending: number;
  total_paid: number;
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

function statusVariant(
  status: string
): 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' {
  switch (status) {
    case 'paid':
      return 'green';
    case 'pending':
      return 'yellow';
    case 'approved':
      return 'blue';
    case 'voided':
      return 'red';
    default:
      return 'gray';
  }
}

export function CloserCommissions() {
  const { user } = useAuth();
  const { data, loading, error } = useApiQuery<CommissionsResponse>('/commissions?limit=200');

  const rows = data?.data ?? [];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
        <p className="mt-1 text-gray-500">
          {user ? `${user.first_name}'s earnings by deal` : 'Your earnings by deal'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatsCard title="Pending" value={formatCurrency(data?.total_pending ?? 0)} />
        <StatsCard title="Paid (all time)" value={formatCurrency(data?.total_paid ?? 0)} />
      </div>

      <Card>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <DataTable<CommissionRow>
          loading={loading}
          data={rows}
          emptyMessage="No commission records yet"
          columns={[
            {
              key: 'deal_company',
              header: 'Deal company',
              render: (c) => c.deal_company || '—',
            },
            {
              key: 'commission_type',
              header: 'Type',
              render: (c) => c.commission_type.replace(/_/g, ' '),
            },
            {
              key: 'commission_amount',
              header: 'Amount',
              render: (c) => formatCurrency(num(c.commission_amount)),
            },
            {
              key: 'commission_percentage',
              header: '%',
              render: (c) => (c.commission_percentage != null ? `${num(c.commission_percentage)}%` : '—'),
            },
            {
              key: 'status',
              header: 'Status',
              render: (c) => (
                <Badge variant={statusVariant(c.status)}>{c.status.replace(/_/g, ' ')}</Badge>
              ),
            },
            {
              key: 'date',
              header: 'Date',
              render: (c) => {
                const raw = c.triggered_at || c.created_at;
                return raw ? new Date(raw).toLocaleDateString() : '—';
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
