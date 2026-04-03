import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';

/* ───── Types ───── */

interface ActivityEntry {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  user_role: string | null;
  user_email: string | null;
  action: string;
  method: string | null;
  endpoint: string | null;
  ip_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  status_code: number | null;
  response_time_ms: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface LiveUser {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  email: string;
  action: string;
  endpoint: string;
  ip_address: string;
  city: string | null;
  country: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  last24h: number;
  activeUsersNow: number;
  uniqueIps24h: number;
  topUsers: {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
    activity_count: string;
    last_seen: string;
    last_ip: string;
    last_city: string | null;
    last_country: string | null;
  }[];
  actionBreakdown: { action: string; count: string }[];
  countries: { country: string; country_code: string; count: string }[];
  devices: { device_type: string; count: string }[];
  browsers: { browser: string; count: string }[];
  hourlyActivity: { hour: string; count: string }[];
}

/* ───── Helpers ───── */

const actionColors: Record<string, string> = {
  login: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  logout: 'bg-gray-100 text-gray-700 dark:bg-[#111] dark:text-gray-300',
  view: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  search: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  register: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const roleColors: Record<string, string> = {
  admin: 'text-purple-600 dark:text-purple-400',
  closer: 'text-blue-600 dark:text-blue-400',
  va: 'text-green-600 dark:text-green-400',
  ops: 'text-amber-600 dark:text-amber-400',
};

const methodColors: Record<string, string> = {
  GET: 'text-blue-500',
  POST: 'text-green-500',
  PUT: 'text-amber-500',
  PATCH: 'text-amber-500',
  DELETE: 'text-red-500',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatLocation(city: string | null, country: string | null) {
  if (city && country) return `${city}, ${country}`;
  if (country) return country;
  if (city) return city;
  return '—';
}

function getCountryFlag(code: string | null) {
  if (!code) return '';
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

/* ───── Tab type ───── */
type Tab = 'live' | 'activity' | 'insights';

/* ───── Component ───── */

export function AdminUserActivities() {
  const [tab, setTab] = useState<Tab>('live');
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterDevice, setFilterDevice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '40' });
      if (filterUser) params.append('user_id', filterUser);
      if (filterAction) params.append('action', filterAction);
      if (filterCountry) params.append('country', filterCountry);
      if (filterDevice) params.append('device_type', filterDevice);
      if (searchTerm) params.append('search', searchTerm);

      const res = await api.get<{ data: ActivityEntry[]; total: number; pages: number }>(
        `/user-activities?${params}`
      );
      setEntries(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [page, filterUser, filterAction, filterCountry, filterDevice, searchTerm]);

  const loadLive = useCallback(async () => {
    try {
      const res = await api.get<{ data: LiveUser[] }>('/user-activities/live');
      setLiveUsers(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get<Stats>('/user-activities/stats');
      setStats(res);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadStats(); loadLive(); }, []);
  useEffect(() => { if (tab === 'activity') loadActivities(); }, [tab, loadActivities]);
  useEffect(() => {
    if (tab === 'live') {
      loadLive();
      const interval = setInterval(loadLive, 30000);
      return () => clearInterval(interval);
    }
  }, [tab, loadLive]);

  const viewUserActivity = (userId: string) => {
    setFilterUser(userId);
    setSelectedUser(userId);
    setPage(1);
    setTab('activity');
  };

  const clearUserFilter = () => {
    setFilterUser('');
    setSelectedUser(null);
    setPage(1);
  };

  /* ── Stat Cards ── */
  function StatCards() {
    if (!stats) return null;
    const cards = [
      { label: 'Active Now', value: stats.activeUsersNow, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', icon: 'M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z' },
      { label: 'Last 24h Events', value: stats.last24h.toLocaleString(), color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
      { label: 'Unique IPs (24h)', value: stats.uniqueIps24h, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
      { label: 'All-Time Events', value: stats.total.toLocaleString(), color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    ];

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`${c.bg} rounded-xl border border-gray-200 dark:border-[#1a1a1a] p-4`}>
            <div className="flex items-center gap-3">
              <svg className={`h-8 w-8 ${c.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
              </svg>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ── Live Users Tab ── */
  function LiveTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Live Activity ({liveUsers.length} active)
            </h2>
          </div>
          <button
            onClick={loadLive}
            className="text-sm text-neutral-700 hover:text-neutral-800 dark:text-white"
          >
            Refresh
          </button>
        </div>

        {liveUsers.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="mt-3 text-gray-500 dark:text-gray-400">No active users in the last 15 minutes</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {liveUsers.map((u) => (
              <div
                key={u.user_id}
                className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-4 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors cursor-pointer"
                onClick={() => viewUserActivity(u.user_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-[#1a1a1a] flex items-center justify-center text-neutral-800 dark:text-white font-semibold text-sm">
                        {u.first_name?.[0]}{u.last_name?.[0]}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white dark:border-[#0a0a0a]" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {u.first_name} {u.last_name}
                        <span className={`ml-2 text-xs capitalize ${roleColors[u.role] || 'text-gray-400'}`}>
                          {u.role}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Last action: <span className="font-mono">{u.endpoint}</span> — {timeAgo(u.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs space-y-1">
                    <p className="text-gray-500 dark:text-gray-400 font-mono">{u.ip_address || '—'}</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {u.country ? getCountryFlag(null) : ''} {formatLocation(u.city, u.country)}
                    </p>
                    {u.device_type && (
                      <p className="text-gray-400">{u.browser} / {u.os} / {u.device_type}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Activity Log Tab ── */
  function ActivityTab() {
    return (
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {selectedUser && (
            <button
              onClick={clearUserFilter}
              className="inline-flex items-center gap-1 rounded-lg bg-neutral-50 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-800 dark:text-white"
            >
              Viewing user activity
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <input
            type="text"
            placeholder="Search IP, endpoint, city..."
            className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 w-60"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
          <select
            className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
          >
            <option value="">All Actions</option>
            <option value="view">View</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="search">Search</option>
          </select>
          <select
            className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            value={filterDevice}
            onChange={(e) => { setFilterDevice(e.target.value); setPage(1); }}
          >
            <option value="">All Devices</option>
            <option value="Desktop">Desktop</option>
            <option value="Mobile">Mobile</option>
            <option value="Tablet">Tablet</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#1a1a1a] bg-gray-50 dark:bg-[#0a0a0a]">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">When</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Action</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Endpoint</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">IP Address</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Location</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Device</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <>
                      <tr
                        key={e.id}
                        className="border-b border-gray-100 dark:border-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-[#111]"
                      >
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap" title={new Date(e.created_at).toLocaleString()}>
                          {timeAgo(e.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {e.first_name ? (
                            <button
                              className="text-left hover:text-neutral-800 dark:hover:text-white"
                              onClick={() => viewUserActivity(e.user_id)}
                            >
                              <span className="text-gray-900 dark:text-gray-100 font-medium">
                                {e.first_name} {e.last_name}
                              </span>
                              <span className={`ml-1 text-xs capitalize ${roleColors[e.user_role || ''] || 'text-gray-400'}`}>
                                ({e.user_role})
                              </span>
                            </button>
                          ) : (
                            <span className="text-gray-400">Unknown</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${actionColors[e.action] || 'bg-gray-100 text-gray-600 dark:bg-[#111] dark:text-gray-400'}`}>
                            {e.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[200px] truncate">
                          {e.method && (
                            <span className={`font-mono text-xs font-bold ${methodColors[e.method] || 'text-gray-400'} mr-1`}>
                              {e.method}
                            </span>
                          )}
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{e.endpoint || '—'}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{e.ip_address || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {e.country_code && (
                            <span className="mr-1">{getCountryFlag(e.country_code)}</span>
                          )}
                          {formatLocation(e.city, e.country)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {e.browser || '—'} / {e.os || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                            className="text-xs text-neutral-700 hover:text-neutral-800 dark:text-white"
                          >
                            {expandedId === e.id ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>
                      {expandedId === e.id && (
                        <tr key={`${e.id}-detail`}>
                          <td colSpan={8} className="px-4 py-3 bg-gray-50 dark:bg-[#0a0a0a]">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div>
                                <p className="text-gray-400 mb-1">Full Timestamp</p>
                                <p className="text-gray-700 dark:text-gray-300">{new Date(e.created_at).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-1">Response Time</p>
                                <p className="text-gray-700 dark:text-gray-300">{e.response_time_ms != null ? `${e.response_time_ms}ms` : '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-1">Status Code</p>
                                <p className={`font-mono ${e.status_code && e.status_code >= 400 ? 'text-red-500' : 'text-green-500'}`}>
                                  {e.status_code || '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-1">Device Type</p>
                                <p className="text-gray-700 dark:text-gray-300">{e.device_type || '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-1">Location Detail</p>
                                <p className="text-gray-700 dark:text-gray-300">
                                  {[e.city, e.region, e.country].filter(Boolean).join(', ') || '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-1">Email</p>
                                <p className="text-gray-700 dark:text-gray-300">{e.user_email || '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-1">Browser / OS</p>
                                <p className="text-gray-700 dark:text-gray-300">{e.browser} on {e.os}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 mb-1">IP Address</p>
                                <p className="text-gray-700 dark:text-gray-300 font-mono">{e.ip_address || '—'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                        No activity found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {pages} ({total.toLocaleString()} total)
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-300 dark:border-[#262626] px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111] disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-300 dark:border-[#262626] px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Insights Tab ── */
  function InsightsTab() {
    if (!stats) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Top Users */}
        <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-[#1a1a1a]">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Most Active Users (24h)</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {stats.topUsers.map((u, i) => (
              <div
                key={u.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#111] cursor-pointer"
                onClick={() => viewUserActivity(u.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-gray-400 w-5">{i + 1}</span>
                  <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-[#1a1a1a] flex items-center justify-center text-neutral-800 dark:text-white font-semibold text-xs">
                    {u.first_name?.[0]}{u.last_name?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {u.first_name} {u.last_name}
                      <span className={`ml-1 text-xs capitalize ${roleColors[u.role] || 'text-gray-400'}`}>({u.role})</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      Last seen: {timeAgo(u.last_seen)} — {formatLocation(u.last_city, u.last_country)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{parseInt(u.activity_count).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">events</p>
                </div>
              </div>
            ))}
            {stats.topUsers.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No activity in the last 24h</p>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Action Breakdown */}
          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-[#1a1a1a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Action Breakdown (24h)</h3>
            </div>
            <div className="p-4 space-y-3">
              {stats.actionBreakdown.map((a) => {
                const max = Math.max(...stats.actionBreakdown.map((x) => parseInt(x.count)));
                const pct = max > 0 ? (parseInt(a.count) / max) * 100 : 0;
                return (
                  <div key={a.action}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-700 dark:text-gray-300">{a.action}</span>
                      <span className="text-gray-500 dark:text-gray-400">{parseInt(a.count).toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-[#111]">
                      <div
                        className="h-2 rounded-full bg-neutral-800 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {stats.actionBreakdown.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No data</p>
              )}
            </div>
          </div>

          {/* Countries */}
          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-[#1a1a1a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Top Countries (7d)</h3>
            </div>
            <div className="p-4 space-y-2">
              {stats.countries.map((c) => (
                <div key={c.country} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    {getCountryFlag(c.country_code)} {c.country}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 font-mono">{parseInt(c.count).toLocaleString()}</span>
                </div>
              ))}
              {stats.countries.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No location data yet</p>
              )}
            </div>
          </div>

          {/* Devices */}
          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-[#1a1a1a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Devices (7d)</h3>
            </div>
            <div className="p-4 space-y-2">
              {stats.devices.map((d) => (
                <div key={d.device_type} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{d.device_type}</span>
                  <span className="text-gray-500 dark:text-gray-400 font-mono">{parseInt(d.count).toLocaleString()}</span>
                </div>
              ))}
              {stats.devices.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No data</p>
              )}
            </div>
          </div>

          {/* Browsers */}
          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-[#1a1a1a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Browsers (7d)</h3>
            </div>
            <div className="p-4 space-y-2">
              {stats.browsers.map((b) => (
                <div key={b.browser} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{b.browser}</span>
                  <span className="text-gray-500 dark:text-gray-400 font-mono">{parseInt(b.count).toLocaleString()}</span>
                </div>
              ))}
              {stats.browsers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No data</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main Render ── */
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'live', label: 'Live', icon: 'M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z' },
    { id: 'activity', label: 'Activity Log', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'insights', label: 'Insights', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Activities</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Monitor all user activity across the platform — actions, IP addresses, and locations
        </p>
      </div>

      <StatCards />

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-[#1a1a1a]">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-neutral-700 text-neutral-700 dark:border-neutral-400 dark:text-white'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
              </svg>
              {t.label}
              {t.id === 'live' && liveUsers.length > 0 && (
                <span className="ml-1 inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                  {liveUsers.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'live' && <LiveTab />}
      {tab === 'activity' && <ActivityTab />}
      {tab === 'insights' && <InsightsTab />}
    </div>
  );
}
