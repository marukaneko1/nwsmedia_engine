import { useApiQuery } from '../../hooks/useApiQuery';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DataTable } from '../../components/ui/DataTable';

interface CommissionRow {
  id: string;
  deal_company: string | null;
  commission_amount: string | number;
  status: string;
  triggered_at: string | null;
}

interface CommissionsResponse {
  data: CommissionRow[];
  total: number;
  total_pending: number;
  total_paid: number;
}

function formatCurrency(n: number | string | null | undefined) {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (num == null || Number.isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function statusVariant(status: string): 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' {
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

export function VACommissions() {
  const { data, loading, error } = useApiQuery<CommissionsResponse>('/commissions?limit=100');

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
        <p className="mt-1 text-gray-600">Your commission history from closed deals and triggers.</p>
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="text-sm font-medium text-gray-500">Pending</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(data.total_pending)}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500">Paid</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(data.total_paid)}</p>
          </Card>
        </div>
      )}

      <Card title="Commission records">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <DataTable<CommissionRow>
          loading={loading}
          data={data?.data ?? []}
          emptyMessage="No commissions yet."
          columns={[
            {
              key: 'deal_company',
              header: 'Deal / company',
              render: (row) => row.deal_company || '—',
            },
            {
              key: 'commission_amount',
              header: 'Amount',
              render: (row) => formatCurrency(row.commission_amount),
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
            },
            {
              key: 'triggered_at',
              header: 'Triggered',
              render: (row) => formatDate(row.triggered_at),
            },
          ]}
        />
      </Card>
    </div>
  );
}
