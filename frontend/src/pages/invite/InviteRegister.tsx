import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

type Step = 'personal' | 'work' | 'schedule' | 'review';
const STEPS: { key: Step; label: string }[] = [
  { key: 'personal', label: 'Personal Info' },
  { key: 'work', label: 'Work Details' },
  { key: 'schedule', label: 'Availability' },
  { key: 'review', label: 'Review' },
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function gridToRanges(grid: boolean[][]): Record<string, { start: string; end: string }[]> {
  const result: Record<string, { start: string; end: string }[]> = {};
  DAYS.forEach((day, di) => {
    const ranges: { start: string; end: string }[] = [];
    let rangeStart: number | null = null;
    for (let h = 0; h <= 24; h++) {
      const active = h < 24 && grid[di][h];
      if (active && rangeStart === null) rangeStart = h;
      if (!active && rangeStart !== null) {
        ranges.push({ start: `${rangeStart}:00`, end: `${h}:00` });
        rangeStart = null;
      }
    }
    result[day] = ranges;
  });
  return result;
}

function rangeSummary(grid: boolean[][]): Record<string, string> {
  const ranges = gridToRanges(grid);
  const summary: Record<string, string> = {};
  DAYS.forEach((day) => {
    if (ranges[day].length === 0) { summary[day] = 'Off'; return; }
    summary[day] = ranges[day].map(r => `${hourLabel(parseInt(r.start))} – ${hourLabel(parseInt(r.end))}`).join(', ');
  });
  return summary;
}

function initGrid(): boolean[][] {
  return DAYS.map(() => Array(24).fill(false));
}

function roleLabel(r: string) {
  if (r === 'va') return 'VA (Cold Caller)';
  if (r === 'closer') return 'Closer';
  if (r === 'ops') return 'Operations';
  return r;
}

function roleBadge(r: string): 'blue' | 'purple' | 'green' {
  if (r === 'va') return 'blue';
  if (r === 'closer') return 'purple';
  return 'green';
}

export function InviteRegister() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loading, setLoading] = useState(true);
  const [inviteError, setInviteError] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLabel, setInviteLabel] = useState('');

  const [step, setStep] = useState<Step>('personal');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    personal_email: '',
    phone: '',
    password: '',
    confirm_password: '',
    date_of_birth: '',
    join_date: new Date().toISOString().split('T')[0],
    emergency_contact_name: '',
    emergency_contact_phone: '',
    bio: '',
  });

  const [scheduleGrid, setScheduleGrid] = useState<boolean[][]>(initGrid);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invites/verify/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Invalid link' }));
          setInviteError(body.error || 'Invalid invite link');
          return;
        }
        const data = await res.json();
        setInviteRole(data.role);
        if (data.email) {
          setInviteEmail(data.email);
          setForm(prev => ({ ...prev, personal_email: data.email }));
        }
        if (data.label) setInviteLabel(data.label);
      })
      .catch(() => setInviteError('Failed to verify invite link'))
      .finally(() => setLoading(false));
  }, [token]);

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const generatedUsername = form.first_name && form.last_name
    ? `${form.first_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.${form.last_name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    : '';

  const next = () => {
    const idx = STEPS.findIndex(s => s.key === step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
  };

  const prev = () => {
    const idx = STEPS.findIndex(s => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
  };

  const handleSubmit = async (e?: FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setError('');

    if (!form.first_name || !form.last_name || !form.personal_email || !form.phone || !form.password) {
      setError('Please fill in all required fields');
      setStep('personal');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      setStep('personal');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      setStep('personal');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invites/register/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          personal_email: form.personal_email,
          phone: form.phone,
          password: form.password,
          date_of_birth: form.date_of_birth || undefined,
          join_date: form.join_date || undefined,
          emergency_contact_name: form.emergency_contact_name || undefined,
          emergency_contact_phone: form.emergency_contact_phone || undefined,
          bio: form.bio || undefined,
          schedule: gridToRanges(scheduleGrid),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Registration failed' }));
        setError(body.error || 'Registration failed');
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      localStorage.setItem('token', data.token);
      window.location.href = '/';
    } catch {
      setError('Registration failed. Please try again.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black px-4">
        <Card className="max-w-md w-full text-center">
          <div className="py-8">
            <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center dark:bg-red-900/30">
              <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Invalid Invite Link</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{inviteError}</p>
            <Link to="/login" className="mt-4 inline-block text-sm font-medium text-neutral-700 hover:text-neutral-800 dark:text-white">
              Go to login
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 via-white to-neutral-50/50 dark:from-black dark:via-black dark:to-black py-10 px-4">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.jpeg" alt="NWS Media" className="mx-auto h-12 w-12 rounded-xl object-cover" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Join NWS Media</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You've been invited to join as
          </p>
          <span className="mt-2 inline-block">
            <Badge variant={roleBadge(inviteRole)}>{roleLabel(inviteRole)}</Badge>
          </span>
          {inviteLabel && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{inviteLabel}</p>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex mb-8">
          {STEPS.map((s, i) => {
            const idx = STEPS.findIndex(x => x.key === step);
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={s.key} className="flex-1 flex flex-col items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  done ? 'bg-neutral-900 text-white' : active ? 'bg-neutral-900 text-white ring-4 ring-neutral-100 dark:ring-neutral-800' : 'bg-gray-200 text-gray-500 dark:bg-[#111] dark:text-gray-400'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`mt-1 text-xs ${active ? 'font-semibold text-neutral-800 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Step 1: Personal */}
          {step === 'personal' && (
            <Card title="Personal Information">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="First Name *" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="John" />
                  <Input label="Last Name *" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Smith" />
                </div>

                {generatedUsername && (
                  <div className="rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-3 dark:bg-[#111] dark:border-neutral-800">
                    <p className="text-sm text-neutral-800 dark:text-neutral-300">
                      Your username: <span className="font-semibold">{generatedUsername}</span>
                    </p>
                    <p className="text-xs text-neutral-700 dark:text-white mt-0.5">
                      Work email: {generatedUsername}@nwsmediaemail.com
                    </p>
                  </div>
                )}

                <Input label="Personal Email *" type="email" required value={form.personal_email} onChange={(e) => set('personal_email', e.target.value)} placeholder="john@gmail.com" />
                <Input label="Phone *" type="tel" required value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 123-4567" />

                <div className="grid grid-cols-2 gap-4">
                  <Input label="Password *" type="password" required value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min 8 characters" />
                  <Input label="Confirm Password *" type="password" required value={form.confirm_password} onChange={(e) => set('confirm_password', e.target.value)} placeholder="Re-enter password" />
                </div>

                <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />

                <div className="flex justify-end pt-2">
                  <button type="button" onClick={next} className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition-colors hover:bg-blue-700">
                    Next
                    <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 2: Work */}
          {step === 'work' && (
            <Card title="Work Details">
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 border p-4 dark:bg-[#0a0a0a] dark:border-[#1a1a1a]">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-800 dark:text-gray-200">Your role:</span>{' '}
                    <Badge variant={roleBadge(inviteRole)}>{roleLabel(inviteRole)}</Badge>
                  </p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {inviteRole === 'va' && 'Qualify leads through cold calling and hand them to closers.'}
                    {inviteRole === 'closer' && 'Close deals from qualified leads and manage your pipeline.'}
                    {inviteRole === 'ops' && 'Manage projects after deals are won, coordinate deliverables.'}
                  </p>
                </div>

                <Input label="Start Date" type="date" value={form.join_date} onChange={(e) => set('join_date', e.target.value)} />

                <div className="border-t pt-4 dark:border-[#1a1a1a]">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Emergency Contact</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Contact Name" value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)} placeholder="Jane Smith" />
                    <Input label="Contact Phone" type="tel" value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)} placeholder="(555) 987-6543" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Short Bio</label>
                  <textarea
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100"
                    rows={3}
                    value={form.bio}
                    onChange={(e) => set('bio', e.target.value)}
                    placeholder="A few words about yourself..."
                  />
                </div>

                <div className="flex justify-between pt-2">
                  <button type="button" onClick={prev} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-[#333] dark:bg-[#1a1a1a] dark:text-gray-200">
                    <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    Back
                  </button>
                  <button type="button" onClick={next} className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition-colors hover:bg-blue-700">
                    Next
                    <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 3: Schedule */}
          {step === 'schedule' && (
            <Card title="Weekly Availability">
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Click or drag to mark the hours you're available. Supports gaps (e.g. morning + evening).
                </p>
                <AvailabilityGrid grid={scheduleGrid} onChange={setScheduleGrid} />

                <div className="flex justify-between pt-2">
                  <button type="button" onClick={prev} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-[#333] dark:bg-[#1a1a1a] dark:text-gray-200">
                    <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    Back
                  </button>
                  <button type="button" onClick={next} className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition-colors hover:bg-blue-700">
                    Review
                    <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 4: Review */}
          {step === 'review' && (
            <Card title="Review Your Information">
              <div className="space-y-5">
                <Section title="Personal">
                  <Pair label="Name" value={`${form.first_name} ${form.last_name}`} />
                  <Pair label="Email" value={form.personal_email} />
                  <Pair label="Phone" value={form.phone} />
                  <Pair label="Username" value={generatedUsername} />
                  {form.date_of_birth && <Pair label="DOB" value={form.date_of_birth} />}
                </Section>

                <Section title="Work">
                  <Pair label="Role" value={roleLabel(inviteRole)} />
                  <Pair label="Start Date" value={form.join_date} />
                  {form.emergency_contact_name && (
                    <Pair label="Emergency" value={`${form.emergency_contact_name} (${form.emergency_contact_phone})`} />
                  )}
                  {form.bio && <Pair label="Bio" value={form.bio} />}
                </Section>

                <Section title="Availability">
                  {(() => {
                    const summary = rangeSummary(scheduleGrid);
                    return DAYS.map((day) => (
                      <Pair
                        key={day}
                        label={day.charAt(0).toUpperCase() + day.slice(1)}
                        value={summary[day]}
                      />
                    ));
                  })()}
                </Section>

                <div className="flex justify-between pt-4 border-t dark:border-[#1a1a1a]">
                  <button type="button" onClick={prev} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-[#333] dark:bg-[#1a1a1a] dark:text-gray-200">
                    <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    Back
                  </button>
                  <button type="button" disabled={submitting} onClick={handleSubmit} className="inline-flex items-center rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white shadow transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {submitting ? 'Creating account...' : 'Create Account'}
                  </button>
                </div>
              </div>
            </Card>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Powered by NWS Media CRM
        </p>
      </div>
    </div>
  );
}

function AvailabilityGrid({ grid, onChange }: { grid: boolean[][]; onChange: (g: boolean[][]) => void }) {
  const dragging = useRef(false);
  const paintVal = useRef(true);
  const gridRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback((di: number, hi: number, val?: boolean) => {
    const next = grid.map((r: boolean[]) => [...r]);
    next[di][hi] = val !== undefined ? val : !next[di][hi];
    onChange(next);
  }, [grid, onChange]);

  const onPointerDown = useCallback((di: number, hi: number) => {
    dragging.current = true;
    paintVal.current = !grid[di][hi];
    toggle(di, hi, paintVal.current);
  }, [grid, toggle]);

  const onPointerEnter = useCallback((di: number, hi: number) => {
    if (!dragging.current) return;
    toggle(di, hi, paintVal.current);
  }, [toggle]);

  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const clearAll = () => onChange(initGrid());
  const fillWeekdays = () => {
    onChange(DAYS.map((_, di) => {
      return HOURS.map(h => di < 5 && h >= 9 && h < 17);
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={fillWeekdays} className="text-xs font-medium text-neutral-700 hover:text-neutral-800 dark:text-white dark:hover:text-neutral-300">
          9–5 Weekdays
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button type="button" onClick={clearAll} className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          Clear All
        </button>
      </div>

      <div
        ref={gridRef}
        className="select-none overflow-x-auto rounded-lg border border-gray-200 dark:border-[#1a1a1a]"
        onContextMenu={e => e.preventDefault()}
      >
        <div className="min-w-[420px]">
          {/* Day headers */}
          <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-gray-200 dark:border-[#1a1a1a] bg-gray-50 dark:bg-[#0a0a0a]">
            <div className="p-1" />
            {DAY_SHORT.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">{d}</div>
            ))}
          </div>

          {/* Hour rows */}
          <div className="max-h-[400px] overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {HOURS.map(h => (
              <div key={h} className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-gray-100 dark:border-[#0a0a0a] last:border-b-0">
                <div className="flex items-center justify-end pr-2 text-[10px] text-gray-400 dark:text-gray-500 h-7">
                  {hourLabel(h)}
                </div>
                {DAYS.map((_, di) => (
                  <div
                    key={di}
                    className={`h-7 border-l border-gray-100 dark:border-[#0a0a0a] cursor-pointer transition-colors ${
                      grid[di][h]
                        ? 'bg-neutral-800 dark:bg-neutral-800'
                        : 'hover:bg-gray-100 dark:hover:bg-[#111]'
                    }`}
                    onPointerDown={(e) => { e.preventDefault(); onPointerDown(di, h); }}
                    onPointerEnter={() => onPointerEnter(di, h)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-neutral-800" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-gray-300 dark:border-[#262626]" /> Unavailable
        </span>
        <span className="ml-auto">Click or drag to toggle</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}
