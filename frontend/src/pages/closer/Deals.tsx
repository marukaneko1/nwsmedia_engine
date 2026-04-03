import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../utils/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

type Deal = {
  id: string;
  company_name: string;
  contact_name: string;
  stage: string;
  estimated_value: string | number | null;
  close_probability: number | null;
  created_at: string;
  pain_point?: string | null;
  budget_range_min?: string | number | null;
  budget_range_max?: string | number | null;
  contact_email?: string | null;
  contact_phone?: string | null;
};

type DealsResponse = { data: Deal[] };

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  const x = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(x) ? x : 0;
}

function stageBadgeVariant(stage: string): 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' {
  const map: Record<string, 'blue' | 'yellow' | 'purple' | 'green' | 'red'> = {
    discovery: 'blue',
    proposal_sent: 'yellow',
    contract_sent: 'purple',
    awaiting_deposit: 'yellow',
    won: 'green',
    lost: 'red',
  };
  return map[stage] ?? 'gray';
}

function formatStageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const STAGE_OPTIONS = [
  { value: '', label: 'All stages' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'proposal_sent', label: 'Proposal sent' },
  { value: 'contract_sent', label: 'Contract sent' },
  { value: 'awaiting_deposit', label: 'Awaiting deposit' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

type HandoffForm = {
  project_name: string;
  services_contracted: string;
  kickoff_date: string;
  expected_delivery_date: string;
  handoff_notes: string;
  project_brief: string;
  target_audience: string;
  competitors: string;
  special_requirements: string;
};

const EMPTY_HANDOFF: HandoffForm = {
  project_name: '',
  services_contracted: '',
  kickoff_date: '',
  expected_delivery_date: '',
  handoff_notes: '',
  project_brief: '',
  target_audience: '',
  competitors: '',
  special_requirements: '',
};

export function CloserDeals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stageFilter, setStageFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentModalDeal, setPaymentModalDeal] = useState<Deal | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState('deposit');
  const [processor, setProcessor] = useState('stripe');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  const [handoffDeal, setHandoffDeal] = useState<Deal | null>(null);
  const [handoffForm, setHandoffForm] = useState<HandoffForm>(EMPTY_HANDOFF);
  const [handoffSubmitting, setHandoffSubmitting] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [handoffSuccess, setHandoffSuccess] = useState<{ clientId: string } | null>(null);

  const query = stageFilter ? `/deals?stage=${encodeURIComponent(stageFilter)}&limit=200` : '/deals?limit=200';
  const { data, loading, error, refetch } = useApiQuery<DealsResponse>(query, [stageFilter]);

  const deals = data?.data ?? [];

  const closePaymentModal = () => {
    setPaymentModalDeal(null);
    setFormError(null);
    setLinkMessage(null);
    setAmount('');
    setDueDate('');
    setDescription('');
  };

  const handleCreatePaymentLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!paymentModalDeal) return;
    setFormError(null);
    setLinkMessage(null);
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFormError('Enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ payment_link: { url?: string } }>('/payment-links/create', {
        deal_id: paymentModalDeal.id,
        amount: amt,
        payment_type: paymentType,
        processor,
        due_date: dueDate || null,
        description: description || null,
      });
      setLinkMessage(res.payment_link?.url ? `Link created: ${res.payment_link.url}` : 'Payment link created.');
      refetch();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setSubmitting(false);
    }
  };

  const openHandoff = (deal: Deal) => {
    setHandoffDeal(deal);
    setHandoffForm({ ...EMPTY_HANDOFF, project_name: deal.company_name });
    setHandoffError(null);
    setHandoffSuccess(null);
  };

  const closeHandoff = () => {
    setHandoffDeal(null);
    setHandoffError(null);
    setHandoffSuccess(null);
  };

  const updateHandoff = (field: keyof HandoffForm, value: string) => {
    setHandoffForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleHandoff = async (e: FormEvent) => {
    e.preventDefault();
    if (!handoffDeal) return;
    setHandoffSubmitting(true);
    setHandoffError(null);
    try {
      const services = handoffForm.services_contracted
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.post<{ client: { id: string } }>(`/clients/from-deal/${handoffDeal.id}`, {
        project_name: handoffForm.project_name || null,
        services_contracted: services.length > 0 ? services : null,
        kickoff_date: handoffForm.kickoff_date || null,
        expected_delivery_date: handoffForm.expected_delivery_date || null,
        handoff_notes: handoffForm.handoff_notes || null,
        project_brief: handoffForm.project_brief || null,
        target_audience: handoffForm.target_audience || null,
        competitors: handoffForm.competitors || null,
        special_requirements: handoffForm.special_requirements || null,
      });
      setHandoffSuccess({ clientId: res.client?.id ?? '' });
      refetch();
    } catch (err) {
      setHandoffError(err instanceof Error ? err.message : 'Handoff failed');
    } finally {
      setHandoffSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
        <p className="mt-1 text-gray-500">
          {user ? `Assigned to ${user.first_name} ${user.last_name}` : 'Deals assigned to you'}
        </p>
      </div>

      <Card>
        <div className="mb-4 max-w-xs">
          <Select
            label="Filter by stage"
            options={STAGE_OPTIONS}
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          />
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <DataTable<Deal>
          loading={loading}
          data={deals}
          emptyMessage="No deals match this filter"
          onRowClick={(deal) => setExpandedId((id) => (id === deal.id ? null : deal.id))}
          columns={[
            {
              key: 'company_name',
              header: 'Company',
              render: (d) => <span className="font-medium text-gray-900">{d.company_name}</span>,
            },
            {
              key: 'contact_name',
              header: 'Contact',
              render: (d) => d.contact_name,
            },
            {
              key: 'stage',
              header: 'Stage',
              render: (d) => (
                <Badge variant={stageBadgeVariant(d.stage)}>{formatStageLabel(d.stage)}</Badge>
              ),
            },
            {
              key: 'estimated_value',
              header: 'Est. value',
              render: (d) => formatCurrency(num(d.estimated_value)),
            },
            {
              key: 'close_probability',
              header: 'Close %',
              render: (d) => (d.close_probability != null ? `${d.close_probability}%` : '—'),
            },
            {
              key: 'created_at',
              header: 'Created',
              render: (d) => new Date(d.created_at).toLocaleDateString(),
            },
            {
              key: 'actions',
              header: '',
              className: 'w-48',
              render: (d) => (
                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/closer/deals/${d.id}`)}>
                    Open
                  </Button>
                  <Button size="sm" onClick={() => setPaymentModalDeal(d)}>
                    Create payment link
                  </Button>
                  {d.stage === 'won' && (
                    <Button size="sm" variant="ghost" onClick={() => openHandoff(d)}>
                      Hand off to Ops
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />

        {expandedId && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            {(() => {
              const d = deals.find((x) => x.id === expandedId);
              if (!d) return null;
              return (
                <div className="space-y-2 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">{d.company_name}</p>
                  <p>
                    <span className="text-gray-500">Contact:</span> {d.contact_name}
                    {d.contact_email ? ` · ${d.contact_email}` : ''}
                    {d.contact_phone ? ` · ${d.contact_phone}` : ''}
                  </p>
                  {d.pain_point && (
                    <p>
                      <span className="text-gray-500">Pain point:</span> {d.pain_point}
                    </p>
                  )}
                  {(d.budget_range_min != null || d.budget_range_max != null) && (
                    <p>
                      <span className="text-gray-500">Budget:</span>{' '}
                      {formatCurrency(num(d.budget_range_min))} – {formatCurrency(num(d.budget_range_max))}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </Card>

      <Modal open={!!paymentModalDeal} onClose={closePaymentModal} title="Create payment link" size="md">
        <form onSubmit={handleCreatePaymentLink} className="space-y-4">
          {paymentModalDeal && (
            <p className="text-sm text-gray-600">
              Deal: <span className="font-medium text-gray-900">{paymentModalDeal.company_name}</span>
            </p>
          )}
          <Input
            label="Amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Select
            label="Payment type"
            options={[
              { value: 'deposit', label: 'Deposit' },
              { value: 'final', label: 'Final' },
              { value: 'milestone', label: 'Milestone' },
            ]}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
          />
          <Select
            label="Processor"
            options={[
              { value: 'stripe', label: 'Stripe' },
              { value: 'square', label: 'Square' },
              { value: 'paypal', label: 'PayPal' },
            ]}
            value={processor}
            onChange={(e) => setProcessor(e.target.value)}
          />
          <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          {linkMessage && <p className="text-sm text-green-700">{linkMessage}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closePaymentModal}>
              Close
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create link'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!handoffDeal} onClose={closeHandoff} title="Hand off to Ops" size="lg">
        {handoffSuccess ? (
          <div className="space-y-4">
            <p className="text-sm text-green-700 font-medium">
              Project created successfully!
            </p>
            {handoffSuccess.clientId && (
              <p className="text-sm text-gray-600">
                <button
                  type="button"
                  className="text-neutral-700 hover:underline"
                  onClick={() => { navigate(`/ops/projects/${handoffSuccess!.clientId}`); closeHandoff(); }}
                >
                  View project &rarr;
                </button>
              </p>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={closeHandoff}>Close</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleHandoff} className="space-y-4">
            {handoffDeal && (
              <p className="text-sm text-gray-600">
                Handing off <span className="font-medium text-gray-900">{handoffDeal.company_name}</span> to operations.
              </p>
            )}
            {handoffError && <p className="text-sm text-red-600">{handoffError}</p>}
            <Input
              label="Project name"
              value={handoffForm.project_name}
              onChange={(e) => updateHandoff('project_name', e.target.value)}
            />
            <Input
              label="Services contracted (comma-separated)"
              value={handoffForm.services_contracted}
              onChange={(e) => updateHandoff('services_contracted', e.target.value)}
              placeholder="e.g. Website redesign, SEO, Branding"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Kickoff date"
                type="date"
                value={handoffForm.kickoff_date}
                onChange={(e) => updateHandoff('kickoff_date', e.target.value)}
              />
              <Input
                label="Expected delivery date"
                type="date"
                value={handoffForm.expected_delivery_date}
                onChange={(e) => updateHandoff('expected_delivery_date', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Project brief</label>
              <textarea
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
                rows={3}
                value={handoffForm.project_brief}
                onChange={(e) => updateHandoff('project_brief', e.target.value)}
                placeholder="Describe what we're building for them"
              />
            </div>
            <Input
              label="Target audience"
              value={handoffForm.target_audience}
              onChange={(e) => updateHandoff('target_audience', e.target.value)}
            />
            <Input
              label="Competitors"
              value={handoffForm.competitors}
              onChange={(e) => updateHandoff('competitors', e.target.value)}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Special requirements</label>
              <textarea
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
                rows={2}
                value={handoffForm.special_requirements}
                onChange={(e) => updateHandoff('special_requirements', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Handoff notes</label>
              <textarea
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
                rows={2}
                value={handoffForm.handoff_notes}
                onChange={(e) => updateHandoff('handoff_notes', e.target.value)}
                placeholder="Anything ops should know"
              />
            </div>
            <p className="text-xs text-gray-400">Ops lead will be assigned by admin if not set.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={closeHandoff}>Cancel</Button>
              <Button type="submit" disabled={handoffSubmitting}>
                {handoffSubmitting ? 'Handing off…' : 'Hand off to Ops'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
