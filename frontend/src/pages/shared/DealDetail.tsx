import { useState, FormEvent } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../utils/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DataTable } from '../../components/ui/DataTable';
import { StatsCard } from '../../components/ui/StatsCard';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Deal = {
  id: string;
  lead_id: string | null;
  assigned_closer_id: string | null;
  originating_va_id: string | null;
  company_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  estimated_value: string | number | null;
  actual_value: string | number | null;
  payment_terms: string | null;
  stage: DealStage;
  discovery_call_date: string | null;
  pain_point: string | null;
  budget_range_min: string | number | null;
  budget_range_max: string | number | null;
  timeline: string | null;
  decision_maker_name: string | null;
  objections: string[] | null;
  proposal_sent_at: string | null;
  proposal_url: string | null;
  proposal_viewed_at: string | null;
  proposal_expires_at: string | null;
  contract_sent_at: string | null;
  contract_signed_at: string | null;
  contract_url: string | null;
  deposit_amount: string | number | null;
  deposit_due_date: string | null;
  deposit_received_at: string | null;
  final_payment_amount: string | number | null;
  final_payment_received_at: string | null;
  close_date: string | null;
  close_probability: number | null;
  days_in_pipeline: number | null;
  loss_reason: string | null;
  competitor_name: string | null;
  competitor_price: string | number | null;
  loss_notes: string | null;
  created_at: string;
  updated_at: string;
  va_first: string | null;
  va_last: string | null;
  closer_first: string | null;
  closer_last: string | null;
};

type Activity = {
  id: string;
  activity_type: string;
  outcome: string | null;
  call_duration_seconds: number | null;
  notes: string | null;
  created_by_first: string | null;
  created_by_last: string | null;
  created_at: string;
};

type PaymentLink = {
  id: string;
  amount: string | number;
  payment_type: string;
  processor: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  slug: string;
  created_at: string;
};

type DealDetailResponse = {
  deal: Deal;
  activities: Activity[];
  payment_links: PaymentLink[];
};

type DealStage =
  | 'discovery'
  | 'proposal_sent'
  | 'contract_sent'
  | 'awaiting_deposit'
  | 'won'
  | 'lost';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIPELINE_STAGES: { value: DealStage; label: string }[] = [
  { value: 'discovery', label: 'Discovery' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'contract_sent', label: 'Contract Sent' },
  { value: 'awaiting_deposit', label: 'Awaiting Deposit' },
  { value: 'won', label: 'Won' },
];

const ALL_STAGE_OPTIONS: { value: string; label: string }[] = [
  ...PIPELINE_STAGES,
  { value: 'lost', label: 'Lost' },
];

const ACTIVITY_TYPE_OPTIONS = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'note', label: 'Note' },
  { value: 'meeting', label: 'Meeting' },
];

const OUTCOME_OPTIONS = [
  { value: '', label: 'Select outcome…' },
  { value: 'connected', label: 'Connected' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'follow_up', label: 'Follow Up' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  const x = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(x) ? x : 0;
}

function formatCurrency(v: string | number | null | undefined): string {
  const n = num(v);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
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

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
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

function activityTypeBadgeVariant(t: string): 'blue' | 'green' | 'yellow' | 'purple' | 'gray' {
  const map: Record<string, 'blue' | 'green' | 'yellow' | 'purple'> = {
    call: 'blue',
    email: 'green',
    sms: 'yellow',
    meeting: 'purple',
  };
  return map[t] ?? 'gray';
}

// ---------------------------------------------------------------------------
// Stage Progress Bar
// ---------------------------------------------------------------------------

function StageProgressBar({ currentStage }: { currentStage: DealStage }) {
  const isLost = currentStage === 'lost';
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.value === currentStage);

  return (
    <div className="flex items-center gap-1">
      {PIPELINE_STAGES.map((stage, i) => {
        const isCompleted = !isLost && currentIndex >= 0 && i < currentIndex;
        const isCurrent = !isLost && stage.value === currentStage;

        let pillClasses = 'bg-gray-200 text-gray-500';
        if (isLost) {
          pillClasses = 'bg-red-100 text-red-400';
        } else if (isCompleted) {
          pillClasses = 'bg-green-500 text-white';
        } else if (isCurrent) {
          pillClasses = 'bg-neutral-900 text-white';
        }

        return (
          <div key={stage.value} className="flex flex-1 flex-col items-center gap-1.5">
            <div className={`h-2 w-full rounded-full transition-colors ${pillClasses.split(' ')[0]}`} />
            <span className={`text-xs font-medium whitespace-nowrap ${pillClasses.split(' ').slice(1).join(' ')}`}>
              {stage.label}
            </span>
          </div>
        );
      })}
      {isLost && (
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <div className="h-2 w-full rounded-full bg-red-500" />
          <span className="text-xs font-medium whitespace-nowrap text-red-600">Lost</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();

  const isAdmin = location.pathname.startsWith('/admin');
  const backPath = isAdmin ? '/admin/deals' : '/closer/deals';

  const { data, loading, error, refetch } = useApiQuery<DealDetailResponse>(`/deals/${id}`, [id!]);

  // Stage modal
  const [stageModal, setStageModal] = useState(false);
  const [newStage, setNewStage] = useState<string>('');
  const [lossReason, setLossReason] = useState('');
  const [competitorName, setCompetitorName] = useState('');
  const [competitorPrice, setCompetitorPrice] = useState('');
  const [lossNotes, setLossNotes] = useState('');
  const [wonActualValue, setWonActualValue] = useState('');
  const [stageSaving, setStageSaving] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  // Activity modal
  const [activityModal, setActivityModal] = useState(false);
  const [actType, setActType] = useState('call');
  const [actOutcome, setActOutcome] = useState('');
  const [actNotes, setActNotes] = useState('');
  const [actDuration, setActDuration] = useState('');
  const [actSaving, setActSaving] = useState(false);
  const [actError, setActError] = useState<string | null>(null);

  const deal = data?.deal;
  const activities = data?.activities ?? [];
  const paymentLinks = data?.payment_links ?? [];

  // -- Stage Modal handlers --

  const openStageModal = () => {
    if (deal) setNewStage(deal.stage);
    setLossReason('');
    setCompetitorName('');
    setCompetitorPrice('');
    setLossNotes('');
    setWonActualValue('');
    setStageError(null);
    setStageModal(true);
  };

  const handleUpdateStage = async (e: FormEvent) => {
    e.preventDefault();
    setStageSaving(true);
    setStageError(null);
    try {
      const body: Record<string, unknown> = { stage: newStage };
      if (newStage === 'lost') {
        body.loss_reason = lossReason || null;
        body.competitor_name = competitorName || null;
        body.competitor_price = competitorPrice ? parseFloat(competitorPrice) : null;
        body.loss_notes = lossNotes || null;
      }
      if (newStage === 'won') {
        body.actual_value = wonActualValue ? parseFloat(wonActualValue) : null;
      }
      await api.patch(`/deals/${id}`, body);
      setStageModal(false);
      refetch();
    } catch (err) {
      setStageError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setStageSaving(false);
    }
  };

  // -- Activity Modal handlers --

  const openActivityModal = () => {
    setActType('call');
    setActOutcome('');
    setActNotes('');
    setActDuration('');
    setActError(null);
    setActivityModal(true);
  };

  const handleLogActivity = async (e: FormEvent) => {
    e.preventDefault();
    setActSaving(true);
    setActError(null);
    try {
      const body: Record<string, unknown> = {
        deal_id: id,
        activity_type: actType,
      };
      if (actOutcome) body.outcome = actOutcome;
      if (actNotes.trim()) body.notes = actNotes.trim();
      if (actDuration) {
        const dur = parseInt(actDuration, 10);
        if (Number.isFinite(dur) && dur > 0) body.call_duration_seconds = dur;
      }
      await api.post('/activities', body);
      setActivityModal(false);
      refetch();
    } catch (err) {
      setActError(err instanceof Error ? err.message : 'Failed to log activity');
    } finally {
      setActSaving(false);
    }
  };

  // -- Loading / Error --

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error ?? 'Deal not found'}</p>
        <Link to={backPath} className="mt-4 inline-block text-sm text-neutral-700 hover:underline">
          &larr; Back to deals
        </Link>
      </div>
    );
  }

  // -- Render --

  return (
    <div className="p-8 space-y-8">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div>
        <Link to={backPath} className="text-sm text-gray-500 hover:text-neutral-800 transition-colors">
          &larr; Back to deals
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{deal.company_name}</h1>
              <Badge variant={stageBadgeVariant(deal.stage)}>{formatStageLabel(deal.stage)}</Badge>
              {deal.close_probability != null && (
                <span className="text-sm font-medium text-gray-500">{deal.close_probability}% close</span>
              )}
            </div>
            <p className="mt-1 text-gray-500">{deal.contact_name}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={openStageModal}>
              Update Stage
            </Button>
            <Button size="sm" onClick={openActivityModal}>
              Log Activity
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const token = localStorage.getItem('token');
                window.open(`/api/pdf/proposal/${id}?token=${token}`, '_blank');
              }}
            >
              Download Proposal
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const token = localStorage.getItem('token');
                window.open(`/api/pdf/contract/${id}?token=${token}`, '_blank');
              }}
            >
              Download Contract
            </Button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Stage Progress Bar                                               */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <StageProgressBar currentStage={deal.stage} />
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Key Metrics                                                      */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Estimated Value" value={formatCurrency(deal.estimated_value)} />
        <StatsCard title="Actual Value" value={deal.actual_value ? formatCurrency(deal.actual_value) : '—'} />
        <StatsCard title="Days in Pipeline" value={deal.days_in_pipeline ?? 0} />
        <StatsCard
          title="Close Probability"
          value={deal.close_probability != null ? `${deal.close_probability}%` : '—'}
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Two-Column Layout                                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left – Deal Details */}
        <Card title="Deal Details">
          <dl className="space-y-3 text-sm">
            <DetailRow label="Contact Name" value={deal.contact_name} />
            {deal.contact_email && (
              <DetailRow label="Email">
                <a href={`mailto:${deal.contact_email}`} className="text-neutral-700 hover:underline">
                  {deal.contact_email}
                </a>
              </DetailRow>
            )}
            {deal.contact_phone && <DetailRow label="Phone" value={deal.contact_phone} />}
            {deal.decision_maker_name && (
              <DetailRow label="Decision Maker" value={deal.decision_maker_name} />
            )}

            <div className="border-t border-gray-100 pt-3" />

            {deal.pain_point && (
              <div>
                <dt className="text-gray-500">Pain Point</dt>
                <dd className="mt-1 text-gray-900 whitespace-pre-wrap">{deal.pain_point}</dd>
              </div>
            )}
            {(deal.budget_range_min != null || deal.budget_range_max != null) && (
              <DetailRow
                label="Budget Range"
                value={`${formatCurrency(deal.budget_range_min)} – ${formatCurrency(deal.budget_range_max)}`}
              />
            )}
            {deal.timeline && <DetailRow label="Timeline" value={deal.timeline} />}
            {deal.payment_terms && <DetailRow label="Payment Terms" value={deal.payment_terms} />}

            {deal.objections && deal.objections.length > 0 && (
              <div>
                <dt className="text-gray-500 mb-1">Objections</dt>
                <dd>
                  <ul className="list-disc pl-5 space-y-1 text-gray-900">
                    {deal.objections.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}

            {(deal.competitor_name || deal.competitor_price) && (
              <>
                <div className="border-t border-gray-100 pt-3" />
                {deal.competitor_name && (
                  <DetailRow label="Competitor" value={deal.competitor_name} />
                )}
                {deal.competitor_price && (
                  <DetailRow label="Competitor Price" value={formatCurrency(deal.competitor_price)} />
                )}
              </>
            )}

            {deal.stage === 'lost' && (
              <>
                <div className="border-t border-red-100 pt-3" />
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-2">
                  {deal.loss_reason && (
                    <div>
                      <dt className="text-red-700 font-medium">Loss Reason</dt>
                      <dd className="text-red-600">{deal.loss_reason}</dd>
                    </div>
                  )}
                  {deal.loss_notes && (
                    <div>
                      <dt className="text-red-700 font-medium">Loss Notes</dt>
                      <dd className="text-red-600 whitespace-pre-wrap">{deal.loss_notes}</dd>
                    </div>
                  )}
                </div>
              </>
            )}
          </dl>
        </Card>

        {/* Right – Timeline & People */}
        <Card title="Timeline & People">
          <dl className="space-y-3 text-sm">
            <h4 className="font-medium text-gray-900">Proposal</h4>
            <DetailRow label="Sent" value={formatDate(deal.proposal_sent_at)} />
            {deal.proposal_url && (
              <DetailRow label="URL">
                <a
                  href={deal.proposal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-700 hover:underline truncate block max-w-[220px]"
                >
                  {deal.proposal_url}
                </a>
              </DetailRow>
            )}
            <DetailRow label="Viewed" value={formatDate(deal.proposal_viewed_at)} />
            <DetailRow label="Expires" value={formatDate(deal.proposal_expires_at)} />

            <div className="border-t border-gray-100 pt-3" />
            <h4 className="font-medium text-gray-900">Contract</h4>
            <DetailRow label="Sent" value={formatDate(deal.contract_sent_at)} />
            <DetailRow label="Signed" value={formatDate(deal.contract_signed_at)} />
            {deal.contract_url && (
              <DetailRow label="URL">
                <a
                  href={deal.contract_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-700 hover:underline truncate block max-w-[220px]"
                >
                  {deal.contract_url}
                </a>
              </DetailRow>
            )}

            <div className="border-t border-gray-100 pt-3" />
            <h4 className="font-medium text-gray-900">Payments</h4>
            <DetailRow label="Deposit" value={deal.deposit_amount ? formatCurrency(deal.deposit_amount) : '—'} />
            <DetailRow label="Deposit Due" value={formatDate(deal.deposit_due_date)} />
            <DetailRow label="Deposit Received" value={formatDate(deal.deposit_received_at)} />
            <DetailRow
              label="Final Payment"
              value={deal.final_payment_amount ? formatCurrency(deal.final_payment_amount) : '—'}
            />
            <DetailRow label="Final Received" value={formatDate(deal.final_payment_received_at)} />

            <div className="border-t border-gray-100 pt-3" />
            <h4 className="font-medium text-gray-900">People</h4>
            <DetailRow
              label="Originating VA"
              value={deal.va_first ? `${deal.va_first} ${deal.va_last}` : '—'}
            />
            <DetailRow
              label="Assigned Closer"
              value={deal.closer_first ? `${deal.closer_first} ${deal.closer_last}` : '—'}
            />
            {deal.discovery_call_date && (
              <DetailRow label="Discovery Call" value={formatDate(deal.discovery_call_date)} />
            )}
            {deal.close_date && <DetailRow label="Close Date" value={formatDate(deal.close_date)} />}
          </dl>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Activity Timeline                                                */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <Card
          title="Activity"
          action={
            <Button size="sm" variant="secondary" onClick={openActivityModal}>
              Log Activity
            </Button>
          }
        >
          {activities.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No activities recorded yet</p>
          ) : (
            <ul className="space-y-4">
              {[...activities]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((a) => (
                  <li key={a.id} className="relative rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <Badge variant={activityTypeBadgeVariant(a.activity_type)}>
                        {a.activity_type.replace(/_/g, ' ')}
                      </Badge>
                      {a.outcome && <Badge variant="gray">{a.outcome.replace(/_/g, ' ')}</Badge>}
                      {a.call_duration_seconds != null && a.call_duration_seconds > 0 && (
                        <span className="text-xs text-gray-400">{formatDuration(a.call_duration_seconds)}</span>
                      )}
                      <span className="ml-auto text-xs text-gray-400">{timeAgo(a.created_at)}</span>
                    </div>
                    {a.notes && <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.notes}</p>}
                    <p className="mt-1 text-xs text-gray-400">
                      {a.created_by_first ? `${a.created_by_first} ${a.created_by_last}` : 'System'}
                    </p>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Payment Links                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <Card title="Payment Links">
          <DataTable<PaymentLink>
            loading={false}
            data={paymentLinks}
            emptyMessage="No payment links for this deal"
            columns={[
              {
                key: 'amount',
                header: 'Amount',
                render: (p) => <span className="font-medium">{formatCurrency(p.amount)}</span>,
              },
              {
                key: 'payment_type',
                header: 'Type',
                render: (p) => <span className="capitalize">{p.payment_type}</span>,
              },
              {
                key: 'processor',
                header: 'Processor',
                render: (p) => <span className="capitalize">{p.processor}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (p) => {
                  const v =
                    p.status === 'paid'
                      ? 'green'
                      : p.status === 'pending'
                        ? 'yellow'
                        : p.status === 'expired'
                          ? 'red'
                          : ('gray' as const);
                  return <Badge variant={v}>{p.status}</Badge>;
                },
              },
              {
                key: 'due_date',
                header: 'Due Date',
                render: (p) => formatDate(p.due_date),
              },
              {
                key: 'paid_at',
                header: 'Paid At',
                render: (p) => formatDate(p.paid_at),
              },
            ]}
          />
        </Card>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Update Stage Modal                                               */}
      {/* ---------------------------------------------------------------- */}
      <Modal open={stageModal} onClose={() => setStageModal(false)} title="Update Deal Stage" size="md">
        <form onSubmit={handleUpdateStage} className="space-y-4">
          {stageError && <p className="text-sm text-red-600">{stageError}</p>}
          <Select
            label="Stage"
            options={ALL_STAGE_OPTIONS}
            value={newStage}
            onChange={(e) => setNewStage(e.target.value)}
          />

          {newStage === 'lost' && (
            <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <Input
                label="Loss Reason"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                placeholder="e.g. Budget, timing, competitor"
              />
              <Input
                label="Competitor Name"
                value={competitorName}
                onChange={(e) => setCompetitorName(e.target.value)}
              />
              <Input
                label="Competitor Price"
                type="number"
                step="0.01"
                min="0"
                value={competitorPrice}
                onChange={(e) => setCompetitorPrice(e.target.value)}
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Loss Notes</label>
                <textarea
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
                  rows={3}
                  value={lossNotes}
                  onChange={(e) => setLossNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {newStage === 'won' && (
            <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-4">
              <Input
                label="Actual Value"
                type="number"
                step="0.01"
                min="0"
                value={wonActualValue}
                onChange={(e) => setWonActualValue(e.target.value)}
                placeholder="Final deal value"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setStageModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={stageSaving}>
              {stageSaving ? 'Saving…' : 'Update Stage'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---------------------------------------------------------------- */}
      {/* Log Activity Modal                                               */}
      {/* ---------------------------------------------------------------- */}
      <Modal open={activityModal} onClose={() => setActivityModal(false)} title="Log Activity" size="md">
        <form onSubmit={handleLogActivity} className="space-y-4">
          {actError && <p className="text-sm text-red-600">{actError}</p>}
          <Select
            label="Activity Type"
            options={ACTIVITY_TYPE_OPTIONS}
            value={actType}
            onChange={(e) => setActType(e.target.value)}
          />

          {(actType === 'call' || actType === 'meeting') && (
            <Select
              label="Outcome"
              options={OUTCOME_OPTIONS}
              value={actOutcome}
              onChange={(e) => setActOutcome(e.target.value)}
            />
          )}

          {(actType === 'call' || actType === 'meeting') && (
            <Input
              label="Duration (seconds)"
              type="number"
              min="0"
              value={actDuration}
              onChange={(e) => setActDuration(e.target.value)}
              placeholder="e.g. 300"
            />
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
              rows={4}
              value={actNotes}
              onChange={(e) => setActNotes(e.target.value)}
              placeholder="What happened?"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setActivityModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={actSaving}>
              {actSaving ? 'Saving…' : 'Log Activity'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper component for the detail rows
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{children ?? value ?? '—'}</dd>
    </div>
  );
}
