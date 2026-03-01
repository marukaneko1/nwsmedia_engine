export interface Business {
  id: number;
  place_id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  maps_url: string | null;
  scraped_at: string;
  updated_at: string;
}

export interface TriageResult {
  id: number;
  business_id: number;
  status: "NO_WEBSITE" | "DEAD_WEBSITE" | "FREE_SUBDOMAIN" | "PAGE_BUILDER" | "HAS_WEBSITE";
  http_status: number | null;
  redirect_url: string | null;
  is_free_subdomain: boolean;
  created_at: string;
}

export interface WebsiteAudit {
  id: number;
  business_id: number;
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  ssl_valid: boolean | null;
  mobile_friendly: boolean | null;
  tech_stack: Record<string, unknown> | null;
  content_freshness: string | null;
  created_at: string;
}

export interface LeadScore {
  id: number;
  business_id: number;
  score: number;
  tier: "HOT" | "WARM" | "COOL" | "COLD" | "SKIP";
  segment: "ESTABLISHED" | "NEW_SMALL" | null;
  breakdown: Record<string, unknown> | null;
  created_at: string;
}

export interface EnrichmentData {
  id: number;
  business_id: number;
  best_email: string | null;
  all_emails: string[] | null;
  owner_name: string | null;
  owner_position: string | null;
  social_profiles: Record<string, string> | null;
  enrichment_source: string | null;
  enriched_at: string;
}

export interface OutreachLog {
  id: number;
  business_id: number;
  channel: string | null;
  outreach_type: string | null;
  segment: string | null;
  email_address: string | null;
  campaign_id: string | null;
  status: string | null;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  created_at: string;
}

export interface LeadLifecycle {
  id: number;
  business_id: number;
  status: string;
  changed_at: string;
  notes: string | null;
}

export type PipelineStatus = "lead" | "contacted" | "replied" | "meeting" | "proposal" | "won" | "lost";

export interface LeadWithDetails {
  id: number;
  name: string;
  category: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  scraped_at: string;
  triage_status: string | null;
  score: number | null;
  tier: string | null;
  segment: string | null;
  best_email: string | null;
  owner_name: string | null;
  enrichment_source: string | null;
  pipeline_status: string | null;
}

export interface DailyLeadCount {
  date: string;
  count: number;
}

export interface KpiData {
  totalLeads: number;
  emailsFound: number;
  avgScore: number;
  outreachSent: number;
  leadsToday: number;
  emailsDelta: number;
  scoreDelta: number;
  outreachDelta: number;
}

export interface ActivityItem {
  id: number;
  type: "scraped" | "enriched" | "outreach" | "status_change";
  business_name: string;
  detail: string;
  timestamp: string;
}
