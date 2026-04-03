import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

interface AuditEntry {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  user_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface Stats {
  actions: { action: string; count: string }[];
  entities: { entity_type: string; count: string }[];
  last24h: number;
}

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  login: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  register: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { load(); }, [page, filterAction, filterEntity]);
  useEffect(() => { loadStats(); }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (filterAction) params.append('action', filterAction);
      if (filterEntity) params.append('entity_type', filterEntity);

      const res = await api.get<{ data: AuditEntry[]; total: number; pages: number }>(`/audit-log?${params}`);
      setEntries(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadStats() {
    try {
      const res = await api.get<Stats>('/audit-log/stats');
      setStats(res);
    } catch { /* ignore */ }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Track all system activity and changes</p>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Last 24 Hours</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.last24h}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Events</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Top Action</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 capitalize">{stats.actions[0]?.action || '–'}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <select
          className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
        >
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="login">Login</option>
          <option value="register">Register</option>
        </select>
        <select
          className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
          value={filterEntity}
          onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }}
        >
          <option value="">All Entities</option>
          <option value="user">User</option>
          <option value="lead">Lead</option>
          <option value="deal">Deal</option>
          <option value="payment">Payment</option>
          <option value="commission">Commission</option>
          <option value="team">Team</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-[#1a1a1a] bg-gray-50 dark:bg-[#0a0a0a]">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">When</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Action</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">IP</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <>
                  <tr key={e.id} className="border-b border-gray-100 dark:border-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-[#111]">
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap" title={new Date(e.created_at).toLocaleString()}>
                      {timeAgo(e.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {e.first_name ? (
                        <span className="text-gray-900 dark:text-gray-100">{e.first_name} {e.last_name}</span>
                      ) : (
                        <span className="text-gray-400">System</span>
                      )}
                      {e.user_role && <span className="ml-1 text-xs text-gray-400 capitalize">({e.user_role})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${actionColors[e.action] || 'bg-gray-100 text-gray-600 dark:bg-[#111] dark:text-gray-400'}`}>
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-600 dark:text-gray-400">
                      {e.entity_type || '–'}
                      {e.entity_id && <span className="ml-1 text-xs text-gray-400">{e.entity_id.slice(0, 8)}...</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{e.ip_address || '–'}</td>
                    <td className="px-4 py-3">
                      {e.changes && (
                        <button
                          onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                          className="text-xs text-neutral-700 hover:text-neutral-800 dark:text-white"
                        >
                          {expandedId === e.id ? 'Hide' : 'Details'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === e.id && e.changes && (
                    <tr key={`${e.id}-details`}>
                      <td colSpan={6} className="px-4 py-3 bg-gray-50 dark:bg-[#0a0a0a]">
                        <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(e.changes, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No audit entries found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {pages} ({total} total)
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
