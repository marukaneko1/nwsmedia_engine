import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

async function portalApi(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('portal_token');
  const res = await fetch(`/api/portal${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers as any },
  });
  return res.json();
}

const TIMELINE_STEPS = ['Kickoff', 'Design', 'Development', 'Launch'] as const;

function getTimelineStep(client: Record<string, unknown>, projects: Record<string, unknown>[]): number {
  const phase = String(client.current_phase || '').toLowerCase();
  const status = String(client.project_status || '').toLowerCase();
  const milestone = String((projects[0] as Record<string, unknown> | undefined)?.current_milestone || '').toLowerCase();
  const haystack = `${phase} ${status} ${milestone}`;

  if (/(launch|complete|delivered|live|shipped)/.test(haystack)) return 3;
  if (/(develop|development|build|dev|implementation)/.test(haystack)) return 2;
  if (/(design)/.test(haystack)) return 1;
  if (/(kickoff|not_started|discovery|onboarding|start)/.test(haystack)) return 0;
  return 0;
}

function formatMoney(value: unknown): string {
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export function PortalDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<{
    client: Record<string, unknown>;
    projects: Record<string, unknown>[];
    files: Record<string, unknown>[];
    payments: Record<string, unknown>[];
  } | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('portal_token')) {
      navigate('/portal/login', { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      const data = await portalApi('/dashboard');
      if (cancelled) return;
      if (data.error) {
        if (data.error === 'Authentication required' || data.error === 'Invalid or expired token') {
          localStorage.removeItem('portal_token');
          navigate('/portal/login', { replace: true });
          return;
        }
        setError(data.error);
        setLoading(false);
        return;
      }
      setPayload({
        client: data.client,
        projects: data.projects || [],
        files: data.files || [],
        payments: data.payments || [],
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem('portal_token');
    navigate('/portal/login', { replace: true });
  };

  const handleMakePayment = () => {
    const pending = payload?.payments?.find((p) => String(p.status) === 'pending') as { slug?: string } | undefined;
    if (pending?.slug) {
      navigate(`/pay/${pending.slug}`);
      return;
    }
    window.alert('No open payment link on file. Your ops contact can send one if you have a balance.');
  };

  if (loading || !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white">
        <div className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-white px-8 py-6 shadow-sm">
          <div className="h-8 w-8 shrink-0 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin" aria-hidden />
          <p className="text-sm text-slate-600">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
        <p className="text-sm text-red-700">{error}</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/portal/login')}>
          Back to login
        </Button>
      </div>
    );
  }

  const { client, projects, files } = payload;
  const contactName = String(client.contact_name || 'there');
  const companyName = String(client.company_name || 'Your company');
  const currentStep = getTimelineStep(client, projects);
  const recentFiles = files.slice(0, 6);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/90 via-white to-sky-50/50">
      <header className="sticky top-0 z-10 border-b border-sky-100/90 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="NWS Media" className="h-10 w-10 rounded-xl object-cover shadow-md shadow-sky-200/40" />
            <div>
              <p className="text-sm font-semibold text-slate-800">NWS Media</p>
              <p className="text-xs text-sky-600/90">Client Portal</p>
            </div>
          </div>
          <Button variant="ghost" className="text-slate-600 hover:bg-sky-50" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome, {contactName}
          </h1>
          <p className="mt-1 text-slate-600">{companyName}</p>
        </div>

        <Card className="border-sky-100 bg-white/90 shadow-sky-100/30" title="Project timeline">
          <div className="px-1 pt-2">
            <div className="flex w-full items-center">
              {TIMELINE_STEPS.map((label, index) => {
                const isComplete = index < currentStep;
                const isCurrent = index === currentStep;
                const isLast = index === TIMELINE_STEPS.length - 1;
                const segmentDone = index < currentStep;

                return (
                  <Fragment key={label}>
                    <div
                      className={`relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                        isComplete
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : isCurrent
                            ? 'border-sky-600 bg-white text-sky-700 ring-4 ring-sky-100'
                            : 'border-slate-200 bg-white text-slate-400'
                      }`}
                    >
                      {isComplete ? (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className={`mx-1 h-0.5 min-h-[2px] min-w-[6px] flex-1 rounded-full sm:mx-2 ${segmentDone ? 'bg-sky-500' : 'bg-slate-200'}`}
                        aria-hidden
                      />
                    )}
                  </Fragment>
                );
              })}
            </div>
            <div className="mt-4 flex w-full justify-between gap-1">
              {TIMELINE_STEPS.map((label, index) => {
                const isComplete = index < currentStep;
                const isCurrent = index === currentStep;
                return (
                  <p
                    key={`${label}-cap`}
                    className={`max-w-[24%] flex-1 text-center text-xs font-medium sm:text-sm ${
                      isCurrent ? 'text-sky-800' : isComplete ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </p>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-sky-100 bg-white/90 shadow-sky-100/30" title="Payments">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Total paid</dt>
                <dd className="font-semibold text-slate-900">{formatMoney(client.total_paid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Balance due</dt>
                <dd className="font-semibold text-slate-900">{formatMoney(client.balance_due)}</dd>
              </div>
            </dl>
            <Button className="mt-6 w-full bg-sky-600 hover:bg-sky-700 focus:ring-sky-500" onClick={handleMakePayment}>
              Make Payment
            </Button>
          </Card>

          <Card className="border-sky-100 bg-white/90 shadow-sky-100/30" title="Quick actions">
            <div className="flex flex-col gap-3">
              <Button variant="secondary" className="w-full justify-center border-sky-200 hover:bg-sky-50" onClick={() => navigate('/portal/files')}>
                View Files
              </Button>
              <Button variant="secondary" className="w-full justify-center border-sky-200 hover:bg-sky-50" onClick={() => navigate('/portal/revision')}>
                Request Revision
              </Button>
              <Button variant="secondary" className="w-full justify-center border-sky-200 hover:bg-sky-50" onClick={() => navigate('/portal/referral')}>
                Submit Referral
              </Button>
            </div>
          </Card>
        </div>

        <Card className="border-sky-100 bg-white/90 shadow-sky-100/30" title="Recent files">
          {recentFiles.length === 0 ? (
            <p className="text-sm text-slate-500">No files shared with you yet.</p>
          ) : (
            <ul className="divide-y divide-sky-100">
              {recentFiles.map((f) => {
                const name = String(f.original_filename || f.filename || 'File');
                const created = f.created_at ? new Date(String(f.created_at)).toLocaleDateString() : '';
                const ft = f.file_type ? String(f.file_type) : 'file';
                return (
                  <li key={String(f.id)} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{name}</p>
                      <p className="text-xs text-slate-500">{created}</p>
                    </div>
                    <Badge variant="blue">{ft}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
