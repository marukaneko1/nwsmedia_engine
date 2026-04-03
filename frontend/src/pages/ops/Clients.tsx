import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DataTable } from '../../components/ui/DataTable';
import type { Client, ProjectStatus } from '@nws/shared';

type ClientsResponse = { data: Client[]; total: number; page: number; pages: number };

function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function statusVariant(s: ProjectStatus): 'green' | 'yellow' | 'blue' | 'gray' | 'red' {
  switch (s) {
    case 'complete':
      return 'green';
    case 'in_progress':
      return 'blue';
    case 'revision_requested':
    case 'awaiting_approval':
      return 'yellow';
    case 'paused':
      return 'red';
    default:
      return 'gray';
  }
}

export function OpsClients() {
  const { user } = useAuth();
  const { data, loading, error } = useApiQuery<ClientsResponse>('/clients?limit=100');

  const rows = data?.data ?? [];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        {user && <p className="text-sm text-gray-500">Accounts on your ops queue</p>}
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <Card>
        <DataTable
          loading={loading}
          data={rows}
          emptyMessage="No clients assigned"
          columns={[
            { key: 'company_name', header: 'Company' },
            { key: 'contact_name', header: 'Contact' },
            {
              key: 'services_contracted',
              header: 'Services',
              render: (c) => (
                <div className="flex max-w-xs flex-wrap gap-1">
                  {(c.services_contracted ?? []).length === 0 ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    c.services_contracted!.map((s) => (
                      <Badge key={s} variant="purple">
                        {s.replace(/_/g, ' ')}
                      </Badge>
                    ))
                  )}
                </div>
              ),
            },
            {
              key: 'total_paid',
              header: 'Total paid',
              render: (c) => formatCurrency(c.total_paid),
            },
            {
              key: 'balance_due',
              header: 'Balance due',
              render: (c) => formatCurrency(c.balance_due),
            },
            {
              key: 'project_status',
              header: 'Status',
              render: (c) => <Badge variant={statusVariant(c.project_status)}>{c.project_status.replace(/_/g, ' ')}</Badge>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
