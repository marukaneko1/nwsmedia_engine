import { useState, FormEvent } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../utils/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { DataTable } from '../../components/ui/DataTable';
import type { Client, Deal, Activity, PaymentLink, ProjectStatus } from '@nws/shared';

type ProjectNote = {
  id: string;
  client_id: string;
  content: string;
  note_type: string;
  pinned: boolean;
  author_id: string;
  author_first?: string;
  author_last?: string;
  created_at: string;
  updated_at: string;
};

type Milestone = {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  due_date?: string;
  completed_at?: string | null;
  sort_order: number;
  created_at: string;
};

type ProjectDetailResponse = {
  client: Client;
  deal: Deal | null;
  notes: ProjectNote[];
  milestones: Milestone[];
  activities: Activity[];
  payment_links: PaymentLink[];
  files: unknown[];
};

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'revision_requested', label: 'Revision requested' },
  { value: 'complete', label: 'Complete' },
  { value: 'paused', label: 'Paused' },
];

const PHASE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'design', label: 'Design' },
  { value: 'development', label: 'Development' },
  { value: 'review', label: 'Review' },
  { value: 'delivery', label: 'Delivery' },
];

const NOTE_TYPE_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'progress_update', label: 'Progress Update' },
  { value: 'blocker', label: 'Blocker' },
  { value: 'milestone_update', label: 'Milestone Update' },
];

function noteTypeBadgeVariant(t: string): 'gray' | 'blue' | 'red' | 'yellow' {
  switch (t) {
    case 'progress_update': return 'blue';
    case 'blocker': return 'red';
    case 'milestone_update': return 'yellow';
    default: return 'gray';
  }
}

function statusBadgeVariant(s: ProjectStatus): 'green' | 'yellow' | 'blue' | 'gray' | 'red' {
  switch (s) {
    case 'in_progress': return 'blue';
    case 'complete': return 'green';
    case 'revision_requested': return 'yellow';
    case 'awaiting_approval': return 'yellow';
    case 'paused': return 'gray';
    case 'not_started': return 'gray';
    default: return 'gray';
  }
}

function formatCurrency(n: number | string | null | undefined): string {
  const val = typeof n === 'string' ? parseFloat(n) : n;
  if (val == null || !Number.isFinite(val)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function OpsProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const backPath = location.pathname.startsWith('/admin') ? '/admin/projects' : '/ops/projects';
  const { data, loading, error, refetch } = useApiQuery<ProjectDetailResponse>(`/clients/${id}`, [id!]);

  const [statusModal, setStatusModal] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [milestoneModal, setMilestoneModal] = useState(false);

  const [newStatus, setNewStatus] = useState<ProjectStatus>('in_progress');
  const [newPhase, setNewPhase] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [msTitle, setMsTitle] = useState('');
  const [msDescription, setMsDescription] = useState('');
  const [msDueDate, setMsDueDate] = useState('');
  const [msSaving, setMsSaving] = useState(false);
  const [msError, setMsError] = useState<string | null>(null);

  const [togglingMilestone, setTogglingMilestone] = useState<string | null>(null);

  const [onboardingLink, setOnboardingLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkGenerating, setLinkGenerating] = useState(false);

  const generateOnboardingLink = async () => {
    setLinkGenerating(true);
    try {
      const res = await api.post<{ link: string }>(`/clients/${id}/onboarding-link`);
      setOnboardingLink(res.link);
      setLinkCopied(false);
    } catch { /* silent */ }
    setLinkGenerating(false);
  };

  const copyLink = () => {
    if (onboardingLink) {
      navigator.clipboard.writeText(onboardingLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const client = data?.client;
  const deal = data?.deal;
  const notes = data?.notes ?? [];
  const milestones = data?.milestones ?? [];
  const activities = data?.activities ?? [];
  const paymentLinks = data?.payment_links ?? [];

  const completedMilestones = milestones.filter((m) => m.completed_at).length;
  const milestonePercent = milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0;

  const timeline = [
    ...notes.map((n) => ({ kind: 'note' as const, date: n.created_at, item: n })),
    ...activities.map((a) => ({ kind: 'activity' as const, date: a.created_at, item: a })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const openStatusModal = () => {
    if (client) {
      setNewStatus(client.project_status);
      setNewPhase(client.current_phase ?? '');
    }
    setStatusError(null);
    setStatusModal(true);
  };

  const handleUpdateStatus = async (e: FormEvent) => {
    e.preventDefault();
    setStatusSaving(true);
    setStatusError(null);
    try {
      await api.patch(`/clients/${id}`, { project_status: newStatus, current_phase: newPhase || null });
      setStatusModal(false);
      refetch();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setStatusSaving(false);
    }
  };

  const openNoteModal = () => {
    setNoteContent('');
    setNoteType('general');
    setNoteError(null);
    setNoteModal(true);
  };

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setNoteSaving(true);
    setNoteError(null);
    try {
      await api.post(`/projects/${id}/notes`, { content: noteContent, note_type: noteType });
      setNoteModal(false);
      refetch();
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setNoteSaving(false);
    }
  };

  const openMilestoneModal = () => {
    setMsTitle('');
    setMsDescription('');
    setMsDueDate('');
    setMsError(null);
    setMilestoneModal(true);
  };

  const handleAddMilestone = async (e: FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim()) return;
    setMsSaving(true);
    setMsError(null);
    try {
      await api.post(`/projects/${id}/milestones`, {
        title: msTitle,
        description: msDescription || null,
        due_date: msDueDate || null,
      });
      setMilestoneModal(false);
      refetch();
    } catch (err) {
      setMsError(err instanceof Error ? err.message : 'Failed to add milestone');
    } finally {
      setMsSaving(false);
    }
  };

  const toggleMilestone = async (milestone: Milestone) => {
    setTogglingMilestone(milestone.id);
    try {
      await api.post(`/projects/${id}/milestones/${milestone.id}/complete`);
      refetch();
    } catch {
      // silent fail — will refetch anyway
    } finally {
      setTogglingMilestone(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error ?? 'Project not found'}</p>
        <Link to={backPath} className="mt-4 inline-block text-sm text-neutral-700 hover:underline">
          &larr; Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <Link to={backPath} className="text-sm text-gray-500 hover:text-neutral-800 transition-colors">
          &larr; Back to projects
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{client.company_name}</h1>
            <Badge variant={statusBadgeVariant(client.project_status)}>
              {client.project_status.replace(/_/g, ' ')}
            </Badge>
            {client.current_phase && (
              <Badge variant="purple">{client.current_phase}</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={generateOnboardingLink} disabled={linkGenerating}>
              {linkGenerating ? 'Generating...' : 'Onboarding Link'}
            </Button>
            <Button size="sm" variant="secondary" onClick={openStatusModal}>Update Status</Button>
            <Button size="sm" onClick={openNoteModal}>Add Note</Button>
          </div>
        </div>
        {client.project_name && (
          <p className="mt-1 text-gray-500">{client.project_name}</p>
        )}
        {onboardingLink && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 dark:border-sky-800 dark:bg-sky-900/20">
            <svg className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.932-3.532l4.5-4.5a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
            <input
              readOnly
              value={onboardingLink}
              className="flex-1 bg-transparent text-sm text-sky-800 dark:text-sky-300 outline-none truncate"
              onFocus={(e) => e.target.select()}
            />
            <Button size="sm" variant="secondary" onClick={copyLink}>
              {linkCopied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        )}
      </div>

      {/* Overview */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Overview</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Contact</dt>
                <dd className="font-medium text-gray-900">{client.contact_name}</dd>
              </div>
              {client.contact_email && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Email</dt>
                  <dd>
                    <a href={`mailto:${client.contact_email}`} className="text-neutral-700 hover:underline">
                      {client.contact_email}
                    </a>
                  </dd>
                </div>
              )}
              {client.contact_phone && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Phone</dt>
                  <dd>{client.contact_phone}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Contract value</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(client.contract_value)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Balance due</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(client.balance_due)}</dd>
              </div>
              {client.services_contracted && client.services_contracted.length > 0 && (
                <div>
                  <dt className="mb-1.5 text-gray-500">Services</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {client.services_contracted.map((s) => (
                      <Badge key={s} variant="blue">{s}</Badge>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Kickoff date</dt>
                <dd>{formatDate(client.kickoff_date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Expected delivery</dt>
                <dd>{formatDate(client.expected_delivery_date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Actual delivery</dt>
                <dd>{formatDate(client.actual_delivery_date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Revisions</dt>
                <dd>{client.revisions_used} / {client.revision_limit}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Closer</dt>
                <dd>{client.assigned_closer_id ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Ops lead</dt>
                <dd>{client.assigned_ops_lead_id ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd>{formatDate(client.created_at)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </section>

      {/* Project Brief */}
      {(client.project_brief || client.handoff_notes || deal?.pain_point || client.target_audience) && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Project Brief</h2>
          <Card>
            <div className="space-y-4 text-sm text-gray-700">
              {client.project_brief && (
                <div>
                  <p className="mb-1 font-medium text-gray-900">Project Brief</p>
                  <p className="whitespace-pre-wrap">{client.project_brief}</p>
                </div>
              )}
              {client.target_audience && (
                <div>
                  <p className="mb-1 font-medium text-gray-900">Target Audience</p>
                  <p>{client.target_audience}</p>
                </div>
              )}
              {client.competitors && (
                <div>
                  <p className="mb-1 font-medium text-gray-900">Competitors</p>
                  <p>{client.competitors}</p>
                </div>
              )}
              {client.brand_guidelines && (
                <div>
                  <p className="mb-1 font-medium text-gray-900">Brand Guidelines</p>
                  <p className="whitespace-pre-wrap">{client.brand_guidelines}</p>
                </div>
              )}
              {client.special_requirements && (
                <div>
                  <p className="mb-1 font-medium text-gray-900">Special Requirements</p>
                  <p className="whitespace-pre-wrap">{client.special_requirements}</p>
                </div>
              )}
              {client.project_goals && Array.isArray(client.project_goals) && client.project_goals.length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-gray-900">Goals</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {client.project_goals.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {client.handoff_notes && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                  <p className="mb-1 font-medium text-yellow-800">Handoff Notes</p>
                  <p className="whitespace-pre-wrap text-yellow-700">{client.handoff_notes}</p>
                  {client.handed_off_at && (
                    <p className="mt-2 text-xs text-yellow-500">Handed off {formatDate(client.handed_off_at)}</p>
                  )}
                </div>
              )}
              {deal?.pain_point && (
                <div>
                  <p className="mb-1 font-medium text-gray-900">Client Pain Point (from deal)</p>
                  <p className="whitespace-pre-wrap">{deal.pain_point}</p>
                </div>
              )}
              {deal?.timeline && (
                <div>
                  <p className="mb-1 font-medium text-gray-900">Timeline (from deal)</p>
                  <p>{deal.timeline}</p>
                </div>
              )}
              {deal?.objections && deal.objections.length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-gray-900">Notes / Objections (from deal)</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {deal.objections.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </section>
      )}

      {/* Milestones */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Milestones</h2>
        <Card
          action={<Button size="sm" variant="secondary" onClick={openMilestoneModal}>Add Milestone</Button>}
          title={`Milestones (${completedMilestones}/${milestones.length})`}
        >
          {milestones.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{milestonePercent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-neutral-900 transition-all duration-300"
                  style={{ width: `${milestonePercent}%` }}
                />
              </div>
            </div>
          )}

          {milestones.length === 0 ? (
            <p className="text-sm text-gray-500">No milestones yet</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {milestones.map((ms) => (
                <li key={ms.id} className="flex items-start gap-3 py-3">
                  <button
                    onClick={() => toggleMilestone(ms)}
                    disabled={togglingMilestone === ms.id}
                    className="mt-0.5 flex-shrink-0"
                  >
                    {ms.completed_at ? (
                      <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-300 hover:text-brand-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${ms.completed_at ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {ms.title}
                    </p>
                    {ms.description && (
                      <p className="mt-0.5 text-xs text-gray-500">{ms.description}</p>
                    )}
                  </div>
                  {ms.due_date && (
                    <span className="flex-shrink-0 text-xs text-gray-400">{formatDate(ms.due_date)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Notes / Activity Timeline */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Notes &amp; Activity</h2>
        <Card
          title="Timeline"
          action={<Button size="sm" variant="secondary" onClick={openNoteModal}>Add Note</Button>}
        >
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-500">No activity yet</p>
          ) : (
            <ul className="space-y-4">
              {timeline.map((entry) => {
                if (entry.kind === 'note') {
                  const n = entry.item as ProjectNote;
                  return (
                    <li key={`note-${n.id}`} className="relative rounded-lg border border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        {n.pinned && (
                          <svg className="h-3.5 w-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        )}
                        <span className="text-sm font-medium text-gray-900">{n.author_first ? `${n.author_first} ${n.author_last}` : 'Team member'}</span>
                        <Badge variant={noteTypeBadgeVariant(n.note_type)}>
                          {n.note_type.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.content}</p>
                    </li>
                  );
                }
                const a = entry.item as Activity;
                return (
                  <li key={`act-${a.id}`} className="flex items-start gap-3 py-2">
                    <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-gray-300" />
                    <div>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium capitalize">{a.activity_type.replace(/_/g, ' ')}</span>
                        {a.outcome && <span className="text-gray-500"> — {a.outcome}</span>}
                        {a.notes && <span className="text-gray-500"> — {a.notes}</span>}
                      </p>
                      <p className="text-xs text-gray-400">{timeAgo(a.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* Payment History */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Payment History</h2>
        <Card>
          <DataTable<PaymentLink>
            loading={false}
            data={paymentLinks}
            emptyMessage="No payments recorded"
            columns={[
              {
                key: 'amount',
                header: 'Amount',
                render: (p) => formatCurrency(p.amount),
              },
              {
                key: 'payment_type',
                header: 'Type',
                render: (p) => (
                  <span className="capitalize">{p.payment_type}</span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (p) => {
                  const v = p.status === 'paid' ? 'green' : p.status === 'pending' ? 'yellow' : p.status === 'expired' ? 'red' : 'gray';
                  return <Badge variant={v}>{p.status}</Badge>;
                },
              },
              {
                key: 'paid_at',
                header: 'Paid at',
                render: (p) => formatDate(p.paid_at),
              },
              {
                key: 'processor',
                header: 'Processor',
                render: (p) => <span className="capitalize">{p.processor}</span>,
              },
            ]}
          />
        </Card>
      </section>

      {/* Update Status Modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Update Project Status">
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          {statusError && <p className="text-sm text-red-600">{statusError}</p>}
          <Select
            label="Project status"
            options={STATUS_OPTIONS}
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as ProjectStatus)}
          />
          <Select
            label="Current phase"
            options={PHASE_OPTIONS}
            value={newPhase}
            onChange={(e) => setNewPhase(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setStatusModal(false)}>Cancel</Button>
            <Button type="submit" disabled={statusSaving}>{statusSaving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      {/* Add Note Modal */}
      <Modal open={noteModal} onClose={() => setNoteModal(false)} title="Add Note">
        <form onSubmit={handleAddNote} className="space-y-4">
          {noteError && <p className="text-sm text-red-600">{noteError}</p>}
          <Select
            label="Note type"
            options={NOTE_TYPE_OPTIONS}
            value={noteType}
            onChange={(e) => setNoteType(e.target.value)}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
              rows={4}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setNoteModal(false)}>Cancel</Button>
            <Button type="submit" disabled={noteSaving}>{noteSaving ? 'Saving…' : 'Add Note'}</Button>
          </div>
        </form>
      </Modal>

      {/* Add Milestone Modal */}
      <Modal open={milestoneModal} onClose={() => setMilestoneModal(false)} title="Add Milestone">
        <form onSubmit={handleAddMilestone} className="space-y-4">
          {msError && <p className="text-sm text-red-600">{msError}</p>}
          <Input
            label="Title"
            value={msTitle}
            onChange={(e) => setMsTitle(e.target.value)}
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
              rows={3}
              value={msDescription}
              onChange={(e) => setMsDescription(e.target.value)}
            />
          </div>
          <Input
            label="Due date"
            type="date"
            value={msDueDate}
            onChange={(e) => setMsDueDate(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setMilestoneModal(false)}>Cancel</Button>
            <Button type="submit" disabled={msSaving}>{msSaving ? 'Saving…' : 'Add Milestone'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
