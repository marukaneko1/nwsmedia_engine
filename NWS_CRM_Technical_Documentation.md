# NWS Media CRM - Complete Technical Documentation

**Version:** 1.0  
**Last Updated:** March 29, 2026  
**Document Owner:** Maru Kane, CEO NWS Media LLC

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Feature Specifications](#feature-specifications)
5. [API Documentation](#api-documentation)
6. [Integration Specifications](#integration-specifications)
7. [Security & Compliance](#security--compliance)
8. [Build Phases & Timeline](#build-phases--timeline)
9. [Deployment Architecture](#deployment-architecture)
10. [Testing Strategy](#testing-strategy)
11. [Maintenance & Operations](#maintenance--operations)

---

## Executive Summary

### Purpose
NWS Media CRM is a specialized sales and operations platform designed for digital marketing agencies. It manages the complete lifecycle from cold lead capture through project delivery, with integrated payment processing, commission tracking, and client portals.

### Core Business Goals
- Automate VA → Closer handoff with zero lead leakage
- Track every dollar from deposit through final payment
- Calculate commissions automatically with no manual spreadsheets
- Scale from 2 reps to 50+ without system rewrites
- Reduce ops support burden with self-service client portal

### Target Users
- **VAs (Cold Callers):** 5-10 initially, 50+ at scale
- **Closers (Sales Reps):** 2-5 initially, 20+ at scale
- **Ops Team:** 2-3 project managers
- **Admin/Finance:** CEO + bookkeeper
- **Clients:** 50-200 active projects

### Tech Stack Decision
- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (Supabase or Neon hosted)
- **Hosting:** Vercel (frontend) + Railway (backend)
- **File Storage:** AWS S3 or Cloudflare R2

### Success Metrics
- Lead → Deal conversion rate by VA (target: >15%)
- Deal → Client close rate by Closer (target: >30%)
- Average deal cycle time (target: <21 days)
- Commission payout accuracy (target: 100%, zero disputes)
- Client portal adoption (target: >80% active users)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
│  React SPA + Client Portal + Payment Pages                 │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
│  Express REST API + Webhook Handlers + Auth Middleware     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                      │
│  Lead Scoring + Commission Calc + Automation Engine        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│  PostgreSQL + Redis Cache + S3 File Storage                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 External Integrations                       │
│  Stripe/Square/PayPal + Twilio + Clearbit + DocuSign       │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Frontend Applications
1. **VA Dashboard** (`/va/*`)
   - Call queue interface
   - Click-to-dial phone system
   - Quick qualification form
   - Commission tracker
   
2. **Closer Dashboard** (`/closer/*`)
   - Deal pipeline (Kanban view)
   - Qualified leads queue
   - Proposal builder
   - Payment link generator
   
3. **Ops Dashboard** (`/ops/*`)
   - Active projects list
   - Delivery timeline view
   - File upload/download
   - Client communication
   
4. **Admin Dashboard** (`/admin/*`)
   - Analytics & reports
   - User management
   - System settings
   - Commission payouts
   
5. **Client Portal** (`/portal/*`)
   - Project status view
   - File sharing
   - Payment center
   - Referral submission

6. **Payment Pages** (`pay.nwsmedia.com/*`)
   - Branded payment interface
   - Multi-processor support
   - Receipt generation

#### Backend Services

1. **API Server** (Express)
   - RESTful endpoints
   - JWT authentication
   - Rate limiting
   - Request validation

2. **Webhook Handler**
   - Stripe events
   - Square events
   - PayPal IPN
   - Signature verification

3. **Background Jobs** (Bull + Redis)
   - Email sending
   - SMS delivery
   - Data enrichment
   - Report generation

4. **Automation Engine**
   - Sequence triggers
   - Payment reminders
   - Commission calculations
   - Project delivery automation

---

## Database Schema

### Core Tables

#### users
Primary authentication and user management table.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'va', 'closer', 'ops', 'admin', 'client'
  phone VARCHAR(50),
  google_voice_number VARCHAR(50),
  personal_phone VARCHAR(50),
  preferred_phone VARCHAR(50), -- 'google_voice', 'personal', 'twilio'
  team_id UUID REFERENCES teams(id),
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'suspended'
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_team_id ON users(team_id);
```

#### teams
Organizational units for VAs and Closers.

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  team_lead_id UUID REFERENCES users(id),
  territory VARCHAR(255), -- 'Long Island', 'Bergen County', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### leads
Every cold contact before qualification.

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact Info
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  linkedin_url VARCHAR(500),
  website_url VARCHAR(500),
  
  -- Lead Source
  source VARCHAR(100) NOT NULL, -- 'cold_call', 'meta_ad', 'instagram_dm', 'referral', 'scraper'
  source_detail VARCHAR(255), -- Campaign name, referrer name, etc.
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Firmographics (enriched data)
  industry VARCHAR(255),
  company_size_min INT,
  company_size_max INT,
  estimated_revenue DECIMAL(15,2),
  location_city VARCHAR(100),
  location_state VARCHAR(100),
  location_zip VARCHAR(20),
  
  -- Qualification Data
  icp_score INT CHECK (icp_score >= 1 AND icp_score <= 10),
  icp_score_factors JSONB, -- Breakdown of scoring
  website_quality_score INT CHECK (website_quality_score >= 1 AND website_quality_score <= 10),
  tech_stack JSONB, -- Array of detected technologies
  
  -- Assignment
  assigned_va_id UUID REFERENCES users(id),
  assigned_closer_id UUID REFERENCES users(id),
  
  -- Status & Tracking
  stage VARCHAR(50) DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'nurture', 'lost', 'converted'
  last_contacted_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  contact_attempts INT DEFAULT 0,
  
  -- Loss tracking
  loss_reason VARCHAR(255),
  loss_notes TEXT,
  lost_at TIMESTAMPTZ,
  
  -- Tags & Notes
  tags TEXT[], -- Array of custom tags
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  converted_to_deal_at TIMESTAMPTZ
);

CREATE INDEX idx_leads_assigned_va ON leads(assigned_va_id);
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_icp_score ON leads(icp_score);
CREATE INDEX idx_leads_next_followup ON leads(next_followup_at);
CREATE INDEX idx_leads_source ON leads(source);
```

#### activities
All interactions with leads/deals/clients.

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Related entity
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type VARCHAR(100) NOT NULL, -- 'call', 'email', 'sms', 'note', 'meeting', 'stage_change'
  outcome VARCHAR(100), -- 'connected', 'voicemail', 'no_answer', 'gatekeeper', 'dnc'
  
  -- Call-specific
  call_duration_seconds INT,
  call_recording_url VARCHAR(500),
  call_transcript TEXT,
  phone_number_used VARCHAR(50),
  
  -- Email-specific
  email_subject VARCHAR(500),
  email_opened BOOLEAN DEFAULT FALSE,
  email_clicked BOOLEAN DEFAULT FALSE,
  
  -- General
  notes TEXT,
  created_by_id UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_lead_id ON activities(lead_id);
CREATE INDEX idx_activities_deal_id ON activities(deal_id);
CREATE INDEX idx_activities_client_id ON activities(client_id);
CREATE INDEX idx_activities_created_by ON activities(created_by_id);
CREATE INDEX idx_activities_type ON activities(activity_type);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
```

#### deals
Qualified leads in the sales pipeline.

```sql
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  lead_id UUID REFERENCES leads(id) NOT NULL,
  assigned_closer_id UUID REFERENCES users(id) NOT NULL,
  originating_va_id UUID REFERENCES users(id), -- VA who qualified this
  
  -- Deal Info
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  
  -- Deal Value & Terms
  estimated_value DECIMAL(15,2),
  actual_value DECIMAL(15,2),
  payment_terms VARCHAR(100), -- '50_50', 'net30', 'custom'
  
  -- Pipeline Stage
  stage VARCHAR(100) DEFAULT 'discovery', 
  -- 'discovery', 'proposal_sent', 'contract_sent', 'awaiting_deposit', 'won', 'lost'
  
  -- Discovery
  discovery_call_date TIMESTAMPTZ,
  pain_point TEXT,
  budget_range_min DECIMAL(15,2),
  budget_range_max DECIMAL(15,2),
  timeline VARCHAR(255),
  decision_maker_name VARCHAR(255),
  objections TEXT[],
  
  -- Proposal
  proposal_sent_at TIMESTAMPTZ,
  proposal_url VARCHAR(500),
  proposal_viewed_at TIMESTAMPTZ,
  proposal_expires_at TIMESTAMPTZ,
  
  -- Contract
  contract_sent_at TIMESTAMPTZ,
  contract_signed_at TIMESTAMPTZ,
  contract_url VARCHAR(500),
  
  -- Payment
  deposit_amount DECIMAL(15,2),
  deposit_due_date DATE,
  deposit_received_at TIMESTAMPTZ,
  final_payment_amount DECIMAL(15,2),
  final_payment_received_at TIMESTAMPTZ,
  
  -- Close tracking
  close_date TIMESTAMPTZ,
  close_probability INT CHECK (close_probability >= 0 AND close_probability <= 100),
  days_in_pipeline INT,
  
  -- Loss tracking
  loss_reason VARCHAR(255),
  competitor_name VARCHAR(255),
  competitor_price DECIMAL(15,2),
  loss_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deals_lead_id ON deals(lead_id);
CREATE INDEX idx_deals_assigned_closer ON deals(assigned_closer_id);
CREATE INDEX idx_deals_originating_va ON deals(originating_va_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_close_date ON deals(close_date);
```

#### payment_links
All payment links generated for deposits and final payments.

```sql
CREATE TABLE payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  deal_id UUID REFERENCES deals(id),
  client_id UUID REFERENCES clients(id),
  created_by_id UUID REFERENCES users(id) NOT NULL,
  
  -- Link Details
  slug VARCHAR(255) UNIQUE NOT NULL, -- URL slug: pay.nwsmedia.com/{slug}
  payment_type VARCHAR(100) NOT NULL, -- 'deposit', 'final', 'milestone', 'addon', 'recurring'
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  
  -- Payment Processor
  processor VARCHAR(50) NOT NULL, -- 'stripe', 'square', 'paypal'
  payment_methods_enabled TEXT[], -- ['card', 'ach', 'apple_pay']
  
  -- Processor IDs
  stripe_payment_intent_id VARCHAR(255),
  square_payment_id VARCHAR(255),
  paypal_invoice_id VARCHAR(255),
  
  -- Status & Tracking
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'paid', 'expired', 'voided'
  due_date DATE,
  send_reminders BOOLEAN DEFAULT TRUE,
  
  -- Payment Receipt
  paid_at TIMESTAMPTZ,
  paid_amount DECIMAL(15,2),
  transaction_id VARCHAR(255),
  processor_fee DECIMAL(10,2),
  payment_method_type VARCHAR(50), -- 'card', 'ach', 'paypal_balance'
  last_4_digits VARCHAR(4),
  
  -- Link Management
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_links_slug ON payment_links(slug);
CREATE INDEX idx_payment_links_deal_id ON payment_links(deal_id);
CREATE INDEX idx_payment_links_client_id ON payment_links(client_id);
CREATE INDEX idx_payment_links_status ON payment_links(status);
CREATE INDEX idx_payment_links_due_date ON payment_links(due_date);
```

#### invoices
Financial record of all invoices sent to clients.

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(100) UNIQUE NOT NULL, -- NWS-2026-0001
  
  -- Relationships
  deal_id UUID REFERENCES deals(id),
  client_id UUID REFERENCES clients(id),
  payment_link_id UUID REFERENCES payment_links(id),
  
  -- Invoice Details
  invoice_type VARCHAR(100) NOT NULL, -- 'deposit', 'final', 'milestone', 'addon'
  amount DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  
  -- Line Items (JSONB array)
  line_items JSONB, -- [{description, quantity, unit_price, total}]
  
  -- Terms
  payment_terms VARCHAR(100), -- 'due_on_receipt', 'net30', 'net60'
  due_date DATE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'sent', 'viewed', 'paid', 'overdue', 'voided'
  
  -- Dates
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  
  -- Payment tracking
  amount_paid DECIMAL(15,2) DEFAULT 0,
  balance_due DECIMAL(15,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_deal_id ON invoices(deal_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
```

#### transactions
All financial transactions (payments, refunds, chargebacks).

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  invoice_id UUID REFERENCES invoices(id),
  payment_link_id UUID REFERENCES payment_links(id),
  client_id UUID REFERENCES clients(id),
  
  -- Transaction Details
  transaction_type VARCHAR(50) NOT NULL, -- 'payment', 'refund', 'chargeback'
  amount DECIMAL(15,2) NOT NULL,
  processor VARCHAR(50) NOT NULL, -- 'stripe', 'square', 'paypal', 'manual'
  processor_transaction_id VARCHAR(255),
  processor_fee DECIMAL(10,2),
  net_amount DECIMAL(15,2), -- amount - processor_fee
  
  -- Payment Method
  payment_method VARCHAR(50), -- 'card', 'ach', 'paypal', 'check', 'wire'
  card_brand VARCHAR(50), -- 'visa', 'mastercard', 'amex'
  last_4_digits VARCHAR(4),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
  failure_reason TEXT,
  
  -- Timestamps
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_invoice_id ON transactions(invoice_id);
CREATE INDEX idx_transactions_client_id ON transactions(client_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
```

#### commissions
Commission records for VAs and Closers.

```sql
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  user_id UUID REFERENCES users(id) NOT NULL, -- VA or Closer earning commission
  deal_id UUID REFERENCES deals(id) NOT NULL,
  client_id UUID REFERENCES clients(id),
  
  -- Commission Details
  commission_type VARCHAR(50) NOT NULL, -- 'va_deposit', 'closer_final', 'team_lead_bonus'
  deal_value DECIMAL(15,2) NOT NULL,
  commission_percentage DECIMAL(5,2), -- 10.00 = 10%
  commission_amount DECIMAL(15,2) NOT NULL,
  
  -- Rules Applied
  rule_applied VARCHAR(255), -- Description of which commission rule was used
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'voided'
  trigger_event VARCHAR(100), -- 'deposit_received', 'final_payment_received'
  triggered_at TIMESTAMPTZ,
  
  -- Payout
  payout_date DATE,
  payout_method VARCHAR(50), -- 'zelle', 'venmo', 'ach', 'check'
  payout_reference VARCHAR(255),
  paid_at TIMESTAMPTZ,
  
  -- Voiding (if deal refunded)
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commissions_user_id ON commissions(user_id);
CREATE INDEX idx_commissions_deal_id ON commissions(deal_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_payout_date ON commissions(payout_date);
```

#### clients
Projects in delivery or completed.

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  deal_id UUID REFERENCES deals(id) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  
  -- Primary Contact
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  
  -- Project Details
  project_name VARCHAR(255),
  services_contracted TEXT[], -- ['web_design', 'seo', 'social_media']
  contract_value DECIMAL(15,2),
  
  -- Team Assignment
  assigned_ops_lead_id UUID REFERENCES users(id),
  assigned_closer_id UUID REFERENCES users(id), -- For upsells
  
  -- Project Dates
  kickoff_date DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  
  -- Project Status
  project_status VARCHAR(100) DEFAULT 'not_started', 
  -- 'not_started', 'in_progress', 'awaiting_approval', 'revision_requested', 'complete', 'paused'
  current_phase VARCHAR(255),
  
  -- Revisions
  revision_limit INT DEFAULT 3,
  revisions_used INT DEFAULT 0,
  
  -- Payment Status
  total_paid DECIMAL(15,2) DEFAULT 0,
  balance_due DECIMAL(15,2),
  final_payment_received BOOLEAN DEFAULT FALSE,
  
  -- Retention & Growth
  upsell_opportunity BOOLEAN DEFAULT FALSE,
  upsell_notes TEXT,
  referral_requested_at TIMESTAMPTZ,
  referrals_submitted INT DEFAULT 0,
  case_study_created BOOLEAN DEFAULT FALSE,
  
  -- Portal Access
  portal_access_enabled BOOLEAN DEFAULT TRUE,
  portal_last_login_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_deal_id ON clients(deal_id);
CREATE INDEX idx_clients_ops_lead ON clients(assigned_ops_lead_id);
CREATE INDEX idx_clients_status ON clients(project_status);
CREATE INDEX idx_clients_delivery_date ON clients(expected_delivery_date);
```

#### projects
Detailed project tracking (child of clients).

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  client_id UUID REFERENCES clients(id) NOT NULL,
  
  -- Project Info
  project_name VARCHAR(255) NOT NULL,
  project_type VARCHAR(100), -- 'web_design', 'seo', 'social_media', 'paid_ads'
  description TEXT,
  
  -- Milestones (JSONB array)
  milestones JSONB, 
  -- [{name, due_date, completed_at, payment_amount, status}]
  
  -- Deliverables
  deliverables_list JSONB,
  -- [{name, description, file_url, delivered_at}]
  
  -- Status
  status VARCHAR(100) DEFAULT 'not_started',
  current_milestone VARCHAR(255),
  
  -- Dates
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
```

#### files
File storage for all uploaded documents and deliverables.

```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships (polymorphic - can belong to lead, deal, or client)
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  -- File Details
  filename VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500),
  file_type VARCHAR(100), -- 'proposal', 'contract', 'invoice', 'deliverable', 'client_upload'
  mime_type VARCHAR(100),
  file_size BIGINT, -- bytes
  
  -- Storage
  storage_provider VARCHAR(50) DEFAULT 's3', -- 's3', 'r2', 'local'
  storage_path VARCHAR(1000), -- S3 key or file path
  storage_url VARCHAR(1000), -- Public or signed URL
  
  -- Access Control
  visibility VARCHAR(50) DEFAULT 'private', -- 'private', 'client_portal', 'public'
  
  -- Metadata
  uploaded_by_id UUID REFERENCES users(id),
  description TEXT,
  tags TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_lead_id ON files(lead_id);
CREATE INDEX idx_files_deal_id ON files(deal_id);
CREATE INDEX idx_files_client_id ON files(client_id);
CREATE INDEX idx_files_project_id ON files(project_id);
CREATE INDEX idx_files_type ON files(file_type);
```

#### referrals
Referral tracking from clients.

```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referrer (existing client)
  referred_by_client_id UUID REFERENCES clients(id) NOT NULL,
  
  -- Referral Details
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  notes TEXT,
  
  -- Tracking
  status VARCHAR(100) DEFAULT 'submitted', 
  -- 'submitted', 'contacted', 'qualified', 'won', 'lost'
  
  -- If converted to lead/deal
  lead_id UUID REFERENCES leads(id),
  deal_id UUID REFERENCES deals(id),
  
  -- Reward
  reward_type VARCHAR(100), -- 'credit', 'cash', 'discount'
  reward_amount DECIMAL(10,2),
  reward_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'paid'
  reward_paid_at TIMESTAMPTZ,
  
  -- Timestamps
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ
);

CREATE INDEX idx_referrals_referred_by ON referrals(referred_by_client_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_lead_id ON referrals(lead_id);
```

#### sequences
Automated email/SMS drip sequences.

```sql
CREATE TABLE sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Sequence Config
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sequence_type VARCHAR(100), -- 'nurture', 'payment_reminder', 'upsell', 'referral_request'
  
  -- Trigger Conditions
  trigger_event VARCHAR(255), -- 'lead_created', 'proposal_sent', 'invoice_overdue'
  trigger_delay_days INT DEFAULT 0,
  
  -- Steps (JSONB array)
  steps JSONB,
  -- [{step_number, delay_days, channel, subject, body, template_id}]
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### sequence_enrollments
Track which leads/deals are in which sequences.

```sql
CREATE TABLE sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  sequence_id UUID REFERENCES sequences(id) NOT NULL,
  lead_id UUID REFERENCES leads(id),
  deal_id UUID REFERENCES deals(id),
  client_id UUID REFERENCES clients(id),
  
  -- Progress
  current_step INT DEFAULT 0,
  next_send_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  
  -- Timestamps
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_seq_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX idx_seq_enrollments_lead ON sequence_enrollments(lead_id);
CREATE INDEX idx_seq_enrollments_next_send ON sequence_enrollments(next_send_at);
```

#### audit_log
Complete audit trail of all system actions.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who & What
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL, -- 'create', 'update', 'delete', 'login', 'payment_received'
  entity_type VARCHAR(100), -- 'lead', 'deal', 'invoice', 'user'
  entity_id UUID,
  
  -- Changes
  changes JSONB, -- {field: {old: X, new: Y}}
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);
```

### Database Indexes Strategy

**High-Traffic Queries:**
- Lead lookups by VA: `idx_leads_assigned_va`, `idx_leads_stage`
- Deal pipeline by Closer: `idx_deals_assigned_closer`, `idx_deals_stage`
- Payment tracking: `idx_payment_links_status`, `idx_transactions_invoice_id`
- Commission reports: `idx_commissions_user_id`, `idx_commissions_status`

**Composite Indexes for Complex Queries:**
```sql
-- VA dashboard: "my open leads sorted by ICP score"
CREATE INDEX idx_leads_va_open_score ON leads(assigned_va_id, stage, icp_score DESC) 
WHERE stage NOT IN ('lost', 'converted');

-- Closer pipeline: "my deals by stage"
CREATE INDEX idx_deals_closer_stage ON deals(assigned_closer_id, stage, created_at DESC);

-- Overdue invoices
CREATE INDEX idx_invoices_overdue ON invoices(status, due_date) 
WHERE status NOT IN ('paid', 'voided');

-- Pending commissions by user
CREATE INDEX idx_commissions_pending_user ON commissions(user_id, status) 
WHERE status = 'pending';
```

---

## Feature Specifications

### Module 1: Lead Management

#### 1.1 Lead Capture

**Supported Sources:**
- Manual entry form (VA input)
- CSV bulk import
- Google Maps scraper integration (webhook)
- Meta Ads lead forms (API sync)
- Instagram DM capture (API polling)
- Referral submissions (public form)
- Apify scraper pipeline (webhook)

**Auto-Enrichment Flow:**
1. Lead created with minimal data (name, company, phone)
2. Background job triggers enrichment APIs
3. Clearbit/Apollo lookup by domain or email
4. BuiltWith tech stack detection
5. LinkedIn profile scraping (if URL provided)
6. All enriched data merged into lead record
7. ICP score calculated based on enriched data

**Duplicate Detection:**
- Check email (exact match)
- Check phone (normalized format)
- Check company name + domain (fuzzy match)
- If duplicate found: merge or reject with notification

#### 1.2 ICP Scoring Algorithm

**Scoring Factors (1-10 scale):**

```javascript
function calculateICPScore(lead) {
  let score = 0;
  
  // Company Size (30% weight)
  if (lead.company_size_min >= 10 && lead.company_size_max <= 100) {
    score += 3.0; // Sweet spot for NWS
  } else if (lead.company_size_min >= 5 && lead.company_size_max <= 200) {
    score += 2.0;
  } else {
    score += 1.0;
  }
  
  // Industry Match (25% weight)
  const highValueIndustries = [
    'construction', 'specialty_trade_contractors', 
    'medical_spas', 'legal_services', 'accounting', 'solar_installation'
  ];
  if (highValueIndustries.includes(lead.industry)) {
    score += 2.5;
  } else {
    score += 1.0;
  }
  
  // Geographic Fit (20% weight)
  const targetAreas = [
    'Long Island', 'Bergen County', 'Westchester', 'Fairfield County'
  ];
  const location = `${lead.location_city}, ${lead.location_state}`;
  if (targetAreas.some(area => location.includes(area))) {
    score += 2.0;
  } else if (lead.location_state === 'NY' || lead.location_state === 'NJ' || lead.location_state === 'CT') {
    score += 1.5;
  } else {
    score += 0.5;
  }
  
  // Website Quality (15% weight)
  if (lead.website_quality_score >= 7) {
    score += 0.5; // Good site = less urgent need
  } else if (lead.website_quality_score >= 4) {
    score += 1.5; // Decent site = medium need
  } else {
    score += 1.5; // Bad/no site = high need
  }
  
  // Budget Signals (10% weight)
  if (lead.estimated_revenue >= 1000000) {
    score += 1.0;
  } else if (lead.estimated_revenue >= 500000) {
    score += 0.7;
  } else {
    score += 0.3;
  }
  
  return Math.min(Math.round(score), 10);
}
```

**Score Storage:**
- Final score: `icp_score` (INT 1-10)
- Breakdown: `icp_score_factors` (JSONB with component scores)
- Recalculated on data update

#### 1.3 Lead Assignment

**Assignment Rules:**

1. **Auto-Assignment (Default):**
   - Round-robin within team
   - Weighted by VA capacity (max leads per VA)
   - Skip VAs on PTO/inactive status

2. **Score-Based Routing:**
   - ICP 9-10 → Senior VAs only
   - ICP 7-8 → All active VAs
   - ICP 1-6 → Junior VAs or bulk queue

3. **Territory-Based:**
   - Match lead location to VA territory
   - Fallback to round-robin if no match

4. **Manual Override:**
   - Admin can reassign any lead
   - Closer can "pull" qualified leads from queue

**Implementation:**
```javascript
// Assignment service
async function assignLead(leadId, assignmentStrategy = 'round_robin') {
  const lead = await db.leads.findById(leadId);
  
  if (assignmentStrategy === 'score_based') {
    const eligibleVAs = await getVAsByScoreThreshold(lead.icp_score);
    const assignedVA = selectNextInRotation(eligibleVAs);
    await db.leads.update(leadId, { assigned_va_id: assignedVA.id });
  } else if (assignmentStrategy === 'territory') {
    const va = await findVAByTerritory(lead.location_state);
    await db.leads.update(leadId, { assigned_va_id: va.id });
  } else {
    // Default round-robin
    const nextVA = await getNextVAInRotation();
    await db.leads.update(leadId, { assigned_va_id: nextVA.id });
  }
}
```

#### 1.4 Lead Nurture Sequences

**Sequence Triggers:**
- Lead marked as "Not ready" by VA
- Proposal sent but no response (3 days)
- Contract sent but not signed (5 days)
- Discovery scheduled but no-show
- Lost deal with reason "bad timing"

**Sequence Types:**

**1. "Not Ready" 6-Month Drip:**
```
Day 0: Welcome email + case study
Day 7: Video: "5 signs you need a new website"
Day 21: Client success story (same industry)
Week 6: Educational tip (SEO basics)
Month 3: Check-in email: "Still struggling with X?"
Month 6: Special offer: 10% off if signed this month
```

**2. Proposal Follow-Up:**
```
Day 3: "Did you have a chance to review?"
Day 7: "Quick question about the proposal"
Day 14: "Here's what other clients asked"
Day 21: Final follow-up + expires in 48hrs
```

**3. Ghost Recovery:**
```
Day 3: Gentle reminder
Day 7: "Did I miss something?"
Day 14: Case study showing ROI
Day 30: "Should I close this out?"
```

**Sequence Configuration in Database:**
```sql
INSERT INTO sequences (name, sequence_type, steps) VALUES (
  'Not Ready - 6 Month Nurture',
  'nurture',
  '[
    {"step": 1, "delay_days": 0, "channel": "email", "subject": "Welcome + Case Study", "template_id": "nurture_welcome"},
    {"step": 2, "delay_days": 7, "channel": "email", "subject": "5 Signs You Need a Website", "template_id": "nurture_video"},
    {"step": 3, "delay_days": 21, "channel": "email", "subject": "Success Story", "template_id": "nurture_case_study"}
  ]'
);
```

### Module 2: Phone System Integration

#### 2.1 Phone Number Management

**Per-User Configuration:**
```javascript
// User phone setup
{
  user_id: "uuid",
  google_voice_number: "+16465551234", // Auto-provisioned or manual
  personal_phone: "+19175559876",      // User-entered
  twilio_number: "+16465559999",       // Optional CRM-provisioned
  preferred_phone: "google_voice"      // Default for click-to-dial
}
```

**Google Voice Provisioning Flow:**
1. Admin creates VA user account
2. System auto-creates Gmail: `va.firstname@nwsmediaemail.com`
3. VA receives email with GV setup instructions
4. VA registers GV number and enters into CRM
5. CRM stores GV number in user profile

**Twilio Integration (Alternative):**
- Admin purchases Twilio number via CRM interface
- Number assigned to VA user account
- All calls route through Twilio
- Call logs sync automatically

#### 2.2 Click-to-Dial Interface

**UI Flow:**
1. VA clicks phone number in lead record
2. Modal appears with call options:
   ```
   Call (555) 123-4567
   
   [ ] Google Voice: (646) 555-1234
   [ ] Personal: (917) 555-9876
   [ ] Twilio: (646) 555-9999
   
   [Call Now]  [Cancel]
   ```
3. If Google Voice selected:
   - Browser opens `tel:+15551234567` URI
   - Phone app dials on mobile
   - Desktop users get instructions to use GV app

4. If Twilio selected:
   - API call: `POST /api/calls/initiate`
   - Twilio dials VA's phone
   - When VA answers, Twilio connects to lead
   - Call in progress

**API Endpoint:**
```javascript
// POST /api/calls/initiate
async function initiateCall(req, res) {
  const { leadId, toNumber, fromNumber, provider } = req.body;
  
  if (provider === 'twilio') {
    const call = await twilioClient.calls.create({
      from: fromNumber,
      to: toNumber,
      url: `${process.env.API_URL}/webhooks/twilio/voice`,
      statusCallback: `${process.env.API_URL}/webhooks/twilio/status`,
    });
    
    // Create activity record
    await db.activities.create({
      lead_id: leadId,
      activity_type: 'call',
      created_by_id: req.user.id,
      phone_number_used: fromNumber,
    });
    
    return res.json({ callSid: call.sid });
  }
  
  // For GV, just log the attempt
  await db.activities.create({
    lead_id: leadId,
    activity_type: 'call',
    created_by_id: req.user.id,
    phone_number_used: fromNumber,
    notes: 'Call initiated via Google Voice',
  });
  
  res.json({ success: true });
}
```

#### 2.3 Call Logging & Recording

**Automatic Call Activity Creation:**
- Call start time
- Call duration
- Phone numbers (from/to)
- Outcome dropdown (connected/VM/no answer/DNC)
- Notes field (VA fills during/after call)
- Recording URL (if Twilio)

**Call Recording with Twilio:**
```javascript
// Twilio webhook: /webhooks/twilio/voice
app.post('/webhooks/twilio/voice', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Record the call
  twiml.record({
    recordingStatusCallback: `${process.env.API_URL}/webhooks/twilio/recording`,
    transcribe: true,
    transcribeCallback: `${process.env.API_URL}/webhooks/twilio/transcription`,
  });
  
  res.type('text/xml');
  res.send(twiml.toString());
});

// Recording complete webhook
app.post('/webhooks/twilio/recording', async (req, res) => {
  const { CallSid, RecordingUrl, RecordingDuration } = req.body;
  
  // Find activity by call SID
  const activity = await db.activities.findOne({
    where: { 
      notes: { $ilike: `%${CallSid}%` } 
    }
  });
  
  // Update with recording URL
  await db.activities.update(activity.id, {
    call_recording_url: RecordingUrl,
    call_duration_seconds: parseInt(RecordingDuration),
  });
  
  res.sendStatus(200);
});
```

**Call Transcription:**
```javascript
app.post('/webhooks/twilio/transcription', async (req, res) => {
  const { CallSid, TranscriptionText } = req.body;
  
  const activity = await db.activities.findOne({
    where: { notes: { $ilike: `%${CallSid}%` } }
  });
  
  await db.activities.update(activity.id, {
    call_transcript: TranscriptionText,
  });
  
  res.sendStatus(200);
});
```

#### 2.4 SMS Integration

**Send SMS from CRM:**
```javascript
// POST /api/sms/send
async function sendSMS(req, res) {
  const { leadId, message, fromNumber } = req.body;
  const lead = await db.leads.findById(leadId);
  
  const sms = await twilioClient.messages.create({
    from: fromNumber,
    to: lead.phone,
    body: message,
    statusCallback: `${process.env.API_URL}/webhooks/twilio/sms-status`,
  });
  
  // Log activity
  await db.activities.create({
    lead_id: leadId,
    activity_type: 'sms',
    notes: message,
    created_by_id: req.user.id,
  });
  
  res.json({ messageSid: sms.sid });
}
```

**SMS Templates:**
```javascript
const smsTemplates = {
  initial_contact: "Hi {{first_name}}, this is {{va_name}} from NWS Media. I tried calling about improving your online presence. Got a minute to chat?",
  
  callback_reminder: "Hi {{first_name}}, following up on our call. Here's the link to schedule: {{calendly_link}}",
  
  payment_reminder: "Hi {{contact_name}}, friendly reminder that your ${{amount}} payment is due tomorrow. Pay here: {{payment_link}}",
};
```

### Module 3: Deal Pipeline & Closer Tools

#### 3.1 Deal Creation from Qualified Lead

**Qualification Flow:**
1. VA marks lead as "Qualified" in their dashboard
2. Qualification form appears:
   ```
   Assign to Closer: [Dropdown of active closers]
   Pain Point: [Text field]
   Budget Range: $[min] - $[max]
   Timeline: [Dropdown: ASAP / 1-3 months / 3-6 months]
   Decision Maker: [Text field]
   Handoff Notes: [Text area]
   ```
3. VA submits → Deal created
4. Lead stage changes to "converted"
5. Closer receives notification (email + Slack)

**API Implementation:**
```javascript
// POST /api/deals/create-from-lead
async function createDealFromLead(req, res) {
  const { 
    leadId, 
    assignedCloserId, 
    painPoint, 
    budgetMin, 
    budgetMax, 
    timeline,
    handoffNotes 
  } = req.body;
  
  const lead = await db.leads.findById(leadId);
  
  // Create deal
  const deal = await db.deals.create({
    lead_id: leadId,
    assigned_closer_id: assignedCloserId,
    originating_va_id: req.user.id,
    company_name: lead.company_name,
    contact_name: `${lead.first_name} ${lead.last_name}`,
    contact_email: lead.email,
    contact_phone: lead.phone,
    pain_point: painPoint,
    budget_range_min: budgetMin,
    budget_range_max: budgetMax,
    timeline: timeline,
    stage: 'discovery',
  });
  
  // Update lead
  await db.leads.update(leadId, {
    stage: 'converted',
    assigned_closer_id: assignedCloserId,
    converted_to_deal_at: new Date(),
  });
  
  // Create handoff activity
  await db.activities.create({
    lead_id: leadId,
    deal_id: deal.id,
    activity_type: 'handoff',
    notes: handoffNotes,
    created_by_id: req.user.id,
  });
  
  // Notify closer
  await sendNotification({
    userId: assignedCloserId,
    type: 'new_qualified_lead',
    title: 'New Qualified Lead',
    message: `${lead.company_name} qualified by ${req.user.first_name}`,
    link: `/deals/${deal.id}`,
  });
  
  res.json({ deal });
}
```

#### 3.2 Proposal Builder

**Template System:**
```javascript
// Proposal templates stored in database
const proposalTemplates = [
  {
    id: "template_web_design_basic",
    name: "Web Design - Basic Package",
    services: [
      { name: "5-Page Responsive Website", price: 3500 },
      { name: "Mobile Optimization", price: 500 },
      { name: "Basic SEO Setup", price: 500 },
      { name: "Contact Form Integration", price: 200 },
    ],
    total: 4700,
    timeline: "4-6 weeks",
  },
  {
    id: "template_web_design_premium",
    name: "Web Design - Premium Package",
    services: [
      { name: "10-Page Custom Website", price: 7000 },
      { name: "E-commerce Integration", price: 2000 },
      { name: "Advanced SEO", price: 1500 },
      { name: "Blog Setup", price: 500 },
      { name: "Analytics Dashboard", price: 500 },
    ],
    total: 11500,
    timeline: "6-8 weeks",
  },
];
```

**Proposal Generation:**
1. Closer selects template or builds custom
2. Auto-populates client info from deal
3. Adjusts line items, pricing, timeline
4. Adds custom sections (case studies, testimonials)
5. Generates PDF or interactive web page
6. Sends via email with tracking

**PandaDoc Integration:**
```javascript
// Generate proposal with PandaDoc
async function generateProposal(dealId, templateId) {
  const deal = await db.deals.findById(dealId);
  
  const proposal = await pandadocClient.documents.create({
    name: `${deal.company_name} - Website Proposal`,
    template_uuid: templateId,
    recipients: [
      {
        email: deal.contact_email,
        first_name: deal.contact_name.split(' ')[0],
        last_name: deal.contact_name.split(' ')[1],
        role: 'Client',
      },
    ],
    tokens: [
      { name: 'company_name', value: deal.company_name },
      { name: 'total_price', value: deal.estimated_value },
      { name: 'timeline', value: '6-8 weeks' },
    ],
  });
  
  // Update deal
  await db.deals.update(dealId, {
    proposal_sent_at: new Date(),
    proposal_url: proposal.share_link,
  });
  
  return proposal;
}
```

**Proposal Tracking:**
- Proposal viewed webhook from PandaDoc
- Track time spent viewing
- Track sections viewed
- Alert closer when viewed

#### 3.3 Contract Management

**E-Signature Flow:**
1. Closer sends contract via DocuSign/PandaDoc
2. Client receives email with signing link
3. Client signs electronically
4. Webhook fires: `contract.signed`
5. System auto-triggers:
   - Generate invoice
   - Create payment link
   - Send deposit request email
   - Update deal stage to "awaiting_deposit"

**Contract Signed Webhook:**
```javascript
app.post('/webhooks/docusign/signed', async (req, res) => {
  const { envelopeId, documentId, status } = req.body;
  
  if (status !== 'completed') {
    return res.sendStatus(200);
  }
  
  // Find deal by envelope ID
  const deal = await db.deals.findOne({
    where: { contract_url: { $ilike: `%${envelopeId}%` } }
  });
  
  // Update deal
  await db.deals.update(deal.id, {
    contract_signed_at: new Date(),
    stage: 'awaiting_deposit',
  });
  
  // Generate invoice
  const invoice = await generateInvoice(deal.id, 'deposit');
  
  // Create payment link
  const paymentLink = await createPaymentLink({
    dealId: deal.id,
    amount: deal.estimated_value * 0.5, // 50% deposit
    description: `50% deposit for ${deal.company_name} project`,
    paymentType: 'deposit',
    processor: 'stripe',
  });
  
  // Send deposit request email
  await sendEmail({
    to: deal.contact_email,
    template: 'deposit_request',
    data: {
      company_name: deal.company_name,
      amount: deal.estimated_value * 0.5,
      payment_link: paymentLink.url,
    },
  });
  
  res.sendStatus(200);
});
```

### Module 4: Payment Processing & POS

#### 4.1 Payment Link Generation

**Payment Link Builder UI:**
```javascript
// React component structure
function PaymentLinkBuilder({ dealId }) {
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState('deposit');
  const [processor, setProcessor] = useState('stripe');
  const [dueDate, setDueDate] = useState('');
  
  async function generateLink() {
    const response = await fetch('/api/payment-links/create', {
      method: 'POST',
      body: JSON.stringify({
        dealId,
        amount,
        paymentType,
        processor,
        dueDate,
        description: `${paymentType} payment for project`,
      }),
    });
    
    const { paymentLink } = await response.json();
    
    // Show link with copy button
    alert(`Payment link created: ${paymentLink.url}`);
  }
  
  return (
    <div className="payment-link-builder">
      <h3>Create Payment Link</h3>
      
      <label>Payment Type:</label>
      <select value={paymentType} onChange={e => setPaymentType(e.target.value)}>
        <option value="deposit">Deposit (50%)</option>
        <option value="final">Final Payment</option>
        <option value="milestone">Milestone Payment</option>
        <option value="addon">Addon/Upsell</option>
      </select>
      
      <label>Amount:</label>
      <input 
        type="number" 
        value={amount} 
        onChange={e => setAmount(e.target.value)}
        placeholder="5000.00"
      />
      
      <label>Processor:</label>
      <select value={processor} onChange={e => setProcessor(e.target.value)}>
        <option value="stripe">Stripe</option>
        <option value="square">Square</option>
        <option value="paypal">PayPal</option>
      </select>
      
      <label>Due Date:</label>
      <input 
        type="date" 
        value={dueDate} 
        onChange={e => setDueDate(e.target.value)}
      />
      
      <button onClick={generateLink}>Generate Link</button>
    </div>
  );
}
```

**Backend Payment Link Creation:**
```javascript
// POST /api/payment-links/create
async function createPaymentLink(req, res) {
  const { 
    dealId, 
    amount, 
    paymentType, 
    processor, 
    dueDate, 
    description 
  } = req.body;
  
  // Generate unique slug
  const slug = `${dealId.slice(0, 8)}-${Date.now()}`;
  
  // Create payment intent in processor
  let processorPaymentId;
  
  if (processor === 'stripe') {
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      description: description,
      metadata: {
        deal_id: dealId,
        payment_type: paymentType,
      },
    });
    processorPaymentId = paymentIntent.id;
  }
  
  // Save to database
  const paymentLink = await db.payment_links.create({
    deal_id: dealId,
    slug: slug,
    payment_type: paymentType,
    amount: amount,
    description: description,
    processor: processor,
    stripe_payment_intent_id: processorPaymentId,
    payment_methods_enabled: ['card', 'ach'],
    due_date: dueDate,
    send_reminders: true,
    created_by_id: req.user.id,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });
  
  const url = `https://pay.nwsmedia.com/${slug}`;
  
  res.json({ 
    paymentLink: {
      id: paymentLink.id,
      url: url,
      amount: amount,
      dueDate: dueDate,
    }
  });
}
```

#### 4.2 Payment Page Implementation

**Frontend (React):**
```javascript
// pages/pay/[slug].js
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function PaymentPage({ paymentLink }) {
  return (
    <div className="payment-page">
      <div className="header">
        <img src="/nws-logo.png" alt="NWS Media" />
        <h1>Invoice #{paymentLink.invoice_number}</h1>
      </div>
      
      <div className="details">
        <h2>{paymentLink.company_name}</h2>
        <p>{paymentLink.description}</p>
        <div className="amount">
          <span>Amount Due:</span>
          <span className="price">${paymentLink.amount.toFixed(2)}</span>
        </div>
        <div className="due-date">
          <span>Due Date:</span>
          <span>{new Date(paymentLink.due_date).toLocaleDateString()}</span>
        </div>
      </div>
      
      <Elements stripe={stripePromise}>
        <CheckoutForm paymentLink={paymentLink} />
      </Elements>
      
      <div className="footer">
        <p>🔒 Secure payment via Stripe</p>
        <p>Questions? Contact {paymentLink.closer_name} at {paymentLink.closer_email}</p>
      </div>
    </div>
  );
}

function CheckoutForm({ paymentLink }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  async function handleSubmit(e) {
    e.preventDefault();
    setProcessing(true);
    
    // Create payment method
    const { error: methodError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: elements.getElement(CardElement),
    });
    
    if (methodError) {
      setError(methodError.message);
      setProcessing(false);
      return;
    }
    
    // Confirm payment
    const response = await fetch('/api/payment-links/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentLinkId: paymentLink.id,
        paymentMethodId: paymentMethod.id,
      }),
    });
    
    const { clientSecret } = await response.json();
    
    const { error: confirmError } = await stripe.confirmCardPayment(clientSecret);
    
    if (confirmError) {
      setError(confirmError.message);
      setProcessing(false);
    } else {
      // Success! Redirect to success page
      window.location.href = `/pay/${paymentLink.slug}/success`;
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <label>Card Details</label>
      <CardElement />
      
      {error && <div className="error">{error}</div>}
      
      <button type="submit" disabled={!stripe || processing}>
        {processing ? 'Processing...' : `Pay $${paymentLink.amount.toFixed(2)}`}
      </button>
    </form>
  );
}

// Server-side props
export async function getServerSideProps({ params }) {
  const { slug } = params;
  
  const paymentLink = await db.payment_links.findOne({
    where: { slug },
    include: ['deal', 'deal.closer'],
  });
  
  if (!paymentLink || paymentLink.status !== 'pending') {
    return { notFound: true };
  }
  
  return {
    props: {
      paymentLink: {
        id: paymentLink.id,
        slug: paymentLink.slug,
        company_name: paymentLink.deal.company_name,
        amount: paymentLink.amount,
        description: paymentLink.description,
        due_date: paymentLink.due_date,
        invoice_number: paymentLink.invoice_number,
        closer_name: paymentLink.deal.closer.first_name,
        closer_email: paymentLink.deal.closer.email,
      },
    },
  };
}
```

#### 4.3 Webhook Handling (Critical)

**Stripe Webhook:**
```javascript
// POST /webhooks/stripe
app.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.sendStatus(400);
  }
  
  // Handle event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
      
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
      
    case 'charge.refunded':
      await handleRefund(event.data.object);
      break;
  }
  
  res.sendStatus(200);
});

async function handlePaymentSuccess(paymentIntent) {
  const { id, amount, charges, metadata } = paymentIntent;
  const dealId = metadata.deal_id;
  const paymentType = metadata.payment_type;
  
  // Find payment link
  const paymentLink = await db.payment_links.findOne({
    where: { stripe_payment_intent_id: id }
  });
  
  if (!paymentLink) {
    console.error('Payment link not found for payment intent:', id);
    return;
  }
  
  // Update payment link
  await db.payment_links.update(paymentLink.id, {
    status: 'paid',
    paid_at: new Date(),
    paid_amount: amount / 100,
    transaction_id: charges.data[0].id,
    processor_fee: charges.data[0].fee / 100,
    payment_method_type: charges.data[0].payment_method_details.type,
    last_4_digits: charges.data[0].payment_method_details.card?.last4,
  });
  
  // Create transaction record
  await db.transactions.create({
    payment_link_id: paymentLink.id,
    transaction_type: 'payment',
    amount: amount / 100,
    processor: 'stripe',
    processor_transaction_id: charges.data[0].id,
    processor_fee: charges.data[0].fee / 100,
    net_amount: (amount - charges.data[0].fee) / 100,
    payment_method: charges.data[0].payment_method_details.type,
    status: 'completed',
    completed_at: new Date(),
  });
  
  // Update deal
  const deal = await db.deals.findById(paymentLink.deal_id);
  
  if (paymentType === 'deposit') {
    await db.deals.update(deal.id, {
      deposit_received_at: new Date(),
      stage: 'won',
    });
    
    // Convert deal to client
    await convertDealToClient(deal.id);
    
    // Calculate VA commission
    await calculateVACommission(deal.id);
  } else if (paymentType === 'final') {
    await db.deals.update(deal.id, {
      final_payment_received_at: new Date(),
    });
    
    // Calculate Closer commission
    await calculateCloserCommission(deal.id);
  }
  
  // Send receipt email
  await sendPaymentReceipt(paymentLink.id);
  
  // Notify closer
  await sendNotification({
    userId: deal.assigned_closer_id,
    type: 'payment_received',
    title: 'Payment Received',
    message: `$${(amount / 100).toFixed(2)} payment received from ${deal.company_name}`,
  });
}
```

**Square Webhook:**
```javascript
app.post('/webhooks/square', async (req, res) => {
  const { type, data } = req.body;
  
  if (type === 'payment.created') {
    const payment = data.object.payment;
    
    // Find payment link by Square payment ID
    const paymentLink = await db.payment_links.findOne({
      where: { square_payment_id: payment.id }
    });
    
    if (payment.status === 'COMPLETED') {
      await handleSquarePaymentSuccess(payment, paymentLink);
    }
  }
  
  res.sendStatus(200);
});
```

#### 4.4 Commission Calculation

**VA Commission (on Deposit):**
```javascript
async function calculateVACommission(dealId) {
  const deal = await db.deals.findById(dealId);
  
  if (!deal.originating_va_id) {
    console.error('No originating VA for deal:', dealId);
    return;
  }
  
  // Commission rules: 10% or $500, whichever is higher
  const baseCommission = deal.actual_value * 0.10;
  const commissionAmount = Math.max(baseCommission, 500);
  
  // Create commission record
  await db.commissions.create({
    user_id: deal.originating_va_id,
    deal_id: dealId,
    commission_type: 'va_deposit',
    deal_value: deal.actual_value,
    commission_percentage: 10.00,
    commission_amount: commissionAmount,
    status: 'pending',
    trigger_event: 'deposit_received',
    triggered_at: new Date(),
    rule_applied: 'VA Standard: 10% or $500 minimum',
  });
  
  // Notify VA
  const va = await db.users.findById(deal.originating_va_id);
  await sendNotification({
    userId: va.id,
    type: 'commission_earned',
    title: 'Commission Earned!',
    message: `You earned $${commissionAmount.toFixed(2)} from ${deal.company_name}`,
  });
}
```

**Closer Commission (on Final Payment):**
```javascript
async function calculateCloserCommission(dealId) {
  const deal = await db.deals.findById(dealId);
  
  // Tiered commission structure
  let percentage;
  if (deal.actual_value <= 10000) {
    percentage = 15.00;
  } else if (deal.actual_value <= 25000) {
    percentage = 18.00;
  } else {
    percentage = 20.00;
  }
  
  const commissionAmount = deal.actual_value * (percentage / 100);
  
  await db.commissions.create({
    user_id: deal.assigned_closer_id,
    deal_id: dealId,
    commission_type: 'closer_final',
    deal_value: deal.actual_value,
    commission_percentage: percentage,
    commission_amount: commissionAmount,
    status: 'pending',
    trigger_event: 'final_payment_received',
    triggered_at: new Date(),
    rule_applied: `Closer Tiered: ${percentage}%`,
  });
}
```

### Module 5: Client Portal

#### 5.1 Portal Authentication

**Magic Link Login:**
```javascript
// POST /api/portal/auth/request-link
async function requestMagicLink(req, res) {
  const { email } = req.body;
  
  // Find client by email
  const client = await db.clients.findOne({
    where: { contact_email: email }
  });
  
  if (!client) {
    // Don't reveal if email exists
    return res.json({ message: 'If that email exists, we sent you a login link.' });
  }
  
  // Generate magic token
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  // Store token
  await db.portal_tokens.create({
    client_id: client.id,
    token: token,
    expires_at: expires,
  });
  
  // Send email
  const magicLink = `https://nwsmedia.com/portal/auth/${token}`;
  await sendEmail({
    to: email,
    template: 'portal_magic_link',
    data: {
      magic_link: magicLink,
      company_name: client.company_name,
    },
  });
  
  res.json({ message: 'Check your email for the login link.' });
}

// GET /api/portal/auth/:token
async function verifyMagicLink(req, res) {
  const { token } = req.params;
  
  const portalToken = await db.portal_tokens.findOne({
    where: { 
      token,
      expires_at: { $gt: new Date() },
    },
    include: ['client'],
  });
  
  if (!portalToken) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Create session
  const sessionToken = jwt.sign(
    { 
      clientId: portalToken.client_id,
      role: 'client' 
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  // Delete used token
  await db.portal_tokens.delete(portalToken.id);
  
  // Update last login
  await db.clients.update(portalToken.client_id, {
    portal_last_login_at: new Date(),
  });
  
  res.json({ 
    token: sessionToken,
    client: portalToken.client,
  });
}
```

#### 5.2 Portal Dashboard

**Client Dashboard UI:**
```javascript
function ClientPortalDashboard({ client, projects }) {
  return (
    <div className="portal-dashboard">
      <header>
        <h1>Welcome back, {client.contact_name}</h1>
        <p>{client.company_name}</p>
      </header>
      
      <div className="project-status">
        <h2>Your Project</h2>
        <div className="timeline">
          <TimelineStep 
            name="Kickoff" 
            completed={!!client.kickoff_date} 
          />
          <TimelineStep 
            name="Design" 
            completed={client.current_phase === 'design' || client.current_phase === 'development'} 
            active={client.current_phase === 'design'}
          />
          <TimelineStep 
            name="Development" 
            completed={client.current_phase === 'launch'} 
            active={client.current_phase === 'development'}
          />
          <TimelineStep 
            name="Launch" 
            active={client.current_phase === 'launch'}
          />
        </div>
        
        <div className="progress-info">
          <p>Current Phase: <strong>{client.current_phase}</strong></p>
          <p>Expected Delivery: <strong>{new Date(client.expected_delivery_date).toLocaleDateString()}</strong></p>
          <p>Days Remaining: <strong>{calculateDaysRemaining(client.expected_delivery_date)}</strong></p>
        </div>
      </div>
      
      <div className="quick-actions">
        <button onClick={() => navigate('/portal/files')}>
          View Files
        </button>
        <button onClick={() => navigate('/portal/revisions')}>
          Request Revision
        </button>
        <button onClick={() => navigate('/portal/message')}>
          Message Team
        </button>
      </div>
      
      <div className="payment-center">
        <h3>Payment Information</h3>
        <p>Total Paid: ${client.total_paid.toFixed(2)}</p>
        <p>Balance Due: ${client.balance_due.toFixed(2)}</p>
        
        {client.balance_due > 0 && (
          <button onClick={() => navigate('/portal/pay')}>
            Make Payment
          </button>
        )}
      </div>
      
      <div className="referral-section">
        <h3>Refer a Business, Get $500 Off</h3>
        <p>Know someone who needs our services?</p>
        <button onClick={() => navigate('/portal/refer')}>
          Submit Referral
        </button>
      </div>
    </div>
  );
}
```

#### 5.3 File Sharing

**File Upload (Client → NWS):**
```javascript
// POST /api/portal/files/upload
async function uploadClientFile(req, res) {
  const file = req.files[0];
  const { clientId, description } = req.body;
  
  // Upload to S3
  const s3Key = `clients/${clientId}/uploads/${Date.now()}-${file.originalname}`;
  await s3Client.putObject({
    Bucket: process.env.S3_BUCKET,
    Key: s3Key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });
  
  // Save to database
  const fileRecord = await db.files.create({
    client_id: clientId,
    filename: file.originalname,
    original_filename: file.originalname,
    file_type: 'client_upload',
    mime_type: file.mimetype,
    file_size: file.size,
    storage_provider: 's3',
    storage_path: s3Key,
    storage_url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${s3Key}`,
    visibility: 'private',
    description: description,
  });
  
  res.json({ file: fileRecord });
}
```

**File Download (NWS → Client):**
```javascript
// GET /api/portal/files/:fileId/download
async function downloadFile(req, res) {
  const { fileId } = req.params;
  const clientId = req.user.clientId; // From JWT
  
  const file = await db.files.findById(fileId);
  
  // Check permission
  if (file.client_id !== clientId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  // Generate signed URL (S3)
  const signedUrl = await s3Client.getSignedUrl('getObject', {
    Bucket: process.env.S3_BUCKET,
    Key: file.storage_path,
    Expires: 3600, // 1 hour
  });
  
  res.json({ downloadUrl: signedUrl });
}
```

#### 5.4 Revision Requests

**Revision Request Form:**
```javascript
function RevisionRequestForm({ clientId, projectId }) {
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  
  async function submitRevision() {
    const formData = new FormData();
    formData.append('clientId', clientId);
    formData.append('projectId', projectId);
    formData.append('description', description);
    screenshots.forEach(file => formData.append('screenshots', file));
    
    await fetch('/api/portal/revisions/submit', {
      method: 'POST',
      body: formData,
    });
    
    alert('Revision request submitted!');
  }
  
  return (
    <div className="revision-form">
      <h2>Request Revision</h2>
      <p>You have {client.revision_limit - client.revisions_used} revisions remaining</p>
      
      <label>Describe what needs to be changed:</label>
      <textarea 
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={6}
      />
      
      <label>Upload screenshots (optional):</label>
      <input 
        type="file" 
        multiple 
        accept="image/*"
        onChange={e => setScreenshots(Array.from(e.target.files))}
      />
      
      <button onClick={submitRevision}>Submit Revision</button>
    </div>
  );
}

// Backend
// POST /api/portal/revisions/submit
async function submitRevision(req, res) {
  const { clientId, projectId, description } = req.body;
  const screenshots = req.files;
  
  const client = await db.clients.findById(clientId);
  
  // Check revision limit
  if (client.revisions_used >= client.revision_limit) {
    return res.status(400).json({ 
      error: 'Revision limit reached. Additional revisions incur extra charges.' 
    });
  }
  
  // Create revision record
  const revision = await db.revisions.create({
    client_id: clientId,
    project_id: projectId,
    description: description,
    status: 'submitted',
  });
  
  // Upload screenshots
  for (const file of screenshots) {
    const s3Key = `revisions/${revision.id}/${file.originalname}`;
    await s3Client.putObject({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: file.buffer,
    });
    
    await db.files.create({
      client_id: clientId,
      file_type: 'revision_screenshot',
      filename: file.originalname,
      storage_path: s3Key,
    });
  }
  
  // Increment revision counter
  await db.clients.update(clientId, {
    revisions_used: client.revisions_used + 1,
  });
  
  // Notify ops lead
  await sendNotification({
    userId: client.assigned_ops_lead_id,
    type: 'revision_submitted',
    title: 'New Revision Request',
    message: `${client.company_name} submitted a revision request`,
  });
  
  res.json({ revision });
}
```

#### 5.5 Referral Submission

**Referral Form:**
```javascript
function ReferralForm({ clientId }) {
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  
  async function submitReferral() {
    await fetch('/api/portal/referrals/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        companyName,
        contactName,
        contactEmail,
        contactPhone,
        notes,
      }),
    });
    
    alert('Thank you! Your $500 credit will be applied if they become a client.');
  }
  
  return (
    <div className="referral-form">
      <h2>Refer a Business</h2>
      <p>Know someone who needs our services? Refer them and get $500 off your next project!</p>
      
      <input 
        placeholder="Company Name"
        value={companyName}
        onChange={e => setCompanyName(e.target.value)}
      />
      
      <input 
        placeholder="Contact Name"
        value={contactName}
        onChange={e => setContactName(e.target.value)}
      />
      
      <input 
        type="email"
        placeholder="Email"
        value={contactEmail}
        onChange={e => setContactEmail(e.target.value)}
      />
      
      <input 
        type="tel"
        placeholder="Phone"
        value={contactPhone}
        onChange={e => setContactPhone(e.target.value)}
      />
      
      <textarea 
        placeholder="Any additional notes..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />
      
      <button onClick={submitReferral}>Submit Referral</button>
    </div>
  );
}

// POST /api/portal/referrals/submit
async function submitReferral(req, res) {
  const { clientId, companyName, contactName, contactEmail, contactPhone, notes } = req.body;
  
  // Create referral
  const referral = await db.referrals.create({
    referred_by_client_id: clientId,
    company_name: companyName,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    notes: notes,
    status: 'submitted',
    reward_type: 'credit',
    reward_amount: 500,
  });
  
  // Create lead from referral
  const lead = await db.leads.create({
    first_name: contactName.split(' ')[0],
    last_name: contactName.split(' ')[1] || '',
    company_name: companyName,
    email: contactEmail,
    phone: contactPhone,
    source: 'referral',
    source_detail: `Referred by client #${clientId}`,
    stage: 'new',
    tags: ['REFERRAL'],
  });
  
  // Link referral to lead
  await db.referrals.update(referral.id, {
    lead_id: lead.id,
  });
  
  // Update client referral count
  await db.clients.increment(clientId, 'referrals_submitted', 1);
  
  // Notify sales team
  await sendSlackMessage({
    channel: '#sales',
    text: `🎉 New referral from ${client.company_name}: ${companyName}`,
  });
  
  res.json({ referral });
}
```

---

## API Documentation

### Authentication

**JWT-Based Auth:**
```
POST /api/auth/login
Body: { email, password }
Response: { token, user }

POST /api/auth/refresh
Headers: { Authorization: Bearer <token> }
Response: { token }

POST /api/auth/logout
Headers: { Authorization: Bearer <token> }
Response: { success: true }
```

### Leads Endpoints

```
GET /api/leads
Query: ?assigned_va_id={id}&stage={stage}&page={n}&limit={n}
Response: { leads: [], total, page, pages }

GET /api/leads/:id
Response: { lead, activities: [] }

POST /api/leads
Body: { first_name, last_name, company_name, email, phone, source }
Response: { lead }

PATCH /api/leads/:id
Body: { stage, next_followup_at, icp_score, ... }
Response: { lead }

DELETE /api/leads/:id
Response: { success: true }

POST /api/leads/:id/qualify
Body: { assigned_closer_id, pain_point, budget_min, budget_max, handoff_notes }
Response: { deal }
```

### Deals Endpoints

```
GET /api/deals
Query: ?assigned_closer_id={id}&stage={stage}&page={n}
Response: { deals: [], total }

GET /api/deals/:id
Response: { deal, activities: [], payment_links: [] }

PATCH /api/deals/:id
Body: { stage, estimated_value, proposal_url, contract_signed_at, ... }
Response: { deal }

POST /api/deals/:id/send-proposal
Body: { template_id, custom_pricing }
Response: { proposal_url }

POST /api/deals/:id/send-contract
Body: { template_id }
Response: { contract_url }
```

### Payment Links Endpoints

```
GET /api/payment-links
Query: ?deal_id={id}&status={status}
Response: { payment_links: [] }

POST /api/payment-links/create
Body: { deal_id, amount, payment_type, processor, due_date }
Response: { payment_link: { id, url, ... } }

GET /api/payment-links/:slug
Response: { payment_link, deal, client }

POST /api/payment-links/:id/confirm
Body: { payment_method_id }
Response: { client_secret }

POST /api/payment-links/:id/void
Response: { success: true }
```

### Commissions Endpoints

```
GET /api/commissions
Query: ?user_id={id}&status={status}&payout_date={date}
Response: { commissions: [], total_pending, total_paid }

PATCH /api/commissions/:id/approve
Response: { commission }

POST /api/commissions/payout
Body: { commission_ids: [], payout_date, payout_method }
Response: { payout_record }

GET /api/commissions/export
Query: ?user_id={id}&start_date={date}&end_date={date}
Response: CSV file
```

### Client Portal Endpoints

```
POST /api/portal/auth/request-link
Body: { email }
Response: { message }

GET /api/portal/auth/:token
Response: { token, client }

GET /api/portal/dashboard
Headers: { Authorization: Bearer <token> }
Response: { client, projects: [], files: [] }

POST /api/portal/files/upload
Body: FormData with files
Response: { files: [] }

POST /api/portal/revisions/submit
Body: { description, screenshots }
Response: { revision }

POST /api/portal/referrals/submit
Body: { company_name, contact_name, email, phone }
Response: { referral }
```

### Webhooks

```
POST /webhooks/stripe
Body: Stripe event object
Response: 200 OK

POST /webhooks/square
Body: Square event object
Response: 200 OK

POST /webhooks/paypal
Body: PayPal IPN data
Response: 200 OK

POST /webhooks/twilio/voice
Body: Twilio call event
Response: TwiML

POST /webhooks/twilio/sms-status
Body: SMS delivery status
Response: 200 OK

POST /webhooks/docusign/signed
Body: Envelope completion event
Response: 200 OK
```

---

## Integration Specifications

### Stripe Integration

**Setup:**
```bash
npm install stripe
```

**Configuration:**
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Webhook endpoint config
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
```

**Payment Intent Creation:**
```javascript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 5000 * 100, // $5000 in cents
  currency: 'usd',
  payment_method_types: ['card'],
  metadata: {
    deal_id: 'uuid-here',
    payment_type: 'deposit',
  },
});
```

**Webhook Verification:**
```javascript
const event = stripe.webhooks.constructEvent(
  req.body,
  req.headers['stripe-signature'],
  endpointSecret
);
```

### Twilio Integration

**Setup:**
```bash
npm install twilio
```

**Configuration:**
```javascript
const twilio = require('twilio');
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
```

**Make Call:**
```javascript
const call = await client.calls.create({
  from: '+16465551234',
  to: '+19175559876',
  url: 'https://api.nwsmedia.com/webhooks/twilio/voice',
  record: true,
  recordingStatusCallback: 'https://api.nwsmedia.com/webhooks/twilio/recording',
});
```

**Send SMS:**
```javascript
const message = await client.messages.create({
  from: '+16465551234',
  to: '+19175559876',
  body: 'Hi, this is Maru from NWS Media...',
});
```

### Clearbit Integration

**Setup:**
```bash
npm install clearbit
```

**Enrichment:**
```javascript
const clearbit = require('clearbit')(process.env.CLEARBIT_API_KEY);

const company = await clearbit.Company.find({ domain: 'example.com' });

// Returns:
{
  name: 'Example Corp',
  domain: 'example.com',
  employees: 50,
  industry: 'Software',
  estimatedAnnualRevenue: '5M',
  location: {
    city: 'New York',
    state: 'NY',
  },
}
```

### DocuSign Integration

**Setup:**
```bash
npm install docusign-esign
```

**Send Envelope:**
```javascript
const docusign = require('docusign-esign');
const apiClient = new docusign.ApiClient();

apiClient.setBasePath(process.env.DOCUSIGN_BASE_PATH);
apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);

const envelopeDefinition = {
  emailSubject: 'Please sign this contract',
  documents: [{
    documentBase64: base64PdfContent,
    name: 'Contract.pdf',
    fileExtension: 'pdf',
    documentId: '1',
  }],
  recipients: {
    signers: [{
      email: 'client@example.com',
      name: 'John Client',
      recipientId: '1',
      tabs: {
        signHereTabs: [{
          xPosition: '100',
          yPosition: '100',
          documentId: '1',
          pageNumber: '1',
        }],
      },
    }],
  },
  status: 'sent',
};

const envelopeApi = new docusign.EnvelopesApi(apiClient);
const result = await envelopeApi.createEnvelope(accountId, { envelopeDefinition });
```

---

## Security & Compliance

### Authentication Security

**Password Hashing:**
```javascript
const bcrypt = require('bcrypt');

// Hash on user creation
const passwordHash = await bcrypt.hash(plainPassword, 10);

// Verify on login
const valid = await bcrypt.compare(plainPassword, user.password_hash);
```

**JWT Configuration:**
```javascript
const jwt = require('jsonwebtoken');

// Token generation
const token = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

// Token verification middleware
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.sendStatus(401);
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
```

### PCI Compliance

**Critical Rules:**
1. **NEVER store raw card numbers in database**
2. **NEVER log card numbers in application logs**
3. **Use Stripe/Square hosted forms** for card capture
4. **Only store last 4 digits** for display purposes
5. **Use Stripe Elements** or Square Web SDK (handles PCI compliance)

**Implementation:**
```javascript
// ✅ CORRECT: Use Stripe Elements
<Elements stripe={stripePromise}>
  <CardElement />
</Elements>

// ❌ WRONG: Custom card input
<input name="card_number" />  // NEVER DO THIS
```

### Data Encryption

**At Rest:**
- PostgreSQL with full-disk encryption
- S3 buckets with AES-256 encryption
- Encrypted database backups

**In Transit:**
- HTTPS/TLS 1.3 for all API requests
- WSS for WebSocket connections
- Signed URLs for S3 file downloads

### GDPR Compliance

**Data Export:**
```javascript
// GET /api/gdpr/export
async function exportUserData(req, res) {
  const userId = req.user.id;
  
  const data = {
    user: await db.users.findById(userId),
    leads: await db.leads.find({ assigned_va_id: userId }),
    activities: await db.activities.find({ created_by_id: userId }),
    commissions: await db.commissions.find({ user_id: userId }),
  };
  
  res.json(data);
}
```

**Data Deletion:**
```javascript
// DELETE /api/gdpr/delete-account
async function deleteAccount(req, res) {
  const userId = req.user.id;
  
  // Anonymize user data
  await db.users.update(userId, {
    email: `deleted-${userId}@nwsmedia.com`,
    first_name: 'Deleted',
    last_name: 'User',
    phone: null,
    google_voice_number: null,
    status: 'deleted',
  });
  
  // Delete activities (cascade deletes handled by DB)
  await db.activities.deleteMany({ created_by_id: userId });
  
  res.json({ success: true });
}
```

---

## Build Phases & Timeline

### Phase 1: MVP Foundation (Weeks 1-4)

**Week 1-2: Core Infrastructure**
- [ ] Database schema setup (PostgreSQL)
- [ ] API server skeleton (Express + TypeScript)
- [ ] Authentication system (JWT)
- [ ] User management (CRUD)
- [ ] Basic frontend shell (React + Tailwind)

**Week 3-4: Lead Management**
- [ ] Lead CRUD operations
- [ ] ICP scoring algorithm
- [ ] Lead assignment rules
- [ ] VA dashboard UI
- [ ] Activity logging
- [ ] Manual lead entry form

**Deliverable:** VAs can log leads, see assigned queue, make basic notes

---

### Phase 2: Sales Pipeline (Weeks 5-8)

**Week 5-6: Deal Management**
- [ ] Deal creation from qualified leads
- [ ] Closer dashboard UI
- [ ] Deal pipeline (Kanban view)
- [ ] Stage transitions
- [ ] Deal detail page

**Week 7-8: Payment System**
- [ ] Stripe integration
- [ ] Payment link generation
- [ ] Payment page (pay.nwsmedia.com)
- [ ] Webhook handling
- [ ] Invoice generation
- [ ] Transaction logging

**Deliverable:** Closers can move deals through pipeline, send payment links, track deposits

---

### Phase 3: Commission Engine (Weeks 9-10)

**Week 9:**
- [ ] Commission calculation logic
- [ ] Auto-trigger on deposit/final payment
- [ ] Commission dashboard (VA & Closer view)
- [ ] Commission approval workflow

**Week 10:**
- [ ] Payout CSV export
- [ ] Commission history reports
- [ ] Admin commission management UI

**Deliverable:** Automated commission tracking with zero manual calculations

---

### Phase 4: Operations & Client Management (Weeks 11-14)

**Week 11-12: Client Conversion**
- [ ] Deal → Client conversion on deposit
- [ ] Project creation workflow
- [ ] Ops dashboard UI
- [ ] File upload/download
- [ ] Project status tracking

**Week 13-14: Client Portal**
- [ ] Magic link authentication
- [ ] Portal dashboard UI
- [ ] File sharing interface
- [ ] Revision request form
- [ ] Payment center (portal view)

**Deliverable:** Clients can self-service via portal, ops team manages projects

---

### Phase 5: Automation & Polish (Weeks 15-18)

**Week 15-16: Sequences**
- [ ] Sequence engine (database + processor)
- [ ] Email template system
- [ ] Payment reminder automation
- [ ] Nurture sequence setup
- [ ] Sequence enrollment triggers

**Week 17-18: Referrals & Analytics**
- [ ] Referral submission (portal)
- [ ] Referral tracking
- [ ] Analytics dashboards
- [ ] Pipeline reports
- [ ] Revenue forecasting

**Deliverable:** Full automation, self-generating referrals, complete analytics

---

### Phase 6: Scale Features (Weeks 19-24)

**Week 19-20: Advanced Integrations**
- [ ] Square payment processor
- [ ] PayPal integration
- [ ] DocuSign e-signature
- [ ] Google Drive sync
- [ ] QuickBooks export

**Week 21-22: Mobile & API**
- [ ] Mobile-responsive polish
- [ ] VA mobile app (React Native)
- [ ] Public API documentation
- [ ] Zapier integration
- [ ] Webhook outbound system

**Week 23-24: AI & Intelligence**
- [ ] Lead scoring ML model
- [ ] Call sentiment analysis
- [ ] Deal close probability AI
- [ ] Smart follow-up suggestions
- [ ] Churn prediction

**Deliverable:** Enterprise-grade platform ready for 50+ reps

---

## Deployment Architecture

### Production Environment

**Frontend (Vercel):**
- React SPA deployed to Vercel
- Automatic deployments from `main` branch
- Custom domain: `app.nwsmedia.com`
- Edge caching for static assets
- CDN: Vercel Edge Network

**Backend (Railway):**
- Express API server
- Auto-scaling based on CPU/memory
- Custom domain: `api.nwsmedia.com`
- Environment variables via Railway UI
- Health check endpoint: `/health`

**Database (Supabase or Neon):**
- PostgreSQL 15
- Automated daily backups
- Point-in-time recovery
- Connection pooling (PgBouncer)
- Read replicas for analytics queries

**File Storage (AWS S3 or Cloudflare R2):**
- Bucket: `nws-crm-files`
- Lifecycle policy: Archive after 1 year
- CORS configuration for uploads
- Signed URLs for downloads
- CDN: CloudFront or Cloudflare

**Redis (Upstash):**
- Session storage
- Rate limiting
- Background job queue (Bull)
- Cache layer for expensive queries

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/nwscrm

# Auth
JWT_SECRET=random-256-bit-secret
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+16465551234

# Email (SendGrid)
SENDGRID_API_KEY=SG...
FROM_EMAIL=noreply@nwsmedia.com

# File Storage
AWS_ACCESS_KEY_ID=AK...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=nws-crm-files
S3_REGION=us-east-1

# Clearbit
CLEARBIT_API_KEY=sk_...

# DocuSign
DOCUSIGN_INTEGRATION_KEY=...
DOCUSIGN_USER_ID=...
DOCUSIGN_BASE_PATH=https://...

# App URLs
FRONTEND_URL=https://app.nwsmedia.com
API_URL=https://api.nwsmedia.com
PAYMENT_PAGE_URL=https://pay.nwsmedia.com

# Redis
REDIS_URL=redis://default:pass@host:6379
```

### CI/CD Pipeline

**GitHub Actions:**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: npm test
      
  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
  
  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Railway
        run: railway up
```

---

## Testing Strategy

### Unit Tests

**Tools:** Jest + Supertest

**Coverage Targets:**
- Business logic: 90%+
- API endpoints: 80%+
- Database queries: 70%+

**Example Tests:**
```javascript
// tests/commission.test.js
describe('Commission Calculation', () => {
  test('VA commission is 10% or $500, whichever higher', () => {
    expect(calculateVACommission(3000)).toBe(500);  // $300 < $500
    expect(calculateVACommission(8000)).toBe(800);  // $800 > $500
  });
  
  test('Closer commission is tiered correctly', () => {
    expect(calculateCloserCommission(5000)).toBe(750);   // 15%
    expect(calculateCloserCommission(15000)).toBe(2700); // 18%
    expect(calculateCloserCommission(30000)).toBe(6000); // 20%
  });
});

// tests/api/leads.test.js
describe('POST /api/leads', () => {
  test('creates lead with valid data', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Acme Corp',
        email: 'john@acme.com',
        phone: '555-1234',
        source: 'cold_call',
      })
      .expect(201);
    
    expect(res.body.lead).toHaveProperty('id');
    expect(res.body.lead.icp_score).toBeGreaterThan(0);
  });
  
  test('rejects invalid email', async () => {
    await request(app)
      .post('/api/leads')
      .send({ email: 'not-an-email' })
      .expect(400);
  });
});
```

### Integration Tests

**Webhook Testing:**
```javascript
// tests/webhooks/stripe.test.js
describe('Stripe Webhook', () => {
  test('handles payment_intent.succeeded', async () => {
    const event = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          amount: 500000,
          metadata: { deal_id: 'deal-uuid' },
        },
      },
    };
    
    await request(app)
      .post('/webhooks/stripe')
      .set('stripe-signature', generateTestSignature(event))
      .send(event)
      .expect(200);
    
    // Verify database updated
    const paymentLink = await db.payment_links.findOne({
      where: { stripe_payment_intent_id: 'pi_test_123' }
    });
    expect(paymentLink.status).toBe('paid');
    
    // Verify commission created
    const commissions = await db.commissions.find({
      where: { deal_id: 'deal-uuid' }
    });
    expect(commissions).toHaveLength(1);
  });
});
```

### End-to-End Tests

**Tools:** Playwright

**Critical User Flows:**
1. VA creates lead → qualifies → hands to closer
2. Closer sends proposal → contract → payment link
3. Client pays → commission auto-calculated
4. Client logs into portal → submits revision

```javascript
// e2e/full-deal-cycle.spec.ts
test('complete deal cycle from lead to payment', async ({ page }) => {
  // Login as VA
  await page.goto('https://app.nwsmedia.com/login');
  await page.fill('[name=email]', 'va@test.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');
  
  // Create lead
  await page.goto('/va/leads/new');
  await page.fill('[name=company_name]', 'Test Corp');
  await page.fill('[name=email]', 'test@corp.com');
  await page.click('button[type=submit]');
  
  // Qualify lead
  await page.click('button:has-text("Qualify")');
  await page.selectOption('[name=assigned_closer_id]', 'closer-uuid');
  await page.fill('[name=pain_point]', 'Outdated website');
  await page.click('button:has-text("Submit")');
  
  // Logout, login as Closer
  await page.click('[aria-label="Logout"]');
  await page.fill('[name=email]', 'closer@test.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');
  
  // Move deal to "Proposal Sent"
  await page.goto('/closer/deals');
  await page.click('text=Test Corp');
  await page.click('button:has-text("Send Proposal")');
  await page.selectOption('[name=template]', 'web_design_basic');
  await page.click('button:has-text("Send")');
  
  // ... continue flow through payment
});
```

---

## Maintenance & Operations

### Monitoring

**Services:**
- **Sentry:** Error tracking & performance monitoring
- **LogRocket:** Session replay for debugging
- **Datadog:** Infrastructure metrics
- **Better Stack:** Uptime monitoring

**Alerts:**
```javascript
// Critical alerts (PagerDuty)
- Database connection failures
- Payment webhook failures
- API response time > 2s (p95)
- Error rate > 1%

// Warning alerts (Slack)
- Disk usage > 80%
- Memory usage > 85%
- Queue backlog > 100 jobs
- Failed background jobs
```

### Backup Strategy

**Database:**
- Automated daily backups (Supabase/Neon)
- Retain 30 days of backups
- Weekly full backup to S3
- Point-in-time recovery up to 7 days

**Files:**
- S3 versioning enabled
- Lifecycle policy: Glacier after 1 year
- Cross-region replication (disaster recovery)

**Backup Script:**
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="/backups/$DATE"

# Dump database
pg_dump $DATABASE_URL > $BACKUP_DIR/db.sql

# Compress
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR

# Upload to S3
aws s3 cp $BACKUP_DIR.tar.gz s3://nws-crm-backups/

# Cleanup old backups (> 30 days)
find /backups -type d -mtime +30 -exec rm -rf {} \;
```

### Scaling Considerations

**Database:**
- Add read replicas for analytics queries
- Partition large tables (activities, audit_log) by date
- Implement database connection pooling (PgBouncer)
- Cache expensive queries in Redis

**API Server:**
- Horizontal scaling (multiple Railway instances)
- Load balancer (Railway handles this)
- Rate limiting per user/IP
- Background job processing (Bull queues)

**File Storage:**
- CDN for file downloads
- Separate buckets for uploads vs deliverables
- Lifecycle policies to archive old files

**Performance Targets:**
- API response time: p95 < 500ms
- Payment page load: < 2s
- Dashboard load: < 3s
- File upload: < 5s for 10MB

---

## Appendix: Key Formulas & Calculations

### ICP Score Calculation
```
Total Score (1-10) = 
  Company Size Weight (30%) +
  Industry Match Weight (25%) +
  Geographic Fit Weight (20%) +
  Website Quality Weight (15%) +
  Budget Signals Weight (10%)
```

### Commission Formulas

**VA Commission:**
```
VA Commission = MAX(
  Deal Value × 10%,
  $500
)
```

**Closer Commission (Tiered):**
```
IF Deal Value ≤ $10,000: Commission = Deal Value × 15%
ELSE IF Deal Value ≤ $25,000: Commission = Deal Value × 18%
ELSE: Commission = Deal Value × 20%
```

### Pipeline Metrics

**Weighted Pipeline Value:**
```
Weighted Value = ∑(Deal Value × Close Probability)

Where Close Probability by Stage:
- Discovery: 20%
- Proposal Sent: 40%
- Contract Sent: 70%
- Awaiting Deposit: 95%
```

**Conversion Rates:**
```
Lead → Deal Conversion = Deals Created / Total Leads
Deal → Client Conversion = Deposits Received / Total Deals
VA Effectiveness = Qualified Leads / Total Calls Made
Closer Effectiveness = Deals Closed / Qualified Leads Received
```

### Financial Forecasting

**Monthly Recurring Revenue (MRR):**
```
MRR = ∑(Retainer Clients × Monthly Retainer Value)
```

**Cash Runway:**
```
Runway (months) = (
  Current Cash + Expected Closings (Weighted)
) / Monthly Burn Rate
```

**Customer Lifetime Value (CLV):**
```
CLV = (
  Average Project Value × 
  Average Projects per Client × 
  Average Client Lifespan (years)
) - Customer Acquisition Cost
```

---

## Conclusion

This documentation provides a complete technical blueprint for building the NWS Media CRM. All database schemas, API endpoints, integration specifications, and business logic are defined.

**Next Steps:**
1. Review and approve this spec
2. Set up development environment
3. Begin Phase 1 implementation (Week 1-4)
4. Weekly standup to review progress against timeline

**Contact:**
- **Project Owner:** Maru Kane, CEO
- **Documentation Version:** 1.0
- **Last Updated:** March 29, 2026

---

*End of Technical Documentation*
