import { useState, useEffect, FormEvent } from 'react';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

type TimeEntry = {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  activity_type: string;
  notes: string | null;
};

const ACTIVITY_OPTIONS = [
  { value: 'cold_calls', label: 'Cold Calls' },
  { value: 'follow_ups', label: 'Follow-ups' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'admin_tasks', label: 'Admin Tasks' },
  { value: 'training', label: 'Training' },
  { value: 'break', label: 'Break' },
  { value: 'other', label: 'Other' },
];

const ACTIVITY_COLORS: Record<string, string> = {
  cold_calls: 'blue',
  follow_ups: 'purple',
  meetings: 'green',
  admin_tasks: 'gray',
  training: 'yellow',
  break: 'red',
  other: 'gray',
};

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(min: number | null) {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getWeekDates(offset: number = 0): { start: string; end: string; days: string[] } {
  const d = new Date();
  d.setDate(d.getDate() + offset * 7);
  const day = d.getDay();
  const mondayDiff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayDiff);
  monday.setHours(0, 0, 0, 0);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    days.push(dd.toISOString().split('T')[0]);
  }

  return {
    start: days[0],
    end: days[6],
    days,
  };
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function shortDay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString([], { weekday: 'short' });
}

export function TimesheetPage() {
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [clockInActivity, setClockInActivity] = useState('other');
  const [clockOutNotes, setClockOutNotes] = useState('');

  const [weekOffset, setWeekOffset] = useState(0);
  const week = getWeekDates(weekOffset);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(false);

  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '17:00',
    activity_type: 'other',
    notes: '',
  });
  const [submittingManual, setSubmittingManual] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Fetch current clock status
  useEffect(() => {
    api.get<{ entry: TimeEntry | null }>('/time/current')
      .then(res => setCurrentEntry(res.entry))
      .catch(() => {});
  }, []);

  // Fetch week entries
  useEffect(() => {
    setLoadingWeek(true);
    api.get<{ entries: TimeEntry[] }>(`/time/my-entries?from=${week.start}&to=${week.end}`)
      .then(res => setWeekEntries(res.entries))
      .catch(() => {})
      .finally(() => setLoadingWeek(false));
  }, [week.start, week.end]);

  const handleClockIn = async () => {
    setClockingIn(true);
    try {
      const res = await api.post<{ entry: TimeEntry }>('/time/clock-in', { activity_type: clockInActivity });
      setCurrentEntry(res.entry);
    } catch { /* silent */ }
    setClockingIn(false);
  };

  const handleClockOut = async () => {
    setClockingOut(true);
    try {
      const res = await api.post<{ entry: TimeEntry }>('/time/clock-out', { notes: clockOutNotes || undefined });
      setCurrentEntry(null);
      setClockOutNotes('');
      // Refresh week entries
      const updated = await api.get<{ entries: TimeEntry[] }>(`/time/my-entries?from=${week.start}&to=${week.end}`);
      setWeekEntries(updated.entries);
    } catch { /* silent */ }
    setClockingOut(false);
  };

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmittingManual(true);
    try {
      const clockIn = `${manualForm.date}T${manualForm.start_time}:00`;
      const clockOut = `${manualForm.date}T${manualForm.end_time}:00`;
      await api.post('/time/manual', {
        clock_in: clockIn,
        clock_out: clockOut,
        activity_type: manualForm.activity_type,
        notes: manualForm.notes || undefined,
      });
      setShowManual(false);
      setManualForm({ date: today, start_time: '09:00', end_time: '17:00', activity_type: 'other', notes: '' });
      const updated = await api.get<{ entries: TimeEntry[] }>(`/time/my-entries?from=${week.start}&to=${week.end}`);
      setWeekEntries(updated.entries);
    } catch { /* silent */ }
    setSubmittingManual(false);
  };

  // Elapsed time for current clock-in
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!currentEntry) { setElapsed(''); return; }
    const update = () => {
      const diff = Date.now() - new Date(currentEntry.clock_in).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [currentEntry]);

  // Group entries by day for weekly view
  const entriesByDay: Record<string, TimeEntry[]> = {};
  for (const day of week.days) entriesByDay[day] = [];
  for (const e of weekEntries) {
    const day = new Date(e.clock_in).toISOString().split('T')[0];
    if (entriesByDay[day]) entriesByDay[day].push(e);
  }

  const dailyTotals: Record<string, number> = {};
  for (const day of week.days) {
    dailyTotals[day] = entriesByDay[day].reduce((s, e) => s + (e.duration_minutes || 0), 0);
  }

  const weekTotal = Object.values(dailyTotals).reduce((s, m) => s + m, 0);
  const todayEntries = entriesByDay[today] || [];

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Timesheet</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Track your work hours and activities</p>
        </div>
        <Button variant="secondary" onClick={() => setShowManual(true)}>
          + Log Entry
        </Button>
      </div>

      {/* ── Clock In/Out Banner ──────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-center gap-6">
          {currentEntry ? (
            <>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Clocked In</span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Since {formatTime(currentEntry.clock_in)} &middot; {elapsed} &middot;{' '}
                  <Badge variant={ACTIVITY_COLORS[currentEntry.activity_type] as any || 'gray'}>
                    {currentEntry.activity_type.replace('_', ' ')}
                  </Badge>
                </p>
              </div>
              <div className="flex items-end gap-2">
                <div className="w-48">
                  <Input
                    placeholder="Notes (optional)"
                    value={clockOutNotes}
                    onChange={e => setClockOutNotes(e.target.value)}
                  />
                </div>
                <Button variant="danger" onClick={handleClockOut} disabled={clockingOut}>
                  {clockingOut ? 'Clocking out...' : 'Clock Out'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Not Clocked In</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Start your day by clocking in</p>
              </div>
              <div className="flex items-end gap-2">
                <Select
                  value={clockInActivity}
                  onChange={e => setClockInActivity(e.target.value)}
                  options={ACTIVITY_OPTIONS}
                />
                <Button onClick={handleClockIn} disabled={clockingIn}>
                  {clockingIn ? 'Clocking in...' : 'Clock In'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ── Weekly Hours View ────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Weekly Hours</h2>
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
          </div>
        </div>

        {loadingWeek ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {week.days.map(day => {
                const mins = dailyTotals[day];
                const hours = +(mins / 60).toFixed(1);
                const isToday = day === today;
                const target = 8;
                const pct = Math.min((hours / target) * 100, 100);
                const color = hours >= target ? 'bg-green-500' : hours > 0 ? 'bg-yellow-500' : 'bg-gray-200 dark:bg-[#111]';

                return (
                  <div key={day} className={`rounded-lg p-3 text-center ${isToday ? 'ring-2 ring-neutral-500 bg-neutral-50 dark:bg-[#111]' : 'bg-gray-50 dark:bg-[#0a0a0a]'}`}>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{shortDay(day)}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{hours}h</p>
                    <div className="h-1.5 rounded-full bg-gray-200 dark:bg-[#111] mt-2 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 dark:border-[#1a1a1a] pt-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">Week of {dayLabel(week.start)}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Total: {(weekTotal / 60).toFixed(1)}h
              </p>
            </div>
          </>
        )}
      </Card>

      {/* ── Today's Log ──────────────────────────────────────────────── */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Today's Log</h2>
        {todayEntries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No entries logged today.</p>
        ) : (
          <div className="space-y-2">
            {todayEntries.map(entry => (
              <div key={entry.id} className="flex items-center gap-4 rounded-lg border border-gray-200 dark:border-[#1a1a1a] px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={ACTIVITY_COLORS[entry.activity_type] as any || 'gray'}>
                      {entry.activity_type.replace('_', ' ')}
                    </Badge>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {formatTime(entry.clock_in)}
                      {entry.clock_out ? ` – ${formatTime(entry.clock_out)}` : ' – now'}
                    </span>
                  </div>
                  {entry.notes && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{entry.notes}</p>}
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                  {entry.clock_out ? formatDuration(entry.duration_minutes) : elapsed}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Manual Entry Modal ───────────────────────────────────────── */}
      <Modal open={showManual} onClose={() => setShowManual(false)} title="Log Time Entry" size="md">
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <Input label="Date" type="date" value={manualForm.date} onChange={e => setManualForm(p => ({ ...p, date: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Time" type="time" value={manualForm.start_time} onChange={e => setManualForm(p => ({ ...p, start_time: e.target.value }))} />
            <Input label="End Time" type="time" value={manualForm.end_time} onChange={e => setManualForm(p => ({ ...p, end_time: e.target.value }))} />
          </div>
          <Select label="Activity" value={manualForm.activity_type} onChange={e => setManualForm(p => ({ ...p, activity_type: e.target.value }))} options={ACTIVITY_OPTIONS} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100"
              rows={2}
              value={manualForm.notes}
              onChange={e => setManualForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="What did you work on?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t dark:border-[#1a1a1a]">
            <Button type="button" variant="secondary" onClick={() => setShowManual(false)}>Cancel</Button>
            <Button type="submit" disabled={submittingManual}>
              {submittingManual ? 'Saving...' : 'Save Entry'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
