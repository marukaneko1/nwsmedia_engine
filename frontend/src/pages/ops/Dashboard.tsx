import { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { StatsCard } from '../../components/ui/StatsCard';
import { Button } from '../../components/ui/Button';
import type { Client } from '@nws/shared';

type ClientsResponse = { data: Client[]; total: number; page: number; pages: number };

function projectStatusVariant(s: string): 'green' | 'yellow' | 'blue' | 'gray' | 'red' {
  switch (s) {
    case 'in_progress':
      return 'blue';
    case 'complete':
      return 'green';
    case 'revision_requested':
      return 'yellow';
    case 'awaiting_approval':
      return 'yellow';
    case 'paused':
      return 'gray';
    default:
      return 'gray';
  }
}

export function OpsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: inProgress, loading: lp, error: e1 } = useApiQuery<ClientsResponse>(
    '/clients?project_status=in_progress&limit=500'
  );
  const { data: revisions, loading: lr, error: e2 } = useApiQuery<ClientsResponse>(
    '/clients?project_status=revision_requested&limit=500'
  );
  const { data: allRecent, loading: la, error: e3 } = useApiQuery<ClientsResponse>('/clients?limit=500');

  const deliveriesThisWeek = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return (allRecent?.data ?? []).filter((c) => {
      if (!c.actual_delivery_date) return false;
      const d = new Date(c.actual_delivery_date);
      return d >= weekAgo && d <= now;
    }).length;
  }, [allRecent]);

  const activeCount = inProgress?.total ?? inProgress?.data?.length ?? 0;
  const revisionCount = revisions?.total ?? revisions?.data?.length ?? 0;
  const loading = lp || lr || la;
  const error = e1 || e2 || e3;

  const clients = inProgress?.data ?? [];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ops dashboard</h1>
        {user && (
          <p className="mt-1 text-sm text-gray-500">
            {user.first_name}, here is your delivery workload
          </p>
        )}
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard title="Active projects" value={loading ? '—' : activeCount} />
        <StatsCard title="Revision requests" value={loading ? '—' : revisionCount} />
        <StatsCard title="Deliveries this week" value={loading ? '—' : deliveriesThisWeek} />
      </div>

      <Card
        title="Clients in progress"
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate('/ops/projects')}>
            View all projects
          </Button>
        }
      >
        {lp ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-gray-500">No in-progress clients</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {clients.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium text-gray-900">{c.company_name}</p>
                  <p className="text-sm text-gray-500">{c.contact_name}</p>
                </div>
                <Badge variant={projectStatusVariant(c.project_status)}>{c.project_status.replace(/_/g, ' ')}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
