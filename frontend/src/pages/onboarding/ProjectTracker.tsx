import { useState, useEffect, Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

type Milestone = { title: string; description?: string; due_date?: string; completed_at?: string | null; sort_order: number };
type Payment = { payment_type: string; amount: string; status: string; due_date?: string; paid_at?: string };
type Project = {
  company_name: string; contact_name: string; project_name: string;
  services_contracted: string[]; contract_value: string;
  project_status: string; current_phase: string;
  kickoff_date?: string; expected_delivery_date?: string;
  total_paid: string; balance_due: string;
  revision_limit: number; revisions_used: number;
};

function formatMoney(v: unknown) {
  const n = Number(v);
  return Number.isNaN(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started', in_progress: 'In Progress', in_review: 'In Review',
  revision_requested: 'Revision Requested', completed: 'Completed', on_hold: 'On Hold',
};

const STATUS_VARIANT: Record<string, 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'purple'> = {
  not_started: 'gray', in_progress: 'blue', in_review: 'yellow',
  revision_requested: 'purple', completed: 'green', on_hold: 'red',
};

export function ProjectTracker() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/${token}/project`);
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed to load'); setLoading(false); return; }
        setProject(data.project);
        setMilestones(data.milestones || []);
        setPayments(data.payments || []);
        setLoading(false);
      } catch { setError('Failed to load project'); setLoading(false); }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-gray-950 dark:to-gray-900">
        <div className="flex items-center gap-3 rounded-2xl border bg-white px-8 py-6 shadow-sm dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
          <div className="h-8 w-8 shrink-0 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin" />
          <p className="text-sm text-slate-600 dark:text-gray-400">Loading your project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-gray-950 dark:to-gray-900 px-4">
        <div className="rounded-2xl border bg-white p-8 shadow-sm dark:border-[#1a1a1a] dark:bg-[#0a0a0a] text-center max-w-md">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{error || 'Project not found'}</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Please contact your project manager.</p>
        </div>
      </div>
    );
  }

  const completedCount = milestones.filter((m) => m.completed_at).length;
  const progressPct = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-sky-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-sky-100/90 bg-white/90 backdrop-blur-md dark:border-[#1a1a1a] dark:bg-black/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="NWS Media" className="h-10 w-10 rounded-xl object-cover shadow-md shadow-sky-200/40" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">NWS Media</p>
              <p className="text-xs text-sky-600 dark:text-sky-400">Project Tracker</p>
            </div>
          </div>
          <Link to={`/onboarding/${token}`} className="text-sm font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300">
            Edit Onboarding Info
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        {/* Project overview */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-gray-100">{project.project_name || project.company_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[project.project_status] || 'gray'}>{STATUS_LABELS[project.project_status] || project.project_status}</Badge>
            {project.current_phase && <Badge variant="blue">{project.current_phase}</Badge>}
          </div>
        </div>

        {/* Key info cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MiniCard label="Services" value={project.services_contracted?.join(', ')?.replace(/_/g, ' ') || '—'} />
          <MiniCard label="Kickoff" value={formatDate(project.kickoff_date)} />
          <MiniCard label="Expected Delivery" value={formatDate(project.expected_delivery_date)} />
          <MiniCard label="Revisions" value={`${project.revisions_used} / ${project.revision_limit} used`} />
        </div>

        {/* Progress */}
        <Card title="Project Progress">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{completedCount} of {milestones.length} milestones complete</span>
              <span className="text-sm font-bold text-sky-600 dark:text-sky-400">{progressPct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-[#111]">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-brand-600 transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {milestones.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Milestones will appear here once your project kicks off.</p>
          ) : (
            <div className="space-y-3 mt-4">
              {milestones.map((m, i) => {
                const done = !!m.completed_at;
                const isCurrent = !done && (i === 0 || !!milestones[i - 1]?.completed_at);
                return (
                  <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    done ? 'border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-900/10'
                    : isCurrent ? 'border-sky-200 bg-sky-50/50 dark:border-sky-800/40 dark:bg-sky-900/10 ring-1 ring-sky-200 dark:ring-sky-800'
                    : 'border-gray-200 dark:border-[#1a1a1a]'
                  }`}>
                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      done ? 'bg-green-500 text-white' : isCurrent ? 'bg-sky-500 text-white' : 'bg-gray-200 text-gray-500 dark:bg-[#111] dark:text-gray-400'
                    }`}>
                      {done ? (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <span className="text-xs font-semibold">{i + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${done ? 'text-green-800 dark:text-green-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>{m.title}</p>
                      {m.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {done ? (
                        <span className="text-xs text-green-600 dark:text-green-400">Completed {formatDate(m.completed_at)}</span>
                      ) : m.due_date ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">Due {formatDate(m.due_date)}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Payments */}
        <Card title="Payments">
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div className="rounded-lg border p-4 dark:border-[#1a1a1a]">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Paid</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatMoney(project.total_paid)}</p>
            </div>
            <div className="rounded-lg border p-4 dark:border-[#1a1a1a]">
              <p className="text-xs text-gray-500 dark:text-gray-400">Balance Due</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatMoney(project.balance_due)}</p>
            </div>
          </div>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No payment records yet.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3 dark:border-[#1a1a1a]">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{p.payment_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.paid_at ? `Paid ${formatDate(p.paid_at)}` : p.due_date ? `Due ${formatDate(p.due_date)}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatMoney(p.amount)}</p>
                    <Badge variant={p.status === 'paid' ? 'green' : p.status === 'overdue' ? 'red' : 'yellow'}>{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 pb-8">
          Powered by NWS Media CRM
        </p>
      </main>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4 dark:border-[#1a1a1a]">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">{value}</p>
    </div>
  );
}
