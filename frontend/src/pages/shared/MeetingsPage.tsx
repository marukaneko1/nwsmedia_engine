import { useState, useEffect, FormEvent } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

type Participant = {
  user_id: string;
  status: string;
  first_name: string;
  last_name: string;
};

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  recurrence: string;
  google_meet_link: string | null;
  channel_id: string | null;
  created_by_id: string;
  status: string;
  created_at: string;
  creator_first: string;
  creator_last: string;
  participants: Participant[] | null;
};

type TeamUser = { id: string; first_name: string; last_name: string; role: string };

function formatDate(d: string) {
  const dt = new Date(d);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dt.toDateString() === now.toDateString()) return 'Today';
  if (dt.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function statusBadge(s: string): 'green' | 'blue' | 'gray' | 'red' {
  if (s === 'scheduled') return 'blue';
  if (s === 'in_progress') return 'green';
  if (s === 'completed') return 'gray';
  return 'red';
}

function rsvpBadge(s: string): 'green' | 'yellow' | 'red' {
  if (s === 'accepted') return 'green';
  if (s === 'declined') return 'red';
  return 'yellow';
}

export function MeetingsPage() {
  const { user } = useAuth();
  const [showPast, setShowPast] = useState(false);
  const { data, loading, refetch } = useApiQuery<{ meetings: Meeting[] }>(`/meetings?past=${showPast}`, [showPast]);
  const meetings = data?.meetings ?? [];

  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [allUsers, setAllUsers] = useState<TeamUser[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    title: '',
    description: '',
    scheduled_at: '',
    scheduled_time: '10:00',
    duration_minutes: '30',
    recurrence: 'none',
  });

  useEffect(() => {
    api.get<{ configured: boolean }>('/meetings/google-status')
      .then(res => setGoogleConfigured(res.configured))
      .catch(() => {});
    api.get<{ users: TeamUser[] }>('/chat/users')
      .then(res => setAllUsers(res.users))
      .catch(() => {});
  }, []);

  const toggleParticipant = (id: string) => {
    setSelectedParticipants(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedParticipants(new Set(allUsers.map(u => u.id)));
  };

  const handleSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.scheduled_at) return;

    setScheduling(true);
    try {
      const scheduledAt = new Date(`${form.scheduled_at}T${form.scheduled_time}`).toISOString();
      await api.post('/meetings', {
        title: form.title,
        description: form.description || undefined,
        scheduled_at: scheduledAt,
        duration_minutes: parseInt(form.duration_minutes) || 30,
        recurrence: form.recurrence,
        participant_ids: Array.from(selectedParticipants),
      });
      setShowSchedule(false);
      setForm({ title: '', description: '', scheduled_at: '', scheduled_time: '10:00', duration_minutes: '30', recurrence: 'none' });
      setSelectedParticipants(new Set());
      refetch();
    } catch { /* silent */ }
    setScheduling(false);
  };

  const handleRSVP = async (meetingId: string, status: string) => {
    try {
      await api.post(`/meetings/${meetingId}/rsvp`, { status });
      refetch();
    } catch { /* silent */ }
  };

  const handleCancel = async (meetingId: string) => {
    try {
      await api.delete(`/meetings/${meetingId}`);
      refetch();
    } catch { /* silent */ }
  };

  const prefillWeeklyCheckup = () => {
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
    setForm({
      title: 'Weekly Team Check-up',
      description: 'Weekly all-hands sync to discuss progress, blockers, and goals.',
      scheduled_at: nextMonday.toISOString().split('T')[0],
      scheduled_time: '10:00',
      duration_minutes: '30',
      recurrence: 'weekly',
    });
    selectAll();
    setShowSchedule(true);
  };

  // Group meetings by date
  const grouped: Record<string, Meeting[]> = {};
  for (const m of meetings) {
    const key = new Date(m.scheduled_at).toDateString();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="mt-1 text-sm text-gray-500">{meetings.length} upcoming meeting{meetings.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={prefillWeeklyCheckup}>
            Weekly Check-up
          </Button>
          <Button onClick={() => setShowSchedule(true)}>
            Schedule Meeting
          </Button>
        </div>
      </div>

      {!googleConfigured && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
          Google Meet is not configured. Meetings will be created without video links. Add Google credentials in your .env to enable Meet links.
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setShowPast(false)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${!showPast ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-600 dark:bg-[#0a0a0a] dark:text-gray-400'}`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setShowPast(true)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${showPast ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-600 dark:bg-[#0a0a0a] dark:text-gray-400'}`}
        >
          All
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
        </div>
      ) : meetings.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No meetings scheduled. Create one to get started.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateStr, dateMeetings]) => (
            <div key={dateStr}>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">{formatDate(dateMeetings[0].scheduled_at)}</h3>
              <div className="space-y-3">
                {dateMeetings.map(m => {
                  const myParticipant = m.participants?.find(p => p.user_id === user?.id);
                  const isCreator = m.created_by_id === user?.id;
                  return (
                    <Card key={m.id}>
                      <div className="flex flex-wrap items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{m.title}</h4>
                            <Badge variant={statusBadge(m.status)}>{m.status.replace('_', ' ')}</Badge>
                            {m.recurrence !== 'none' && <Badge variant="purple">{m.recurrence}</Badge>}
                          </div>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {formatTime(m.scheduled_at)} &middot; {m.duration_minutes} min &middot; by {m.creator_first} {m.creator_last}
                          </p>
                          {m.description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{m.description}</p>}

                          {/* Participants */}
                          {m.participants && m.participants.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {m.participants.map(p => (
                                <span key={p.user_id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs dark:bg-[#111]">
                                  <span className={`h-1.5 w-1.5 rounded-full ${p.status === 'accepted' ? 'bg-green-500' : p.status === 'declined' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                                  <span className="text-gray-700 dark:text-gray-300">{p.first_name} {p.last_name}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 items-end shrink-0">
                          {m.google_meet_link && m.status !== 'cancelled' && (
                            <a
                              href={m.google_meet_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Join Meet
                            </a>
                          )}

                          {myParticipant && myParticipant.status === 'invited' && m.status !== 'cancelled' && (
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => handleRSVP(m.id, 'accepted')}>Accept</Button>
                              <Button size="sm" variant="ghost" onClick={() => handleRSVP(m.id, 'declined')}>Decline</Button>
                            </div>
                          )}

                          {isCreator && m.status === 'scheduled' && (
                            <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => handleCancel(m.id)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Schedule Meeting Modal ──────────────────────────────────── */}
      <Modal open={showSchedule} onClose={() => setShowSchedule(false)} title="Schedule Meeting" size="lg">
        <form onSubmit={handleSchedule} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <Input label="Title *" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Weekly Team Sync" />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100"
              rows={2}
              value={form.description}
              onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Agenda or notes..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Date *" type="date" value={form.scheduled_at} onChange={(e) => setForm(p => ({ ...p, scheduled_at: e.target.value }))} />
            <Input label="Time *" type="time" value={form.scheduled_time} onChange={(e) => setForm(p => ({ ...p, scheduled_time: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select label="Duration" value={form.duration_minutes} onChange={(e) => setForm(p => ({ ...p, duration_minutes: e.target.value }))} options={[
              { value: '15', label: '15 minutes' },
              { value: '30', label: '30 minutes' },
              { value: '45', label: '45 minutes' },
              { value: '60', label: '1 hour' },
              { value: '90', label: '1.5 hours' },
              { value: '120', label: '2 hours' },
            ]} />
            <Select label="Recurrence" value={form.recurrence} onChange={(e) => setForm(p => ({ ...p, recurrence: e.target.value }))} options={[
              { value: 'none', label: 'One-time' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'biweekly', label: 'Bi-weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Participants</label>
              <button type="button" onClick={selectAll} className="text-xs text-neutral-700 hover:text-neutral-800 dark:text-white">Select all</button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-[#1a1a1a]">
              {allUsers.map(u => (
                <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-[#111] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedParticipants.has(u.id)}
                    onChange={() => toggleParticipant(u.id)}
                    className="rounded border-gray-300 text-neutral-700 focus:ring-neutral-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{u.first_name} {u.last_name}</span>
                  <span className="text-xs text-gray-400 capitalize">{u.role}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{selectedParticipants.size} selected</p>
          </div>

          {!googleConfigured && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              Google Meet is not configured. The meeting will be created without a video link.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t dark:border-[#1a1a1a]">
            <Button type="button" variant="secondary" onClick={() => setShowSchedule(false)}>Cancel</Button>
            <Button type="submit" disabled={scheduling || !form.title || !form.scheduled_at}>
              {scheduling ? 'Scheduling...' : 'Schedule Meeting'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
