import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../../utils/api';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { StatsCard } from '../../../components/ui/StatsCard';
import { Button } from '../../../components/ui/Button';

type LeadDetail = {
  id: string;
  name: string;
  category: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  rating: number;
  review_count: number;
  maps_url: string;
  source_channel: string;
  source_url: string;
  listing_description: string;
  scraped_at: string;
  score: number | null;
  tier: string | null;
  segment: string | null;
  triage_status: string | null;
  http_status: number | null;
  redirect_url: string | null;
  best_email: string | null;
  all_emails: string | null;
  owner_name: string | null;
  owner_position: string | null;
  social_profiles: string | null;
  enrichment_source: string | null;
  audit: {
    performance_score: number;
    seo_score: number;
    accessibility_score: number;
    best_practices_score: number;
    ssl_valid: boolean;
    mobile_friendly: boolean;
    tech_stack: string;
    content_freshness: string;
  } | null;
  outreach: {
    id: string;
    channel: string;
    outreach_type: string;
    email_address: string;
    status: string;
    sent_at: string;
  }[];
};

function tierBadgeVariant(tier: string | null): 'red' | 'yellow' | 'blue' | 'gray' {
  switch (tier) {
    case 'HOT': return 'red';
    case 'WARM': return 'yellow';
    case 'COOL': return 'blue';
    default: return 'gray';
  }
}

function segmentBadgeVariant(segment: string | null): 'green' | 'purple' | 'gray' {
  switch (segment) {
    case 'ESTABLISHED': return 'green';
    case 'NEW_SMALL': return 'purple';
    default: return 'gray';
  }
}

export function ScrapedLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get<LeadDetail>(`/scraper/leads/${id}`)
      .then(setLead)
      .catch((err) => setError(err.message || 'Failed to load lead'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">{error || 'Lead not found'}</p>
            <Link to="/admin/lead-engine/leads" className="mt-4 inline-block">
              <Button variant="secondary" size="sm">Back to Leads</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const socials = lead.social_profiles ? (() => { try { return JSON.parse(lead.social_profiles); } catch { return null; } })() : null;
  const allEmails = lead.all_emails ? (() => { try { return JSON.parse(lead.all_emails); } catch { return lead.all_emails.split(','); } })() : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/lead-engine/leads" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-2 inline-flex items-center gap-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Leads
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{lead.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{lead.category}</p>
        </div>
        <div className="flex items-center gap-2">
          {lead.tier && <Badge variant={tierBadgeVariant(lead.tier)}>{lead.tier}</Badge>}
          {lead.segment && <Badge variant={segmentBadgeVariant(lead.segment)}>{lead.segment.replace('_', ' ')}</Badge>}
        </div>
      </div>

      {/* Score stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Lead Score" value={lead.score ?? 'N/A'} />
        <StatsCard title="Rating" value={lead.rating ? `${lead.rating} \u2605` : 'N/A'} subtitle={lead.review_count ? `${lead.review_count} reviews` : undefined} />
        <StatsCard title="Source" value={lead.source_channel === 'craigslist' ? 'Craigslist' : 'Google Maps'} />
        <StatsCard title="Triage" value={lead.triage_status?.replace(/_/g, ' ') ?? 'Pending'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Business info */}
        <Card title="Business Info">
          <div className="space-y-3">
            <InfoRow label="Address" value={lead.address} />
            <InfoRow label="City" value={`${lead.city || ''}${lead.state ? `, ${lead.state}` : ''}`} />
            <InfoRow label="Phone" value={lead.phone} />
            <InfoRow label="Email" value={lead.email || lead.best_email || undefined} />
            <InfoRow label="Website" value={lead.website} isLink />
            {lead.maps_url && <InfoRow label="Google Maps" value={lead.maps_url} isLink />}
            {lead.source_url && <InfoRow label="Source URL" value={lead.source_url} isLink />}
            <InfoRow label="Scraped" value={lead.scraped_at ? new Date(lead.scraped_at).toLocaleDateString() : undefined} />
          </div>
        </Card>

        {/* Enrichment */}
        <Card title="Enrichment Data">
          <div className="space-y-3">
            <InfoRow label="Owner Name" value={lead.owner_name || undefined} />
            <InfoRow label="Position" value={lead.owner_position || undefined} />
            <InfoRow label="Best Email" value={lead.best_email || undefined} />
            {Array.isArray(allEmails) && allEmails.length > 1 && (
              <div className="flex items-start justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">All Emails</span>
                <div className="text-sm text-gray-900 dark:text-gray-100 text-right">
                  {allEmails.map((e: string, i: number) => <div key={i}>{e}</div>)}
                </div>
              </div>
            )}
            {socials && typeof socials === 'object' && (
              <>
                {socials.facebook && <InfoRow label="Facebook" value={socials.facebook} isLink />}
                {socials.linkedin && <InfoRow label="LinkedIn" value={socials.linkedin} isLink />}
                {socials.instagram && <InfoRow label="Instagram" value={socials.instagram} isLink />}
                {socials.twitter && <InfoRow label="Twitter" value={socials.twitter} isLink />}
              </>
            )}
            <InfoRow label="Enrichment Source" value={lead.enrichment_source || undefined} />
            {!lead.owner_name && !lead.best_email && !socials && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Not yet enriched</p>
            )}
          </div>
        </Card>

        {/* Audit */}
        {lead.audit && (
          <Card title="Website Audit">
            <div className="grid grid-cols-2 gap-4">
              <ScoreBox label="Performance" score={lead.audit.performance_score} />
              <ScoreBox label="SEO" score={lead.audit.seo_score} />
              <ScoreBox label="Accessibility" score={lead.audit.accessibility_score} />
              <ScoreBox label="Best Practices" score={lead.audit.best_practices_score} />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">SSL Valid</span>
                <span className={lead.audit.ssl_valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {lead.audit.ssl_valid ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Mobile Friendly</span>
                <span className={lead.audit.mobile_friendly ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {lead.audit.mobile_friendly ? 'Yes' : 'No'}
                </span>
              </div>
              {lead.audit.tech_stack && <InfoRow label="Tech Stack" value={lead.audit.tech_stack} />}
            </div>
          </Card>
        )}

        {/* Triage Details */}
        <Card title="Triage Details">
          <div className="space-y-3">
            <InfoRow label="Status" value={lead.triage_status?.replace(/_/g, ' ') || 'Pending'} />
            {lead.http_status && <InfoRow label="HTTP Status" value={String(lead.http_status)} />}
            {lead.redirect_url && <InfoRow label="Redirect URL" value={lead.redirect_url} isLink />}
          </div>
        </Card>
      </div>

      {/* Outreach History */}
      {lead.outreach && lead.outreach.length > 0 && (
        <Card title="Outreach History">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-[#1a1a1a]">
              <thead className="bg-gray-50 dark:bg-[#0a0a0a]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Channel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-[#1a1a1a]">
                {lead.outreach.map((o) => (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{o.channel}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{o.outreach_type}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{o.email_address || '\u2014'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm"><Badge variant="gray">{o.status}</Badge></td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{o.sent_at ? new Date(o.sent_at).toLocaleDateString() : '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Listing description */}
      {lead.listing_description && (
        <Card title="Listing Description">
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{lead.listing_description}</p>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value, isLink }: { label: string; value?: string | null; isLink?: boolean }) {
  if (!value) return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm text-gray-400 dark:text-gray-500">\u2014</span>
    </div>
  );

  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      {isLink ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline dark:text-blue-400 text-right truncate max-w-[300px]">
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-900 dark:text-gray-100 text-right">{value}</span>
      )}
    </div>
  );
}

function ScoreBox({ label, score }: { label: string; score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 90 ? 'text-green-600 dark:text-green-400' : pct >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
  return (
    <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-[#1a1a1a]">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{pct}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}
