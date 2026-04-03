import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../utils/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DataTable } from '../../components/ui/DataTable';
import type { CommissionStatus, CommissionType, UserRole } from '@nws/shared';

type CommissionRow = {
  id: string;
  first_name?: string;
  last_name?: string;
  user_role?: UserRole;
  deal_company?: string;
  commission_type: CommissionType;
  commission_amount: number | string;
  commission_percentage?: number | string | null;
  status: CommissionStatus;
  triggered_at?: string;
};

type CommissionsResponse = {
  data: CommissionRow[];
  total: number;
  page: number;
  pages: number;
  total_pending: number;
  total_paid: number;
};

function formatCurrency(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function roleBadgeVariant(role: UserRole | undefined): 'blue' | 'purple' | 'yellow' | 'red' | 'gray' {
  switch (role) {
    case 'va':
      return 'blue';
    case 'closer':
      return 'purple';
    case 'ops':
      return 'yellow';
    case 'admin':
      return 'red';
    default:
      return 'gray';
  }
}

function commissionStatusVariant(status: CommissionStatus): 'yellow' | 'blue' | 'green' | 'red' {
  switch (status) {
    case 'pending':
      return 'yellow';
    case 'approved':
      return 'blue';
    case 'paid':
      return 'green';
    case 'voided':
      return 'red';
    default:
      return 'yellow';
  }
}

export function AdminCommissions() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useApiQuery<CommissionsResponse>('/commissions?limit=100');
  const [selectedApproved, setSelectedApproved] = useState<Set<string>>(new Set());
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = data?.data ?? [];

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedApproved((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const approve = async (id: string) => {
    setActionError(null);
    try {
      await api.patch(`/commissions/${id}/approve`);
      refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Approve failed');
    }
  };

  const payout = async () => {
    const ids = [...selectedApproved];
    if (ids.length === 0) return;
    setPayoutLoading(true);
    setActionError(null);
    try {
      await api.post('/commissions/payout', { commission_ids: ids });
      setSelectedApproved(new Set());
      refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Payout failed');
    } finally {
      setPayoutLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
          {user && <p className="text-sm text-gray-500">Approve and run payouts</p>}
        </div>
        <Button onClick={payout} disabled={payoutLoading || selectedApproved.size === 0}>
          {payoutLoading ? 'Processing…' : `Payout (${selectedApproved.size})`}
        </Button>
      </div>

      {actionError && <p className="text-red-600">{actionError}</p>}
      {error && <p className="text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
        <Card>
          <p className="text-sm text-gray-500">Total pending (page scope)</p>
          <p className="text-xl font-semibold">{formatCurrency(data?.total_pending)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total paid (page scope)</p>
          <p className="text-xl font-semibold">{formatCurrency(data?.total_paid)}</p>
        </Card>
      </div>

      <Card>
        <DataTable
          loading={loading}
          data={rows}
          emptyMessage="No commissions"
          columns={[
            {
              key: 'payout_select',
              header: '',
              className: 'w-10',
              render: (c) =>
                c.status === 'approved' ? (
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedApproved.has(c.id)}
                    onChange={(e) => toggleSelected(c.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-gray-300">—</span>
                ),
            },
            {
              key: 'user',
              header: 'User',
              render: (c) => [c.first_name, c.last_name].filter(Boolean).join(' ') || '—',
            },
            {
              key: 'user_role',
              header: 'Role',
              render: (c) =>
                c.user_role ? (
                  <Badge variant={roleBadgeVariant(c.user_role)}>{c.user_role}</Badge>
                ) : (
                  '—'
                ),
            },
            {
              key: 'deal_company',
              header: 'Deal company',
              render: (c) => c.deal_company ?? '—',
            },
            {
              key: 'commission_type',
              header: 'Type',
              render: (c) => c.commission_type.replace(/_/g, ' '),
            },
            {
              key: 'commission_amount',
              header: 'Amount',
              render: (c) => formatCurrency(c.commission_amount),
            },
            {
              key: 'commission_percentage',
              header: '%',
              render: (c) => (c.commission_percentage != null ? `${c.commission_percentage}%` : '—'),
            },
            {
              key: 'status',
              header: 'Status',
              render: (c) => <Badge variant={commissionStatusVariant(c.status)}>{c.status}</Badge>,
            },
            {
              key: 'triggered_at',
              header: 'Triggered',
              render: (c) => (c.triggered_at ? new Date(c.triggered_at).toLocaleString() : '—'),
            },
            {
              key: 'actions',
              header: '',
              render: (c) =>
                c.status === 'pending' ? (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void approve(c.id);
                    }}
                  >
                    Approve
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>
    </div>
  );
}
