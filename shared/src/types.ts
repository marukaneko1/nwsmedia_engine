export type UserRole = 'va' | 'closer' | 'ops' | 'admin' | 'client';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'deleted';

export interface UserSchedule {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone?: string;
  personal_email?: string;
  google_voice_number?: string;
  personal_phone?: string;
  preferred_phone?: 'google_voice' | 'personal' | 'twilio';
  date_of_birth?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  join_date?: string;
  schedule?: UserSchedule;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  bio?: string;
  profile_completed?: boolean;
  team_id?: string;
  status: UserStatus;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  team_lead_id?: string;
  territory?: string;
  created_at: string;
  updated_at: string;
}

export type LeadSource = 'cold_call' | 'meta_ad' | 'instagram_dm' | 'referral' | 'scraper';
export type LeadStage = 'new' | 'contacted' | 'qualified' | 'nurture' | 'lost' | 'converted';

export interface Lead {
  id: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  website_url?: string;
  source: LeadSource;
  source_detail?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  industry?: string;
  company_size_min?: number;
  company_size_max?: number;
  estimated_revenue?: number;
  location_city?: string;
  location_state?: string;
  location_zip?: string;
  icp_score?: number;
  icp_score_factors?: Record<string, number>;
  website_quality_score?: number;
  tech_stack?: string[];
  assigned_va_id?: string;
  assigned_closer_id?: string;
  stage: LeadStage;
  last_contacted_at?: string;
  next_followup_at?: string;
  contact_attempts: number;
  loss_reason?: string;
  loss_notes?: string;
  lost_at?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  converted_to_deal_at?: string;
}

export type ActivityType = 'call' | 'email' | 'sms' | 'note' | 'meeting' | 'stage_change' | 'handoff';
export type CallOutcome = 'connected' | 'voicemail' | 'no_answer' | 'gatekeeper' | 'dnc';

export interface Activity {
  id: string;
  lead_id?: string;
  deal_id?: string;
  client_id?: string;
  activity_type: ActivityType;
  outcome?: CallOutcome;
  call_duration_seconds?: number;
  call_recording_url?: string;
  call_transcript?: string;
  phone_number_used?: string;
  email_subject?: string;
  email_opened?: boolean;
  email_clicked?: boolean;
  notes?: string;
  created_by_id: string;
  created_at: string;
}

export type DealStage = 'discovery' | 'proposal_sent' | 'contract_sent' | 'awaiting_deposit' | 'won' | 'lost';

export interface Deal {
  id: string;
  lead_id: string;
  assigned_closer_id: string;
  originating_va_id?: string;
  company_name: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  estimated_value?: number;
  actual_value?: number;
  payment_terms?: string;
  stage: DealStage;
  discovery_call_date?: string;
  pain_point?: string;
  budget_range_min?: number;
  budget_range_max?: number;
  timeline?: string;
  decision_maker_name?: string;
  objections?: string[];
  proposal_sent_at?: string;
  proposal_url?: string;
  proposal_viewed_at?: string;
  proposal_expires_at?: string;
  contract_sent_at?: string;
  contract_signed_at?: string;
  contract_url?: string;
  deposit_amount?: number;
  deposit_due_date?: string;
  deposit_received_at?: string;
  final_payment_amount?: number;
  final_payment_received_at?: string;
  close_date?: string;
  close_probability?: number;
  days_in_pipeline?: number;
  loss_reason?: string;
  competitor_name?: string;
  competitor_price?: number;
  loss_notes?: string;
  created_at: string;
  updated_at: string;
}

export type PaymentType = 'deposit' | 'final' | 'milestone' | 'addon' | 'recurring';
export type PaymentProcessor = 'stripe' | 'square' | 'paypal';
export type PaymentLinkStatus = 'pending' | 'paid' | 'expired' | 'voided';

export interface PaymentLink {
  id: string;
  deal_id?: string;
  client_id?: string;
  created_by_id: string;
  slug: string;
  payment_type: PaymentType;
  amount: number;
  description?: string;
  processor: PaymentProcessor;
  payment_methods_enabled?: string[];
  stripe_payment_intent_id?: string;
  square_payment_id?: string;
  paypal_invoice_id?: string;
  status: PaymentLinkStatus;
  due_date?: string;
  send_reminders: boolean;
  paid_at?: string;
  paid_amount?: number;
  transaction_id?: string;
  processor_fee?: number;
  payment_method_type?: string;
  last_4_digits?: string;
  sent_at?: string;
  viewed_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'voided';

export interface Invoice {
  id: string;
  invoice_number: string;
  deal_id?: string;
  client_id?: string;
  payment_link_id?: string;
  invoice_type: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  line_items?: { description: string; quantity: number; unit_price: number; total: number }[];
  payment_terms?: string;
  due_date?: string;
  status: InvoiceStatus;
  sent_at?: string;
  viewed_at?: string;
  paid_at?: string;
  voided_at?: string;
  amount_paid: number;
  balance_due?: number;
  created_at: string;
  updated_at: string;
}

export type TransactionType = 'payment' | 'refund' | 'chargeback';

export interface Transaction {
  id: string;
  invoice_id?: string;
  payment_link_id?: string;
  client_id?: string;
  transaction_type: TransactionType;
  amount: number;
  processor: string;
  processor_transaction_id?: string;
  processor_fee?: number;
  net_amount?: number;
  payment_method?: string;
  card_brand?: string;
  last_4_digits?: string;
  status: string;
  failure_reason?: string;
  completed_at?: string;
  created_at: string;
}

export type CommissionType = 'va_deposit' | 'closer_final' | 'team_lead_bonus';
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'voided';

export interface Commission {
  id: string;
  user_id: string;
  deal_id: string;
  client_id?: string;
  commission_type: CommissionType;
  deal_value: number;
  commission_percentage?: number;
  commission_amount: number;
  rule_applied?: string;
  status: CommissionStatus;
  trigger_event?: string;
  triggered_at?: string;
  payout_date?: string;
  payout_method?: string;
  payout_reference?: string;
  paid_at?: string;
  voided_at?: string;
  void_reason?: string;
  created_at: string;
  updated_at: string;
}

export type ProjectStatus = 'not_started' | 'in_progress' | 'awaiting_approval' | 'revision_requested' | 'complete' | 'paused';

export interface Client {
  id: string;
  deal_id: string;
  company_name: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  project_name?: string;
  services_contracted?: string[];
  contract_value?: number;
  assigned_ops_lead_id?: string;
  assigned_closer_id?: string;
  kickoff_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  project_status: ProjectStatus;
  current_phase?: string;
  revision_limit: number;
  revisions_used: number;
  total_paid: number;
  balance_due?: number;
  final_payment_received: boolean;
  upsell_opportunity: boolean;
  upsell_notes?: string;
  referral_requested_at?: string;
  referrals_submitted: number;
  case_study_created: boolean;
  portal_access_enabled: boolean;
  portal_last_login_at?: string;
  handoff_notes?: string;
  project_brief?: string;
  project_goals?: string[];
  target_audience?: string;
  brand_guidelines?: string;
  competitors?: string;
  special_requirements?: string;
  handed_off_at?: string;
  handed_off_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  referred_by_client_id: string;
  company_name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  status: string;
  lead_id?: string;
  deal_id?: string;
  reward_type?: string;
  reward_amount?: number;
  reward_status: string;
  reward_paid_at?: string;
  submitted_at: string;
  contacted_at?: string;
  converted_at?: string;
}

export interface AuditLogEntry {
  id: string;
  user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}
