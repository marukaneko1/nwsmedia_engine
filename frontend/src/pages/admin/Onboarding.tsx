import { useState } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';

type Invite = {
  id: string;
  token: string;
  role: string;
  email: string | null;
  label: string | null;
  used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  creator_first: string;
  creator_last: string;
  used_first: string | null;
  used_last: string | null;
  max_uses: number | null;
  use_count: number | null;
};

type OnboardingLink = {
  id: string;
  client_id: string;
  token: string;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
  creator_first: string;
  creator_last: string;
};

type ClientRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  project_name: string | null;
  project_status: string;
  onboarding_completed_at: string | null;
};

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function roleBadgeVariant(role: string): 'blue' | 'purple' | 'green' {
  if (role === 'va') return 'blue';
  if (role === 'closer') return 'purple';
  return 'green';
}

function roleLabel(role: string): string {
  if (role === 'va') return 'VA (Cold Caller)';
  if (role === 'closer') return 'Closer';
  if (role === 'ops') return 'Operations';
  return role;
}

function isUniversal(inv: Invite): boolean {
  return inv.max_uses === null;
}

function inviteStatus(inv: Invite): { label: string; variant: 'green' | 'gray' | 'red' | 'yellow' } {
  if (inv.revoked_at) return { label: 'Revoked', variant: 'red' };
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) return { label: 'Expired', variant: 'yellow' };
  if (!isUniversal(inv) && inv.used_at) return { label: 'Used', variant: 'green' };
  if (isUniversal(inv)) return { label: `Universal · ${inv.use_count || 0} used`, variant: 'blue' as any };
  return { label: 'Active', variant: 'blue' as any };
}

type IntakeLink = {
  id: string;
  token: string;
  label: string;
  is_active: boolean;
  submission_count: string;
  expires_at: string | null;
  created_at: string;
  creator_first: string;
  creator_last: string;
};

type IntakeSubmission = {
  id: string;
  client_name: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  revenue_range: string | null;
  team_size: string | null;
  looking_for: string | null;
  status: string;
  link_label: string;
  created_at: string;
};

export function AdminOnboarding() {
  const [tab, setTab] = useState<'intake' | 'employees' | 'clients'>('intake');

  // ── Employee invites ──────────────────────────────────────────────
  const { data: invData, refetch: refetchInvites } = useApiQuery<{ invites: Invite[] }>('/invites');
  const invites = invData?.invites ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [newRole, setNewRole] = useState('va');
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newUniversal, setNewUniversal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const createInvite = async () => {
    setCreating(true);
    try {
      const res = await api.post<{ invite: Invite; link: string }>('/invites', {
        role: newRole,
        email: newUniversal ? undefined : (newEmail || undefined),
        label: newLabel || (newUniversal ? `${roleLabel(newRole)} Universal Link` : undefined),
        expires_in_days: newUniversal ? 365 : 7,
        max_uses: newUniversal ? null : 1,
      });
      setCreatedLink(res.link);
      setLinkCopied(false);
      refetchInvites();
    } catch {
      /* silent */
    }
    setCreating(false);
  };

  const revokeInvite = async (id: string) => {
    setRevoking(id);
    try {
      await api.delete(`/invites/${id}`);
      refetchInvites();
    } catch {
      /* silent */
    }
    setRevoking(null);
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const resetCreate = () => {
    setShowCreate(false);
    setCreatedLink(null);
    setNewRole('va');
    setNewEmail('');
    setNewLabel('');
    setNewUniversal(false);
    setLinkCopied(false);
  };

  const universalInvites = invites.filter(i => isUniversal(i) && !i.revoked_at && !(i.expires_at && new Date(i.expires_at) < new Date()));
  const activeInvites = invites.filter(i => !isUniversal(i) && !i.used_at && !i.revoked_at && !(i.expires_at && new Date(i.expires_at) < new Date()));
  const usedInvites = invites.filter(i => !isUniversal(i) && i.used_at);

  // ── Client onboarding ─────────────────────────────────────────────
  const { data: clientsData, refetch: refetchClients } = useApiQuery<{ data: ClientRow[]; total: number }>('/clients?limit=500');
  const clients = clientsData?.data ?? [];
  const [clientLinkLoading, setClientLinkLoading] = useState<string | null>(null);
  const [clientLinks, setClientLinks] = useState<Record<string, string>>({});
  const [clientLinkCopied, setClientLinkCopied] = useState<string | null>(null);

  const generateClientLink = async (clientId: string) => {
    setClientLinkLoading(clientId);
    try {
      const res = await api.post<{ link: string }>(`/clients/${clientId}/onboarding-link`);
      setClientLinks(prev => ({ ...prev, [clientId]: res.link }));
    } catch {
      /* silent */
    }
    setClientLinkLoading(null);
  };

  const copyClientLink = (clientId: string, link: string) => {
    navigator.clipboard.writeText(link);
    setClientLinkCopied(clientId);
    setTimeout(() => setClientLinkCopied(null), 2000);
  };

  const completedClients = clients.filter(c => c.onboarding_completed_at);
  const pendingClients = clients.filter(c => !c.onboarding_completed_at);

  // ── Client Intake Links ─────────────────────────────────────────
  const { data: intakeLinksData, refetch: refetchIntakeLinks } = useApiQuery<{ links: IntakeLink[] }>('/client-intake/links');
  const intakeLinks = intakeLinksData?.links ?? [];
  const { data: intakeSubsData, refetch: refetchIntakeSubs } = useApiQuery<{ submissions: IntakeSubmission[] }>('/client-intake/submissions');
  const intakeSubmissions = intakeSubsData?.submissions ?? [];
  const [generatingIntake, setGeneratingIntake] = useState(false);
  const [intakeLabel, setIntakeLabel] = useState('');
  const [generatedIntakeLink, setGeneratedIntakeLink] = useState<string | null>(null);
  const [intakeCopied, setIntakeCopied] = useState<string | null>(null);
  const [showIntakeCreate, setShowIntakeCreate] = useState(false);

  const generateIntakeLink = async () => {
    setGeneratingIntake(true);
    try {
      const res = await api.post<{ link: string }>('/client-intake/generate-link', {
        label: intakeLabel || 'Client Intake Link',
      });
      setGeneratedIntakeLink(res.link);
      refetchIntakeLinks();
    } catch { /* silent */ }
    setGeneratingIntake(false);
  };

  const copyIntakeLink = (link: string, id?: string) => {
    navigator.clipboard.writeText(link);
    setIntakeCopied(id || 'generated');
    setTimeout(() => setIntakeCopied(null), 2000);
  };

  const resetIntakeCreate = () => {
    setShowIntakeCreate(false);
    setGeneratedIntakeLink(null);
    setIntakeLabel('');
  };

  const updateSubmissionStatus = async (subId: string, status: string) => {
    try {
      await api.patch(`/client-intake/submissions/${subId}/status`, { status });
      refetchIntakeSubs();
    } catch { /* silent */ }
  };

  const deactivateIntakeLink = async (id: string) => {
    try {
      await api.delete(`/client-intake/links/${id}`);
      refetchIntakeLinks();
    } catch { /* silent */ }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate invite links for new employees and manage client onboarding
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-[#0a0a0a]">
        {([
          { key: 'intake' as const, label: 'Client Intake Links', count: intakeSubmissions.filter(s => s.status === 'new').length },
          { key: 'employees' as const, label: 'Employee Invites', count: activeInvites.length },
          { key: 'clients' as const, label: 'Client Onboarding', count: pendingClients.length },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-[#111] dark:text-gray-100'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-800 dark:bg-[#1a1a1a] dark:text-white">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Client Intake Links Tab ──────────────────────────────── */}
      {tab === 'intake' && (
        <div className="space-y-6">
          {/* Generate link card */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Shareable Client Intake Link</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Generate a link you can send to any prospective client. They'll fill out their info and it appears here.
                </p>
              </div>
              <Button onClick={() => { setShowIntakeCreate(true); setGeneratedIntakeLink(null); }}>
                Generate Link
              </Button>
            </div>
          </Card>

          {/* Active links */}
          {intakeLinks.filter(l => l.is_active).length > 0 && (
            <Card title="Active Links">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {intakeLinks.filter(l => l.is_active).map((link) => {
                  const url = `${window.location.origin}/intake/${link.token}`;
                  return (
                    <div key={link.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{link.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {link.submission_count} submission{link.submission_count !== '1' ? 's' : ''} &middot; Created {timeAgo(link.created_at)} by {link.creator_first} {link.creator_last}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => copyIntakeLink(url, link.id)}>
                            {intakeCopied === link.id ? 'Copied!' : 'Copy Link'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                            onClick={() => deactivateIntakeLink(link.id)}
                          >
                            Deactivate
                          </Button>
                        </div>
                      </div>
                      <input
                        readOnly
                        value={url}
                        className="mt-2 w-full rounded border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-300"
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Submissions */}
          <Card title={`Submissions (${intakeSubmissions.length})`}>
            {intakeSubmissions.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center dark:border-[#1a1a1a]">
                <svg className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No submissions yet. Share your intake link to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {intakeSubmissions.map((sub) => (
                  <div key={sub.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{sub.client_name}</p>
                          <Badge variant={
                            sub.status === 'new' ? 'blue' as any :
                            sub.status === 'contacted' ? 'yellow' :
                            sub.status === 'qualified' ? 'purple' :
                            sub.status === 'converted' ? 'green' : 'gray'
                          }>
                            {sub.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{sub.business_name}</p>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          {sub.email && <span>{sub.email}</span>}
                          {sub.phone && <span>{sub.phone}</span>}
                          {sub.website && <span>{sub.website}</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          {sub.revenue_range && <span>Revenue: {sub.revenue_range}</span>}
                          {sub.team_size && <span>Team: {sub.team_size}</span>}
                        </div>
                        {sub.looking_for && (
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 italic">"{sub.looking_for}"</p>
                        )}
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{timeAgo(sub.created_at)} via {sub.link_label}</p>
                      </div>
                      <div>
                        <select
                          value={sub.status}
                          onChange={(e) => updateSubmissionStatus(sub.id, e.target.value)}
                          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-200"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="qualified">Qualified</option>
                          <option value="converted">Converted</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Employee Invites Tab ───────────────────────────────────── */}
      {tab === 'employees' && (
        <div className="space-y-6">
          {/* Quick-create cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {(['va', 'closer', 'ops'] as const).map((role) => {
              const count = activeInvites.filter(i => i.role === role).length;
              return (
                <Card key={role}>
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant={roleBadgeVariant(role)}>{roleLabel(role)}</Badge>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {count} active invite{count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setNewRole(role);
                        setShowCreate(true);
                        setCreatedLink(null);
                      }}
                    >
                      Generate Link
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Universal Links */}
          <Card title="Universal Links">
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Reusable links per role — share one link and anyone can sign up. No expiry limit on uses.
            </p>
            {universalInvites.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center dark:border-[#1a1a1a]">
                <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.04a4.5 4.5 0 00-6.364-6.364L6.34 5.824a4.5 4.5 0 001.242 7.244" />
                </svg>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No universal links yet</p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => { setNewUniversal(true); setShowCreate(true); setCreatedLink(null); }}
                >
                  Create Universal Link
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {(['va', 'closer', 'ops'] as const).map((role) => {
                  const uni = universalInvites.find(i => i.role === role);
                  if (!uni) return (
                    <div key={role} className="flex items-center justify-between rounded-lg border border-dashed border-gray-200 px-4 py-3 dark:border-[#1a1a1a]">
                      <div className="flex items-center gap-3">
                        <Badge variant={roleBadgeVariant(role)}>{roleLabel(role)}</Badge>
                        <span className="text-sm text-gray-400 dark:text-gray-500">No universal link</span>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => { setNewRole(role); setNewUniversal(true); setShowCreate(true); setCreatedLink(null); }}>
                        Create
                      </Button>
                    </div>
                  );
                  const link = `${window.location.origin}/invite/${uni.token}`;
                  return (
                    <div key={role} className="rounded-lg border border-neutral-200 bg-neutral-50/50 px-4 py-3 dark:border-neutral-800 dark:bg-[#111]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant={roleBadgeVariant(role)}>{roleLabel(role)}</Badge>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {uni.use_count || 0} registration{(uni.use_count || 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => copyLink(link)}>
                            Copy Link
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                            onClick={() => revokeInvite(uni.id)}
                            disabled={revoking === uni.id}
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <input
                          readOnly
                          value={link}
                          className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-300"
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Active invites (single-use) */}
          <Card title={`Direct Invites (${activeInvites.length})`}>
            {activeInvites.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No active invite links. Generate one above.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {activeInvites.map((inv) => {
                  const link = `${window.location.origin}/invite/${inv.token}`;
                  return (
                    <div key={inv.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <Badge variant={roleBadgeVariant(inv.role)}>{inv.role.toUpperCase()}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {inv.label || inv.email || 'General invite'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Created {timeAgo(inv.created_at)} by {inv.creator_first} {inv.creator_last}
                          {inv.expires_at && ` · Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => copyLink(link)}>
                          Copy Link
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                          onClick={() => revokeInvite(inv.id)}
                          disabled={revoking === inv.id}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* History */}
          {usedInvites.length > 0 && (
            <Card title={`Used Invites (${usedInvites.length})`}>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {usedInvites.map((inv) => (
                  <div key={inv.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Badge variant={roleBadgeVariant(inv.role)}>{inv.role.toUpperCase()}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {inv.used_first} {inv.used_last}
                        {inv.label && <span className="text-gray-500 dark:text-gray-400"> ({inv.label})</span>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Registered {timeAgo(inv.used_at!)}
                      </p>
                    </div>
                    <Badge variant="green">Registered</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Revoked / expired */}
          {invites.filter(i => i.revoked_at || (i.expires_at && !i.used_at && new Date(i.expires_at) < new Date())).length > 0 && (
            <Card title="Revoked / Expired">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {invites
                  .filter(i => i.revoked_at || (i.expires_at && !i.used_at && new Date(i.expires_at) < new Date()))
                  .map((inv) => {
                    const st = inviteStatus(inv);
                    return (
                      <div key={inv.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <Badge variant={roleBadgeVariant(inv.role)}>{inv.role.toUpperCase()}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {inv.label || inv.email || 'General invite'}
                          </p>
                        </div>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Client Onboarding Tab ──────────────────────────────────── */}
      {tab === 'clients' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Clients</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{clients.length}</p>
            </Card>
            <Card>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Onboarding Complete</p>
              <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{completedClients.length}</p>
            </Card>
            <Card>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Awaiting Info</p>
              <p className="mt-1 text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pendingClients.length}</p>
            </Card>
          </div>

          {/* Pending clients */}
          <Card title={`Awaiting Onboarding (${pendingClients.length})`}>
            {pendingClients.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">All clients have completed onboarding.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {pendingClients.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.company_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {c.contact_name && `${c.contact_name} · `}
                        {c.project_name || 'No project name'}
                      </p>
                    </div>
                    <Badge variant="yellow">Pending</Badge>
                    {clientLinks[c.id] ? (
                      <div className="flex gap-2 items-center">
                        <input
                          readOnly
                          value={clientLinks[c.id]}
                          className="w-48 truncate rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-300"
                          onFocus={(e) => e.target.select()}
                        />
                        <Button size="sm" variant="secondary" onClick={() => copyClientLink(c.id, clientLinks[c.id])}>
                          {clientLinkCopied === c.id ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => generateClientLink(c.id)}
                        disabled={clientLinkLoading === c.id}
                      >
                        {clientLinkLoading === c.id ? 'Generating...' : 'Get Link'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Completed clients */}
          {completedClients.length > 0 && (
            <Card title={`Onboarding Complete (${completedClients.length})`}>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {completedClients.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.company_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Completed {timeAgo(c.onboarding_completed_at!)}
                      </p>
                    </div>
                    <Badge variant="green">Complete</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Generate Intake Link Modal ────────────────────────────── */}
      <Modal open={showIntakeCreate} onClose={resetIntakeCreate} title="Generate Client Intake Link" size="md">
        {generatedIntakeLink ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Intake link created!
              </p>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                Share this link with prospective clients. They'll fill out their name, business info, and what they're looking for.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={generatedIntakeLink}
                className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-200"
                onFocus={(e) => e.target.select()}
              />
              <Button onClick={() => copyIntakeLink(generatedIntakeLink)}>
                {intakeCopied === 'generated' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={resetIntakeCreate}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This creates a reusable link you can send to any client. When they open it, they'll see a simple form asking for their name, business name, website, revenue range, team size, and what they need help with.
            </p>
            <Input
              label="Label (optional)"
              value={intakeLabel}
              onChange={(e) => setIntakeLabel(e.target.value)}
              placeholder="e.g. Website lead form, Instagram DM link..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={resetIntakeCreate}>Cancel</Button>
              <Button onClick={generateIntakeLink} disabled={generatingIntake}>
                {generatingIntake ? 'Creating...' : 'Generate Link'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Invite Modal ──────────────────────────────────── */}
      <Modal open={showCreate} onClose={resetCreate} title="Generate Employee Invite" size="md">
        {createdLink ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                {newUniversal ? 'Universal link created!' : 'Invite link created!'}
              </p>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                {newUniversal
                  ? `Share this link with all ${roleLabel(newRole)} candidates. It can be used unlimited times and expires in 1 year.`
                  : `Share this link with the new ${roleLabel(newRole)}. It expires in 7 days.`}
              </p>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={createdLink}
                className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-200"
                onFocus={(e) => e.target.select()}
              />
              <Button onClick={() => copyLink(createdLink)}>
                {linkCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={resetCreate}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Universal toggle */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-[#1a1a1a]">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Universal Link</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Reusable by unlimited people for this role
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewUniversal(!newUniversal)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  newUniversal ? 'bg-neutral-900' : 'bg-gray-200 dark:bg-[#111]'
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                  newUniversal ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <Select
              label="Role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              options={[
                { value: 'va', label: 'VA (Cold Caller)' },
                { value: 'closer', label: 'Closer' },
                { value: 'ops', label: 'Operations' },
              ]}
            />
            {!newUniversal && (
              <Input
                label="Recipient Email (optional)"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="jane@gmail.com"
              />
            )}
            <Input
              label="Label / Note (optional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={newUniversal ? 'e.g. VA Hiring Link' : "e.g. 'New hire - March batch'"}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {newUniversal
                ? 'This link can be used by unlimited people and expires in 1 year. Anyone with the link can register as this role.'
                : 'The link will expire in 7 days. The employee will fill out their profile and set a password.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={resetCreate}>Cancel</Button>
              <Button onClick={createInvite} disabled={creating}>
                {creating ? 'Creating...' : newUniversal ? 'Create Universal Link' : 'Generate Link'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
