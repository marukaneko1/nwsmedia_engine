import { useState, useEffect, useMemo, FormEvent } from 'react';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

/* ─── Types ──────────────────────────────────────────────────────────── */

type ScheduleEntry = { start: string; end: string };
type ScheduleValue = ScheduleEntry | ScheduleEntry[];

type ScheduleUser = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  schedule: Record<string, ScheduleValue> | null;
  overrides: Record<string, Override>;
  logged_hours: Record<string, number>;
};

type Override = {
  id: string;
  user_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  notes: string | null;
};

type SummaryUser = {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  schedule: Record<string, ScheduleValue> | null;
  total_minutes: number;
  activity_breakdown: Record<string, number> | null;
  entries: any[] | null;
};

type SummaryData = {
  users: SummaryUser[];
  stats: {
    total_team_hours: number;
    avg_hours_per_person: number;
    active_count: number;
    top_performer: SummaryUser | null;
  };
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const ACTIVITY_LABELS: Record<string, string> = {
  cold_calls: 'Cold Calls',
  follow_ups: 'Follow-ups',
  meetings: 'Meetings',
  admin_tasks: 'Admin Tasks',
  training: 'Training',
  break: 'Break',
  other: 'Other',
};

const ACTIVITY_COLORS: Record<string, string> = {
  cold_calls: 'blue',
  follow_ups: 'purple',
  meetings: 'green',
  admin_tasks: 'gray',
  training: 'yellow',
  break: 'red',
  other: 'gray',
};

const OVERRIDE_OPTIONS = [
  { value: 'pto', label: 'PTO' },
  { value: 'sick', label: 'Sick Day' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'custom', label: 'Custom Hours' },
];

function getWeekStart(offset: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset * 7);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

function getWeekDays(startStr: string): string[] {
  const start = new Date(startStr + 'T12:00:00');
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function parseTime(t: string): number {
  const parts = t.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

function normalizeRanges(val: ScheduleValue): ScheduleEntry[] {
  if (Array.isArray(val)) return val;
  return [val];
}

function scheduledHoursForDay(schedule: Record<string, ScheduleValue> | null, dayKey: string): number {
  if (!schedule || !schedule[dayKey]) return 0;
  const ranges = normalizeRanges(schedule[dayKey]);
  let total = 0;
  for (const { start, end } of ranges) {
    if (!start || !end) continue;
    total += Math.max(0, (parseTime(end) - parseTime(start)) / 60);
  }
  return total;
}

function userHourSet(schedule: Record<string, ScheduleValue> | null, dayKey: string): Set<number> {
  const hours = new Set<number>();
  if (!schedule || !schedule[dayKey]) return hours;
  const ranges = normalizeRanges(schedule[dayKey]);
  for (const { start, end } of ranges) {
    if (!start || !end) continue;
    const sh = Math.floor(parseTime(start) / 60);
    const eh = Math.ceil(parseTime(end) / 60);
    for (let h = sh; h < eh; h++) hours.add(h);
  }
  return hours;
}

const EMPLOYEE_COLORS = [
  { bg: '#3b82f6', text: '#fff', name: 'blue' },
  { bg: '#10b981', text: '#fff', name: 'green' },
  { bg: '#f59e0b', text: '#000', name: 'amber' },
  { bg: '#ef4444', text: '#fff', name: 'red' },
  { bg: '#8b5cf6', text: '#fff', name: 'violet' },
  { bg: '#ec4899', text: '#fff', name: 'pink' },
  { bg: '#06b6d4', text: '#fff', name: 'cyan' },
  { bg: '#f97316', text: '#fff', name: 'orange' },
  { bg: '#14b8a6', text: '#fff', name: 'teal' },
  { bg: '#6366f1', text: '#fff', name: 'indigo' },
  { bg: '#a855f7', text: '#fff', name: 'purple' },
  { bg: '#e11d48', text: '#fff', name: 'rose' },
  { bg: '#84cc16', text: '#000', name: 'lime' },
  { bg: '#0ea5e9', text: '#fff', name: 'sky' },
  { bg: '#d946ef', text: '#fff', name: 'fuchsia' },
];

function formatHours(min: number): string {
  return (min / 60).toFixed(1);
}

function dateLabel(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function AdminSchedule() {
  const [tab, setTab] = useState<'availability' | 'schedule' | 'kpi'>('availability');

  // ── Schedule tab state ────────────────────────────────────────────
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStart(weekOffset);
  const weekDays = getWeekDays(weekStart);
  const [users, setUsers] = useState<ScheduleUser[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const [showOverride, setShowOverride] = useState(false);
  const [overrideUserId, setOverrideUserId] = useState('');
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideForm, setOverrideForm] = useState({ reason: 'pto', start_time: '', end_time: '', notes: '' });
  const [savingOverride, setSavingOverride] = useState(false);

  // ── KPI tab state ─────────────────────────────────────────────────
  const [kpiRange, setKpiRange] = useState<'this_week' | 'last_week' | 'custom'>('this_week');
  const [kpiFrom, setKpiFrom] = useState(weekStart);
  const [kpiTo, setKpiTo] = useState(getWeekDays(weekStart)[6]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loadingKpi, setLoadingKpi] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // ── Fetch schedule data ───────────────────────────────────────────
  useEffect(() => {
    setLoadingSchedule(true);
    api.get<{ users: ScheduleUser[] }>(`/schedule/team?week_start=${weekStart}`)
      .then(res => setUsers(res.users))
      .catch(() => {})
      .finally(() => setLoadingSchedule(false));
  }, [weekStart]);

  // ── KPI range presets ─────────────────────────────────────────────
  useEffect(() => {
    if (kpiRange === 'this_week') {
      const ws = getWeekStart(0);
      setKpiFrom(ws);
      setKpiTo(getWeekDays(ws)[6]);
    } else if (kpiRange === 'last_week') {
      const ws = getWeekStart(-1);
      setKpiFrom(ws);
      setKpiTo(getWeekDays(ws)[6]);
    }
  }, [kpiRange]);

  // ── Fetch KPI data ────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'kpi') return;
    setLoadingKpi(true);
    api.get<SummaryData>(`/time/summary?from=${kpiFrom}&to=${kpiTo}`)
      .then(res => setSummary(res))
      .catch(() => {})
      .finally(() => setLoadingKpi(false));
  }, [tab, kpiFrom, kpiTo]);

  // ── Override handlers ─────────────────────────────────────────────
  const openOverride = (userId: string, date: string) => {
    setOverrideUserId(userId);
    setOverrideDate(date);

    // Pre-fill if existing override
    const user = users.find(u => u.id === userId);
    const existing = user?.overrides?.[date];
    if (existing) {
      setOverrideForm({
        reason: existing.reason,
        start_time: existing.start_time || '',
        end_time: existing.end_time || '',
        notes: existing.notes || '',
      });
    } else {
      setOverrideForm({ reason: 'pto', start_time: '', end_time: '', notes: '' });
    }
    setShowOverride(true);
  };

  const saveOverride = async (e: FormEvent) => {
    e.preventDefault();
    setSavingOverride(true);
    try {
      await api.post('/schedule/overrides', {
        user_id: overrideUserId,
        date: overrideDate,
        ...overrideForm,
        start_time: overrideForm.start_time || undefined,
        end_time: overrideForm.end_time || undefined,
        notes: overrideForm.notes || undefined,
      });
      setShowOverride(false);
      // Refresh schedule
      const res = await api.get<{ users: ScheduleUser[] }>(`/schedule/team?week_start=${weekStart}`);
      setUsers(res.users);
    } catch { /* silent */ }
    setSavingOverride(false);
  };

  const deleteOverride = async (overrideId: string) => {
    try {
      await api.delete(`/schedule/overrides/${overrideId}`);
      const res = await api.get<{ users: ScheduleUser[] }>(`/schedule/team?week_start=${weekStart}`);
      setUsers(res.users);
    } catch { /* silent */ }
  };

  function computeScheduledHours(schedule: Record<string, ScheduleValue> | null): number {
    if (!schedule) return 40;
    let total = 0;
    for (const dayKey of DAY_KEYS) {
      total += scheduledHoursForDay(schedule, dayKey);
    }
    return total;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Team Schedule</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View schedules, manage overrides, and track KPIs</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-[#1a1a1a]">
        {(['availability', 'schedule', 'kpi'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-neutral-700 text-neutral-700 dark:border-white dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            {t === 'availability' ? 'Team Availability' : t === 'schedule' ? 'Weekly Schedule' : 'Time & KPI Tracking'}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         TAB 0: TEAM AVAILABILITY GRID
         ═══════════════════════════════════════════════════════════════ */}
      {tab === 'availability' && (
        <AvailabilityView users={users} loading={loadingSchedule} />
      )}

      {/* ═══════════════════════════════════════════════════════════════
         TAB 1: WEEKLY SCHEDULE
         ═══════════════════════════════════════════════════════════════ */}
      {tab === 'schedule' && (
        <div className="space-y-4">
          {/* Week navigator */}
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset(p => p - 1)} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-[#111] text-gray-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => setWeekOffset(0)} className="text-sm font-medium text-neutral-700 hover:text-neutral-800 dark:text-white px-2">
              This Week
            </button>
            <button onClick={() => setWeekOffset(p => p + 1)} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-[#111] text-gray-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
              {dateLabel(weekDays[0])} – {dateLabel(weekDays[6])}
            </span>
          </div>

          {loadingSchedule ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <Card><p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">No team members found.</p></Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#1a1a1a]">
                    <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase py-3 pr-4 w-40">Employee</th>
                    {weekDays.map((day, i) => {
                      const isToday = day === new Date().toISOString().split('T')[0];
                      return (
                        <th key={day} className={`text-center text-xs font-semibold py-3 px-1 ${isToday ? 'text-neutral-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'} uppercase`}>
                          {DAY_NAMES[i]}<br /><span className="text-[10px] normal-case font-normal">{dateLabel(day)}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-gray-100 dark:border-[#0a0a0a] hover:bg-gray-50 dark:hover:bg-[#111]">
                      <td className="py-3 pr-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
                      </td>
                      {weekDays.map((day, i) => {
                        const dayKey = DAY_KEYS[i];
                        const scheduled = scheduledHoursForDay(user.schedule, dayKey);
                        const override = user.overrides?.[day];
                        const logged = user.logged_hours?.[day] || 0;
                        const loggedH = +(logged / 60).toFixed(1);
                        const isToday = day === new Date().toISOString().split('T')[0];

                        return (
                          <td key={day} className={`text-center py-3 px-1 ${isToday ? 'bg-neutral-50/50 dark:bg-[#111]' : ''}`}>
                            <button
                              onClick={() => openOverride(user.id, day)}
                              className="w-full rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-[#111] transition-colors"
                            >
                              {override ? (
                                <div>
                                  <Badge variant={override.reason === 'pto' ? 'blue' : override.reason === 'sick' ? 'red' : override.reason === 'holiday' ? 'green' : 'yellow'}>
                                    {override.reason === 'pto' ? 'PTO' : override.reason === 'sick' ? 'Sick' : override.reason === 'holiday' ? 'Holiday' : override.reason === 'half_day' ? '½ Day' : 'Custom'}
                                  </Badge>
                                </div>
                              ) : scheduled > 0 ? (
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{scheduled}h sched</p>
                                  <p className={`text-sm font-semibold ${loggedH >= scheduled ? 'text-green-600 dark:text-green-400' : loggedH > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                    {loggedH}h
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-300 dark:text-gray-600">Off</p>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         TAB 2: TIME & KPI TRACKING
         ═══════════════════════════════════════════════════════════════ */}
      {tab === 'kpi' && (
        <div className="space-y-6">
          {/* Date range picker */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-1">
              {(['this_week', 'last_week', 'custom'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setKpiRange(r)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${kpiRange === r ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-600 dark:bg-[#0a0a0a] dark:text-gray-400'}`}
                >
                  {r === 'this_week' ? 'This Week' : r === 'last_week' ? 'Last Week' : 'Custom'}
                </button>
              ))}
            </div>
            {kpiRange === 'custom' && (
              <>
                <Input label="From" type="date" value={kpiFrom} onChange={e => setKpiFrom(e.target.value)} />
                <Input label="To" type="date" value={kpiTo} onChange={e => setKpiTo(e.target.value)} />
              </>
            )}
          </div>

          {loadingKpi ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : summary ? (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Team Hours" value={`${summary.stats.total_team_hours}h`} />
                <StatCard label="Avg Hours / Person" value={`${summary.stats.avg_hours_per_person}h`} />
                <StatCard label="Active Employees" value={String(summary.stats.active_count)} />
                <StatCard
                  label="Top Performer"
                  value={summary.stats.top_performer ? `${summary.stats.top_performer.first_name} ${summary.stats.top_performer.last_name}` : '—'}
                  sub={summary.stats.top_performer ? `${formatHours(summary.stats.top_performer.total_minutes)}h` : undefined}
                />
              </div>

              {/* User table */}
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-[#1a1a1a]">
                        <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase py-3 pr-4">Employee</th>
                        <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase py-3 px-2">Total</th>
                        <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase py-3 px-2">Scheduled</th>
                        <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase py-3 px-2">Variance</th>
                        {Object.keys(ACTIVITY_LABELS).map(a => (
                          <th key={a} className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase py-3 px-2 hidden xl:table-cell">
                            {ACTIVITY_LABELS[a].split(' ')[0]}
                          </th>
                        ))}
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.users.map(u => {
                        const totalH = +(u.total_minutes / 60).toFixed(1);
                        const scheduledH = computeScheduledHours(u.schedule);
                        const variance = +(totalH - scheduledH).toFixed(1);
                        const isExpanded = expandedUser === u.user_id;

                        return (
                          <tbody key={u.user_id}>
                            <tr className="border-b border-gray-100 dark:border-[#0a0a0a] hover:bg-gray-50 dark:hover:bg-[#111] cursor-pointer" onClick={() => setExpandedUser(isExpanded ? null : u.user_id)}>
                              <td className="py-3 pr-4">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.first_name} {u.last_name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{u.role}</p>
                              </td>
                              <td className="text-right py-3 px-2 text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{totalH}h</td>
                              <td className="text-right py-3 px-2 text-sm text-gray-500 dark:text-gray-400 tabular-nums">{scheduledH}h</td>
                              <td className={`text-right py-3 px-2 text-sm font-medium tabular-nums ${variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {variance >= 0 ? '+' : ''}{variance}h
                              </td>
                              {Object.keys(ACTIVITY_LABELS).map(a => (
                                <td key={a} className="text-right py-3 px-2 text-sm text-gray-500 dark:text-gray-400 tabular-nums hidden xl:table-cell">
                                  {u.activity_breakdown?.[a] ? formatHours(u.activity_breakdown[a]) + 'h' : '—'}
                                </td>
                              ))}
                              <td className="py-3">
                                <svg className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </td>
                            </tr>
                            {isExpanded && u.entries && (
                              <tr>
                                <td colSpan={99} className="bg-gray-50 dark:bg-black/50 px-4 py-3">
                                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                                    {u.entries.map((e: any, i: number) => (
                                      <div key={i} className="flex items-center gap-3 text-sm">
                                        <Badge variant={ACTIVITY_COLORS[e.activity_type] as any || 'gray'}>
                                          {(e.activity_type || '').replace('_', ' ')}
                                        </Badge>
                                        <span className="text-gray-600 dark:text-gray-300">
                                          {e.clock_in ? new Date(e.clock_in).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                                          {' '}
                                          {e.clock_in ? new Date(e.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                          {e.clock_out ? ` – ${new Date(e.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (active)'}
                                        </span>
                                        <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                                          {e.minutes ? `${(e.minutes / 60).toFixed(1)}h` : '—'}
                                        </span>
                                        {e.notes && <span className="text-gray-400 truncate max-w-xs">{e.notes}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : (
            <Card><p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No data available.</p></Card>
          )}
        </div>
      )}

      {/* ── Override Modal ────────────────────────────────────────────── */}
      <Modal open={showOverride} onClose={() => setShowOverride(false)} title="Schedule Override" size="md">
        <form onSubmit={saveOverride} className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {users.find(u => u.id === overrideUserId)?.first_name} {users.find(u => u.id === overrideUserId)?.last_name} — {overrideDate && dateLabel(overrideDate)}
          </p>
          <Select label="Reason" value={overrideForm.reason} onChange={e => setOverrideForm(p => ({ ...p, reason: e.target.value }))} options={OVERRIDE_OPTIONS} />
          {(overrideForm.reason === 'custom' || overrideForm.reason === 'half_day') && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Start Time" type="time" value={overrideForm.start_time} onChange={e => setOverrideForm(p => ({ ...p, start_time: e.target.value }))} />
              <Input label="End Time" type="time" value={overrideForm.end_time} onChange={e => setOverrideForm(p => ({ ...p, end_time: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100"
              rows={2}
              value={overrideForm.notes}
              onChange={e => setOverrideForm(p => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-between pt-2 border-t dark:border-[#1a1a1a]">
            <div>
              {users.find(u => u.id === overrideUserId)?.overrides?.[overrideDate] && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    const ov = users.find(u => u.id === overrideUserId)?.overrides?.[overrideDate];
                    if (ov) { deleteOverride(ov.id); setShowOverride(false); }
                  }}
                >
                  Remove Override
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowOverride(false)}>Cancel</Button>
              <Button type="submit" disabled={savingOverride}>
                {savingOverride ? 'Saving...' : 'Save Override'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ─── Stat card sub-component ────────────────────────────────────────── */

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="text-sm text-gray-500 dark:text-gray-400">{sub}</p>}
    </Card>
  );
}

/* ─── Team Availability Grid ─────────────────────────────────────────── */

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);

function hourLabelShort(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function AvailabilityView({ users, loading }: { users: ScheduleUser[]; loading: boolean }) {
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const filtered = useMemo(
    () => roleFilter === 'all' ? users : users.filter(u => u.role === roleFilter),
    [users, roleFilter],
  );

  const grid = useMemo(() => {
    const result: { userId: string; name: string; color: typeof EMPLOYEE_COLORS[0]; role: string }[][][] = [];
    for (let di = 0; di < 7; di++) {
      const dayRows: { userId: string; name: string; color: typeof EMPLOYEE_COLORS[0]; role: string }[][] = [];
      for (let h = 0; h < 24; h++) {
        const cell: typeof dayRows[0] = [];
        filtered.forEach((user, ui) => {
          const hours = userHourSet(user.schedule, DAY_KEYS[di]);
          if (hours.has(h)) {
            cell.push({
              userId: user.id,
              name: `${user.first_name} ${user.last_name}`,
              color: EMPLOYEE_COLORS[ui % EMPLOYEE_COLORS.length],
              role: user.role,
            });
          }
        });
        dayRows.push(cell);
      }
      result.push(dayRows);
    }
    return result;
  }, [filtered]);

  const roles = useMemo(() => {
    const s = new Set(users.map(u => u.role));
    return Array.from(s).sort();
  }, [users]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  if (users.length === 0) {
    return <Card><p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">No team members found.</p></Card>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
        <button
          onClick={() => setRoleFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            roleFilter === 'all' ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-600 dark:bg-[#111] dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#1a1a1a]'
          }`}
        >
          All ({users.length})
        </button>
        {roles.map(r => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
              roleFilter === r ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-600 dark:bg-[#111] dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#1a1a1a]'
            }`}
          >
            {r} ({users.filter(u => u.role === r).length})
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {filtered.map((user, i) => (
          <div key={user.id} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#1a1a1a]">
            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length].bg }} />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {user.first_name} {user.last_name}
            </span>
            <span className="text-[10px] text-gray-400 capitalize">({user.role})</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <Card className="!p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 dark:border-[#1a1a1a]">
              <div className="px-2 py-3 text-[10px] font-semibold uppercase text-gray-400" />
              {DAY_NAMES.map((day, i) => (
                <div key={i} className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-l border-gray-100 dark:border-[#111]">
                  {day}
                </div>
              ))}
            </div>

            {/* Hour rows */}
            {HOURS_24.map(h => (
              <div
                key={h}
                className={`grid grid-cols-[60px_repeat(7,1fr)] ${h < 23 ? 'border-b border-gray-100 dark:border-[#0a0a0a]' : ''}`}
              >
                {/* Hour label */}
                <div className="px-2 py-1 flex items-start justify-end">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums leading-none mt-0.5">
                    {hourLabelShort(h)}
                  </span>
                </div>

                {/* 7 day cells */}
                {Array.from({ length: 7 }, (_, di) => {
                  const people = grid[di]?.[h] || [];
                  return (
                    <div
                      key={di}
                      className="relative border-l border-gray-100 dark:border-[#111] min-h-[28px] px-0.5 py-0.5 flex gap-[2px]"
                    >
                      {people.map((p) => (
                        <div
                          key={p.userId}
                          className="flex-1 min-w-[4px] max-w-[20px] rounded-sm relative group"
                          style={{ backgroundColor: p.color.bg }}
                          title={`${p.name} (${p.role})`}
                        >
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block z-30 whitespace-nowrap rounded bg-gray-900 dark:bg-white px-2 py-1 text-[10px] font-medium text-white dark:text-black shadow-lg pointer-events-none">
                            {p.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((user, i) => {
          let totalH = 0;
          DAY_KEYS.forEach(dk => { totalH += scheduledHoursForDay(user.schedule, dk); });
          return (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] px-4 py-3"
            >
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length].bg, color: EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length].text }}>
                {user.first_name[0]}{user.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.first_name} {user.last_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role} &middot; {totalH}h/week</p>
              </div>
              <div className="flex gap-0.5">
                {DAY_KEYS.map((dk, di) => {
                  const hrs = scheduledHoursForDay(user.schedule, dk);
                  return (
                    <div
                      key={dk}
                      className={`h-4 w-1.5 rounded-full ${hrs > 0 ? '' : 'bg-gray-200 dark:bg-[#1a1a1a]'}`}
                      style={hrs > 0 ? { backgroundColor: EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length].bg } : undefined}
                      title={`${DAY_NAMES[di]}: ${hrs > 0 ? hrs + 'h' : 'Off'}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
