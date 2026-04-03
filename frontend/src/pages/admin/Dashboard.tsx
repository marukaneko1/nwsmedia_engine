import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';

type OverviewDeals = {
  total: string | number;
  discovery: string | number;
  proposal_sent: string | number;
  contract_sent: string | number;
  awaiting_deposit: string | number;
  won: string | number;
  lost: string | number;
  pipeline_value: string | number;
  weighted_pipeline: string | number;
};

type AnalyticsOverview = {
  leads: { total: string | number };
  deals: OverviewDeals;
  revenue: { total_revenue: string | number; revenue_30d: string | number };
  commissions: { pending: string | number; paid: string | number };
};

type TeamUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  team_id: string | null;
  team_name: string | null;
  profile_completed: boolean;
  active_leads: string;
  active_deals: string;
  last_activity_at: string | null;
  last_action: string | null;
};

type ActivityEntry = {
  action: string;
  entity_type: string | null;
  created_at: string;
  first_name: string;
  last_name: string;
  user_role: string;
};

type AdminOverview = {
  users: TeamUser[];
  roleCounts: Record<string, number>;
  recentActivity: ActivityEntry[];
  onlineLast24h: number;
};

const ROLE_OPTIONS = ['va', 'closer', 'ops', 'admin', 'client'] as const;

const ROLE_COLORS: Record<string, string> = {
  va: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  closer: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ops: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  client: 'bg-gray-100 text-gray-700 dark:bg-[#0a0a0a] dark:text-gray-400',
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500',
  inactive: 'bg-gray-400',
  suspended: 'bg-red-500',
};

function formatCurrency(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function num(value: string | number | null | undefined): number {
  return typeof value === 'string' ? parseInt(value, 10) : Number(value ?? 0);
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatAction(action: string | null): string {
  if (!action) return '';
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const PIPELINE_STAGES: { key: keyof OverviewDeals; label: string; color: string }[] = [
  { key: 'discovery', label: 'Discovery', color: 'bg-blue-500' },
  { key: 'proposal_sent', label: 'Proposal', color: 'bg-indigo-500' },
  { key: 'contract_sent', label: 'Contract', color: 'bg-purple-500' },
  { key: 'awaiting_deposit', label: 'Deposit', color: 'bg-amber-500' },
  { key: 'won', label: 'Won', color: 'bg-green-500' },
  { key: 'lost', label: 'Lost', color: 'bg-red-500' },
];

export function AdminDashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<AnalyticsOverview>('/analytics/overview').catch(() => null),
      api.get<AdminOverview>('/users/admin-overview').catch(() => null),
    ]).then(([a, o]) => {
      if (a) setAnalytics(a);
      if (o) setOverview(o);
    }).finally(() => setLoading(false));
  }, []);

  async function changeRole(userId: string, newRole: string) {
    setSavingRole(userId);
    try {
      await api.patch(`/users/${userId}`, { role: newRole });
      setOverview(prev => prev ? {
        ...prev,
        users: prev.users.map(u => u.id === userId ? { ...u, role: newRole } : u),
      } : prev);
      setEditingRole(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingRole(null);
    }
  }

  async function changeStatus(userId: string, newStatus: string) {
    try {
      await api.patch(`/users/${userId}`, { status: newStatus });
      setOverview(prev => prev ? {
        ...prev,
        users: prev.users.map(u => u.id === userId ? { ...u, status: newStatus } : u),
      } : prev);
    } catch (e) {
      console.error(e);
    }
  }

  const deals = analytics?.deals;
  const filteredUsers = overview?.users.filter(u =>
    roleFilter === 'all' || u.role === roleFilter
  ) ?? [];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
          {user && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Welcome back, {user.first_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/users"
            className="rounded-lg border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111] transition-colors"
          >
            Manage Users
          </Link>
          <Link
            to="/admin/audit-log"
            className="rounded-lg border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111] transition-colors"
          >
            Audit Log
          </Link>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Total Leads" value={num(analytics?.leads.total)} />
        <KpiCard label="Active Deals" value={num(deals?.total)} />
        <KpiCard label="Pipeline Value" value={formatCurrency(deals?.pipeline_value)} isCurrency />
        <KpiCard label="Won Deals" value={num(deals?.won)} accent="green" />
        <KpiCard label="Revenue" value={formatCurrency(analytics?.revenue.total_revenue)} isCurrency accent="green" />
        <KpiCard label="Active Last 24h" value={overview?.onlineLast24h ?? 0} accent="blue" />
      </div>

      {/* Pipeline Visual */}
      <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-6">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Pipeline Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {PIPELINE_STAGES.map(({ key, label, color }) => (
            <div key={key} className="text-center">
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${color} text-white font-bold text-lg`}>
                {num(deals?.[key])}
              </div>
              <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {(['va', 'closer', 'ops', 'admin', 'client'] as const).map(role => (
          <button
            key={role}
            onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}
            className={`rounded-xl border p-4 text-left transition-all ${
              roleFilter === role
                ? 'border-neutral-500 bg-neutral-50 dark:bg-[#111] dark:border-neutral-700 ring-1 ring-neutral-500'
                : 'border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview?.roleCounts[role] ?? 0}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mt-1">{role === 'va' ? 'VAs' : role + 's'}</p>
          </button>
        ))}
      </div>

      {/* Two Column: Team + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Team Members Table */}
        <div className="xl:col-span-2 rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#1a1a1a] px-6 py-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              Team Members
              {roleFilter !== 'all' && (
                <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">
                  — {roleFilter.toUpperCase()}
                  <button onClick={() => setRoleFilter('all')} className="ml-1 text-neutral-700 hover:underline text-xs">(clear)</button>
                </span>
              )}
            </h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">{filteredUsers.length} members</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-[#1a1a1a] bg-gray-50/50 dark:bg-[#0a0a0a]">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Last Login</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Last Activity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Workload</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredUsers.map(u => {
                  const isOnline = u.last_login_at && (Date.now() - new Date(u.last_login_at).getTime()) < 3600000;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-[#111] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-[#1a1a1a] text-neutral-800 dark:text-white text-xs font-bold">
                              {u.first_name[0]}{u.last_name[0]}
                            </div>
                            {isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-[#0a0a0a] bg-green-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{u.first_name} {u.last_name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {editingRole === u.id ? (
                          <select
                            autoFocus
                            className="rounded-md border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-2 py-1 text-xs text-gray-900 dark:text-gray-100"
                            value={u.role}
                            onChange={(e) => changeRole(u.id, e.target.value)}
                            onBlur={() => setEditingRole(null)}
                            disabled={savingRole === u.id}
                          >
                            {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingRole(u.id)}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_COLORS[u.role] || ROLE_COLORS.client} hover:ring-2 hover:ring-neutral-500/30 transition-all cursor-pointer`}
                            title="Click to change role"
                          >
                            {u.role.toUpperCase()}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[u.status] || 'bg-gray-400'}`} />
                          <select
                            className="bg-transparent text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 border-0 p-0 focus:ring-0"
                            value={u.status}
                            onChange={(e) => changeStatus(u.id, e.target.value)}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${isOnline ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                          {timeAgo(u.last_login_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(u.last_activity_at)}</span>
                          {u.last_action && (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[140px]">
                              {formatAction(u.last_action)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          {(u.role === 'va') && (
                            <span title="Active leads">{num(u.active_leads)} leads</span>
                          )}
                          {(u.role === 'closer') && (
                            <span title="Active deals">{num(u.active_deals)} deals</span>
                          )}
                          {u.role !== 'va' && u.role !== 'closer' && (
                            <span className="text-gray-300 dark:text-gray-600">--</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to="/admin/users"
                          className="text-xs text-neutral-700 dark:text-white hover:underline font-medium"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                      No team members found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#1a1a1a] px-6 py-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h2>
            <Link to="/admin/audit-log" className="text-xs text-neutral-700 dark:text-white hover:underline">View all</Link>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[600px]">
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {(overview?.recentActivity ?? []).map((a, i) => (
                <div key={i} className="px-5 py-3 flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-[#111] text-xs font-bold text-gray-500 dark:text-gray-400">
                    {a.first_name?.[0]}{a.last_name?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{a.first_name} {a.last_name}</span>
                      {' '}
                      <span className="text-gray-500 dark:text-gray-400">
                        {formatAction(a.action)}{a.entity_type ? ` ${a.entity_type}` : ''}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {timeAgo(a.created_at)}
                      <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_COLORS[a.user_role] || 'bg-gray-100 text-gray-500'}`}>
                        {a.user_role}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
              {(overview?.recentActivity ?? []).length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">No recent activity</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-6">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Users', path: '/admin/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
            { label: 'Leads', path: '/admin/leads', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
            { label: 'Deals', path: '/admin/deals', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
            { label: 'Projects', path: '/admin/projects', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z' },
            { label: 'Courses', path: '/admin/courses', icon: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342' },
            { label: 'Analytics', path: '/admin/analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
          ].map(link => (
            <Link
              key={link.path}
              to={link.path}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 dark:border-[#1a1a1a] p-4 hover:bg-gray-50 dark:hover:bg-[#111] hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
            >
              <svg className="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
              </svg>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, isCurrency, accent }: { label: string; value: number | string; isCurrency?: boolean; accent?: string }) {
  const colorClass = accent === 'green'
    ? 'text-green-600 dark:text-green-400'
    : accent === 'blue'
      ? 'text-blue-600 dark:text-blue-400'
      : 'text-gray-900 dark:text-gray-100';
  return (
    <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-2 text-xl font-bold ${colorClass}`}>
        {isCurrency ? value : typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
