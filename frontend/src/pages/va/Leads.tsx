import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../utils/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

interface Lead {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  icp_score: number | null;
  stage: string;
  phone: string | null;
  next_followup_at: string | null;
}

interface LeadsListResponse {
  data: Lead[];
  total: number;
}

const STAGE_OPTIONS = [
  { value: '', label: 'All stages' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'nurture', label: 'Nurture' },
  { value: 'lost', label: 'Lost' },
  { value: 'converted', label: 'Converted' },
];

const SOURCE_OPTIONS = [
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'cold_outreach', label: 'Cold outreach' },
  { value: 'scraper', label: 'Scraper / list' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
];

const TIMELINE_OPTIONS = [
  { value: 'immediate', label: 'Immediate' },
  { value: '1_week', label: 'Within 1 week' },
  { value: '2_weeks', label: 'Within 2 weeks' },
  { value: '1_month', label: 'Within 1 month' },
  { value: '3_months', label: 'Within 3 months' },
  { value: 'flexible', label: 'Flexible' },
];

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'note', label: 'Note' },
];

const OUTCOMES = [
  { value: 'connected', label: 'Connected' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'gatekeeper', label: 'Gatekeeper' },
  { value: 'dnc', label: 'DNC' },
];

function icpVariant(score: number | null | undefined): 'gray' | 'green' | 'yellow' | 'red' {
  if (score == null) return 'gray';
  if (score >= 8) return 'green';
  if (score >= 5) return 'yellow';
  return 'red';
}

function stageVariant(stage: string): 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' {
  switch (stage) {
    case 'new':
      return 'blue';
    case 'contacted':
      return 'yellow';
    case 'qualified':
    case 'converted':
      return 'green';
    case 'nurture':
      return 'purple';
    case 'lost':
      return 'red';
    default:
      return 'gray';
  }
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function contactName(lead: Lead) {
  const n = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
  return n || '—';
}

export function VALeads() {
  const navigate = useNavigate();
  const [stageFilter, setStageFilter] = useState('');
  const leadsPath = stageFilter
    ? `/leads?stage=${encodeURIComponent(stageFilter)}&limit=100`
    : '/leads?limit=100';
  const { data, loading, error, refetch } = useApiQuery<LeadsListResponse>(leadsPath, [stageFilter]);

  const [newOpen, setNewOpen] = useState(false);
  const [qualifyOpen, setQualifyOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const [newForm, setNewForm] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    phone: '',
    source: 'referral',
    industry: '',
  });
  const [qualifyForm, setQualifyForm] = useState({
    assigned_closer_id: '',
    pain_point: '',
    budget_min: '',
    budget_max: '',
    timeline: 'immediate',
    handoff_notes: '',
  });
  const [activityForm, setActivityForm] = useState({
    activity_type: 'call',
    outcome: 'connected',
    notes: '',
    call_duration_seconds: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openQualify = (lead: Lead) => {
    setActiveLead(lead);
    setQualifyForm({
      assigned_closer_id: '',
      pain_point: '',
      budget_min: '',
      budget_max: '',
      timeline: 'immediate',
      handoff_notes: '',
    });
    setFormError(null);
    setQualifyOpen(true);
  };

  const openActivity = (lead: Lead) => {
    setActiveLead(lead);
    setActivityForm({
      activity_type: 'call',
      outcome: 'connected',
      notes: '',
      call_duration_seconds: '',
    });
    setFormError(null);
    setActivityOpen(true);
  };

  const handleCreateLead = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/leads', {
        first_name: newForm.first_name || undefined,
        last_name: newForm.last_name || undefined,
        company_name: newForm.company_name || undefined,
        email: newForm.email || undefined,
        phone: newForm.phone || undefined,
        source: newForm.source,
        industry: newForm.industry || undefined,
      });
      setNewOpen(false);
      setNewForm({
        first_name: '',
        last_name: '',
        company_name: '',
        email: '',
        phone: '',
        source: 'referral',
        industry: '',
      });
      refetch();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQualify = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeLead) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post(`/leads/${activeLead.id}/qualify`, {
        assigned_closer_id: qualifyForm.assigned_closer_id.trim(),
        pain_point: qualifyForm.pain_point || undefined,
        budget_min: qualifyForm.budget_min ? parseFloat(qualifyForm.budget_min) : undefined,
        budget_max: qualifyForm.budget_max ? parseFloat(qualifyForm.budget_max) : undefined,
        timeline: qualifyForm.timeline || undefined,
        handoff_notes: qualifyForm.handoff_notes || undefined,
      });
      setQualifyOpen(false);
      setActiveLead(null);
      refetch();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to qualify lead');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivity = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeLead) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/activities', {
        lead_id: activeLead.id,
        activity_type: activityForm.activity_type,
        outcome: activityForm.outcome || undefined,
        notes: activityForm.notes || undefined,
        call_duration_seconds: activityForm.call_duration_seconds
          ? parseInt(activityForm.call_duration_seconds, 10)
          : undefined,
      });
      setActivityOpen(false);
      setActiveLead(null);
      refetch();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to log activity');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="mt-1 text-gray-600">
            {data != null ? `${data.total} lead${data.total === 1 ? '' : 's'}` : 'Your assigned pipeline.'}
          </p>
        </div>
        <Button onClick={() => { setFormError(null); setNewOpen(true); }}>New Lead</Button>
      </div>

      <Card>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="max-w-xs">
            <Select
              label="Stage"
              options={STAGE_OPTIONS}
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            />
          </div>
        </div>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <DataTable<Lead>
          loading={loading}
          data={data?.data ?? []}
          emptyMessage="No leads match this filter."
          onRowClick={(lead) => navigate(`/va/leads/${lead.id}`)}
          columns={[
            {
              key: 'company_name',
              header: 'Company',
              render: (row) => row.company_name || '—',
            },
            {
              key: 'contact',
              header: 'Contact',
              render: (row) => contactName(row),
            },
            {
              key: 'icp_score',
              header: 'ICP',
              render: (row) =>
                row.icp_score != null ? (
                  <Badge variant={icpVariant(row.icp_score)}>{row.icp_score}</Badge>
                ) : (
                  <Badge variant="gray">—</Badge>
                ),
            },
            {
              key: 'stage',
              header: 'Stage',
              render: (row) => <Badge variant={stageVariant(row.stage)}>{row.stage}</Badge>,
            },
            {
              key: 'phone',
              header: 'Phone',
              render: (row) => row.phone || '—',
            },
            {
              key: 'next_followup_at',
              header: 'Next follow-up',
              render: (row) => formatDateTime(row.next_followup_at),
            },
            {
              key: 'actions',
              header: '',
              className: 'w-[1%] whitespace-nowrap',
              render: (row) => (
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button type="button" size="sm" variant="secondary" onClick={() => openQualify(row)}>
                    Qualify
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => openActivity(row)}>
                    Activity Log
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={newOpen} onClose={() => !submitting && setNewOpen(false)} title="New lead" size="lg">
        <form onSubmit={handleCreateLead} className="space-y-4">
          {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="First name" value={newForm.first_name} onChange={(e) => setNewForm((f) => ({ ...f, first_name: e.target.value }))} />
            <Input label="Last name" value={newForm.last_name} onChange={(e) => setNewForm((f) => ({ ...f, last_name: e.target.value }))} />
          </div>
          <Input
            label="Company name"
            value={newForm.company_name}
            onChange={(e) => setNewForm((f) => ({ ...f, company_name: e.target.value }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Email"
              type="email"
              value={newForm.email}
              onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input label="Phone" value={newForm.phone} onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <Select
            label="Source"
            options={SOURCE_OPTIONS}
            value={newForm.source}
            onChange={(e) => setNewForm((f) => ({ ...f, source: e.target.value }))}
            required
          />
          <Input label="Industry" value={newForm.industry} onChange={(e) => setNewForm((f) => ({ ...f, industry: e.target.value }))} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" disabled={submitting} onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Create lead'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={qualifyOpen} onClose={() => !submitting && setQualifyOpen(false)} title="Qualify lead" size="lg">
        <form onSubmit={handleQualify} className="space-y-4">
          {activeLead && (
            <p className="text-sm text-gray-600">
              Qualifying <span className="font-medium text-gray-900">{activeLead.company_name || contactName(activeLead)}</span>
            </p>
          )}
          {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
          <Input
            label="Assigned closer ID"
            value={qualifyForm.assigned_closer_id}
            onChange={(e) => setQualifyForm((f) => ({ ...f, assigned_closer_id: e.target.value }))}
            placeholder="User UUID"
            required
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pain point</label>
            <textarea
              className="block min-h-[88px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              value={qualifyForm.pain_point}
              onChange={(e) => setQualifyForm((f) => ({ ...f, pain_point: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Budget min"
              type="number"
              min={0}
              step="0.01"
              value={qualifyForm.budget_min}
              onChange={(e) => setQualifyForm((f) => ({ ...f, budget_min: e.target.value }))}
            />
            <Input
              label="Budget max"
              type="number"
              min={0}
              step="0.01"
              value={qualifyForm.budget_max}
              onChange={(e) => setQualifyForm((f) => ({ ...f, budget_max: e.target.value }))}
            />
          </div>
          <Select
            label="Timeline"
            options={TIMELINE_OPTIONS}
            value={qualifyForm.timeline}
            onChange={(e) => setQualifyForm((f) => ({ ...f, timeline: e.target.value }))}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Handoff notes</label>
            <textarea
              className="block min-h-[88px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              value={qualifyForm.handoff_notes}
              onChange={(e) => setQualifyForm((f) => ({ ...f, handoff_notes: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" disabled={submitting} onClick={() => setQualifyOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Qualify & hand off'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={activityOpen} onClose={() => !submitting && setActivityOpen(false)} title="Log activity" size="lg">
        <form onSubmit={handleActivity} className="space-y-4">
          {activeLead && (
            <p className="text-sm text-gray-600">
              Logging for <span className="font-medium text-gray-900">{activeLead.company_name || contactName(activeLead)}</span>
            </p>
          )}
          {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
          <Select
            label="Activity type"
            options={ACTIVITY_TYPES}
            value={activityForm.activity_type}
            onChange={(e) => setActivityForm((f) => ({ ...f, activity_type: e.target.value }))}
          />
          <Select
            label="Outcome"
            options={OUTCOMES}
            value={activityForm.outcome}
            onChange={(e) => setActivityForm((f) => ({ ...f, outcome: e.target.value }))}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              className="block min-h-[100px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              value={activityForm.notes}
              onChange={(e) => setActivityForm((f) => ({ ...f, notes: e.target.value }))}
              rows={4}
            />
          </div>
          <Input
            label="Call duration (seconds)"
            type="number"
            min={0}
            value={activityForm.call_duration_seconds}
            onChange={(e) => setActivityForm((f) => ({ ...f, call_duration_seconds: e.target.value }))}
            placeholder="Optional"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" disabled={submitting} onClick={() => setActivityOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save activity'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
