import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Card } from '../../components/ui/Card';
import { StatsCard } from '../../components/ui/StatsCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

interface LeadsListResponse {
  data: { id: string; company_name: string | null; first_name: string | null; last_name: string | null; next_followup_at: string | null; stage: string | null }[];
  total: number;
}

interface CommissionsListResponse {
  total_pending: number;
  total_paid: number;
}

interface ActivityRow {
  id: string;
  activity_type: string;
  created_at: string;
  created_by_id: string;
}

interface ActivitiesResponse {
  data: ActivityRow[];
}

function formatCurrency(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function contactName(first: string | null, last: string | null) {
  const n = [first, last].filter(Boolean).join(' ').trim();
  return n || '—';
}

export function VADashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const leadsTotal = useApiQuery<LeadsListResponse>('/leads?page=1&limit=1');
  const qualifiedTotal = useApiQuery<LeadsListResponse>('/leads?stage=qualified&page=1&limit=1');
  const commissions = useApiQuery<CommissionsListResponse>('/commissions?page=1&limit=1');
  const callsActivity = useApiQuery<ActivitiesResponse>('/activities?activity_type=call&limit=500');
  const followUps = useApiQuery<LeadsListResponse>('/leads?limit=12&sort=next_followup_at&order=asc');

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const callsToday =
    callsActivity.data?.data.filter(
      (a) => a.created_by_id === user?.id && new Date(a.created_at) >= startOfToday
    ).length ?? 0;

  const earnedTotal =
    (commissions.data?.total_pending ?? 0) + (commissions.data?.total_paid ?? 0);

  const upcomingFollowUps =
    followUps.data?.data.filter((l) => l.next_followup_at != null).slice(0, 8) ?? [];

  const statsLoading =
    leadsTotal.loading || qualifiedTotal.loading || commissions.loading || callsActivity.loading;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">VA Dashboard</h1>
        <p className="mt-1 text-gray-600">
          {user?.first_name ? `Welcome back, ${user.first_name}.` : 'Welcome back.'} Here is your pipeline at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <div className="col-span-full flex min-h-[120px] items-center justify-center rounded-xl border border-gray-200 bg-white py-12 shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
              <p className="text-sm text-gray-500">Loading stats…</p>
            </div>
          </div>
        ) : (
          <>
            <StatsCard
              title="Total leads"
              value={leadsTotal.data?.total ?? 0}
              subtitle="Assigned to you"
            />
            <StatsCard title="Calls today" value={callsToday} subtitle="Outbound calls logged" />
            <StatsCard
              title="Qualified leads"
              value={qualifiedTotal.data?.total ?? 0}
              subtitle="In qualified stage"
            />
            <StatsCard
              title="Commissions earned"
              value={formatCurrency(earnedTotal)}
              subtitle="Pending + paid (all time)"
            />
          </>
        )}
      </div>

      <Card title="Next follow-ups" action={<Button onClick={() => navigate('/va/leads')}>View all leads</Button>}>
        {followUps.loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          </div>
        ) : upcomingFollowUps.length === 0 ? (
          <p className="text-center text-sm text-gray-500">No scheduled follow-ups. Great job staying on top of outreach.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcomingFollowUps.map((lead) => (
              <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-gray-900">{lead.company_name || 'Unknown company'}</p>
                  <p className="text-sm text-gray-500">{contactName(lead.first_name, lead.last_name)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {lead.stage && <Badge variant="blue">{lead.stage}</Badge>}
                  <span className="text-sm text-gray-600">{formatDateTime(lead.next_followup_at)}</span>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/va/leads/${lead.id}`)}>
                    Open
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
