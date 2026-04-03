import { query } from '../config/database';

export async function up() {
  await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  await query(`
    CREATE TABLE IF NOT EXISTS teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      team_lead_id UUID,
      territory VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL CHECK (role IN ('va', 'closer', 'ops', 'admin', 'client')),
      phone VARCHAR(50),
      google_voice_number VARCHAR(50),
      personal_phone VARCHAR(50),
      preferred_phone VARCHAR(50),
      team_id UUID REFERENCES teams(id),
      status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    DO $$ BEGIN
      ALTER TABLE teams ADD CONSTRAINT fk_teams_lead FOREIGN KEY (team_lead_id) REFERENCES users(id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      action VARCHAR(255) NOT NULL,
      entity_type VARCHAR(100),
      entity_id UUID,
      changes JSONB,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC)`);

  await query(`
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      company_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      linkedin_url VARCHAR(500),
      website_url VARCHAR(500),
      source VARCHAR(100) NOT NULL,
      source_detail VARCHAR(255),
      utm_source VARCHAR(100),
      utm_medium VARCHAR(100),
      utm_campaign VARCHAR(100),
      industry VARCHAR(255),
      company_size_min INT,
      company_size_max INT,
      estimated_revenue DECIMAL(15,2),
      location_city VARCHAR(100),
      location_state VARCHAR(100),
      location_zip VARCHAR(20),
      icp_score INT CHECK (icp_score >= 1 AND icp_score <= 10),
      icp_score_factors JSONB,
      website_quality_score INT CHECK (website_quality_score >= 1 AND website_quality_score <= 10),
      tech_stack JSONB,
      assigned_va_id UUID REFERENCES users(id),
      assigned_closer_id UUID REFERENCES users(id),
      stage VARCHAR(50) DEFAULT 'new',
      last_contacted_at TIMESTAMPTZ,
      next_followup_at TIMESTAMPTZ,
      contact_attempts INT DEFAULT 0,
      loss_reason VARCHAR(255),
      loss_notes TEXT,
      lost_at TIMESTAMPTZ,
      tags TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      converted_to_deal_at TIMESTAMPTZ
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_leads_assigned_va ON leads(assigned_va_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_icp_score ON leads(icp_score)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source)`);

  await query(`
    CREATE TABLE IF NOT EXISTS activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      deal_id UUID,
      client_id UUID,
      activity_type VARCHAR(100) NOT NULL,
      outcome VARCHAR(100),
      call_duration_seconds INT,
      call_recording_url VARCHAR(500),
      call_transcript TEXT,
      phone_number_used VARCHAR(50),
      email_subject VARCHAR(500),
      email_opened BOOLEAN DEFAULT FALSE,
      email_clicked BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_by_id UUID REFERENCES users(id) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_activities_client_id ON activities(client_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_activities_created_by ON activities(created_by_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC)`);

  await query(`
    CREATE TABLE IF NOT EXISTS deals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID REFERENCES leads(id) NOT NULL,
      assigned_closer_id UUID REFERENCES users(id) NOT NULL,
      originating_va_id UUID REFERENCES users(id),
      company_name VARCHAR(255) NOT NULL,
      contact_name VARCHAR(255) NOT NULL,
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      estimated_value DECIMAL(15,2),
      actual_value DECIMAL(15,2),
      payment_terms VARCHAR(100),
      stage VARCHAR(100) DEFAULT 'discovery',
      discovery_call_date TIMESTAMPTZ,
      pain_point TEXT,
      budget_range_min DECIMAL(15,2),
      budget_range_max DECIMAL(15,2),
      timeline VARCHAR(255),
      decision_maker_name VARCHAR(255),
      objections TEXT[],
      proposal_sent_at TIMESTAMPTZ,
      proposal_url VARCHAR(500),
      proposal_viewed_at TIMESTAMPTZ,
      proposal_expires_at TIMESTAMPTZ,
      contract_sent_at TIMESTAMPTZ,
      contract_signed_at TIMESTAMPTZ,
      contract_url VARCHAR(500),
      deposit_amount DECIMAL(15,2),
      deposit_due_date DATE,
      deposit_received_at TIMESTAMPTZ,
      final_payment_amount DECIMAL(15,2),
      final_payment_received_at TIMESTAMPTZ,
      close_date TIMESTAMPTZ,
      close_probability INT CHECK (close_probability >= 0 AND close_probability <= 100),
      days_in_pipeline INT,
      loss_reason VARCHAR(255),
      competitor_name VARCHAR(255),
      competitor_price DECIMAL(15,2),
      loss_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_deals_assigned_closer ON deals(assigned_closer_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_deals_originating_va ON deals(originating_va_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_deals_close_date ON deals(close_date)`);

  await query(`
    DO $$ BEGIN
      ALTER TABLE activities ADD CONSTRAINT fk_activities_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID REFERENCES deals(id) NOT NULL,
      company_name VARCHAR(255) NOT NULL,
      contact_name VARCHAR(255) NOT NULL,
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      project_name VARCHAR(255),
      services_contracted TEXT[],
      contract_value DECIMAL(15,2),
      assigned_ops_lead_id UUID REFERENCES users(id),
      assigned_closer_id UUID REFERENCES users(id),
      kickoff_date DATE,
      expected_delivery_date DATE,
      actual_delivery_date DATE,
      project_status VARCHAR(100) DEFAULT 'not_started',
      current_phase VARCHAR(255),
      revision_limit INT DEFAULT 3,
      revisions_used INT DEFAULT 0,
      total_paid DECIMAL(15,2) DEFAULT 0,
      balance_due DECIMAL(15,2),
      final_payment_received BOOLEAN DEFAULT FALSE,
      upsell_opportunity BOOLEAN DEFAULT FALSE,
      upsell_notes TEXT,
      referral_requested_at TIMESTAMPTZ,
      referrals_submitted INT DEFAULT 0,
      case_study_created BOOLEAN DEFAULT FALSE,
      portal_access_enabled BOOLEAN DEFAULT TRUE,
      portal_last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    DO $$ BEGIN
      ALTER TABLE activities ADD CONSTRAINT fk_activities_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_clients_deal_id ON clients(deal_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clients_ops_lead ON clients(assigned_ops_lead_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(project_status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clients_delivery_date ON clients(expected_delivery_date)`);

  await query(`
    CREATE TABLE IF NOT EXISTS payment_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID REFERENCES deals(id),
      client_id UUID REFERENCES clients(id),
      created_by_id UUID REFERENCES users(id) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      payment_type VARCHAR(100) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      description TEXT,
      processor VARCHAR(50) NOT NULL,
      payment_methods_enabled TEXT[],
      stripe_payment_intent_id VARCHAR(255),
      square_payment_id VARCHAR(255),
      paypal_invoice_id VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      due_date DATE,
      send_reminders BOOLEAN DEFAULT TRUE,
      paid_at TIMESTAMPTZ,
      paid_amount DECIMAL(15,2),
      transaction_id VARCHAR(255),
      processor_fee DECIMAL(10,2),
      payment_method_type VARCHAR(50),
      last_4_digits VARCHAR(4),
      sent_at TIMESTAMPTZ,
      viewed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_payment_links_slug ON payment_links(slug)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_payment_links_deal_id ON payment_links(deal_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_payment_links_client_id ON payment_links(client_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_payment_links_status ON payment_links(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_payment_links_due_date ON payment_links(due_date)`);

  await query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number VARCHAR(100) UNIQUE NOT NULL,
      deal_id UUID REFERENCES deals(id),
      client_id UUID REFERENCES clients(id),
      payment_link_id UUID REFERENCES payment_links(id),
      invoice_type VARCHAR(100) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      tax_amount DECIMAL(10,2) DEFAULT 0,
      total_amount DECIMAL(15,2) NOT NULL,
      line_items JSONB,
      payment_terms VARCHAR(100),
      due_date DATE,
      status VARCHAR(50) DEFAULT 'draft',
      sent_at TIMESTAMPTZ,
      viewed_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      voided_at TIMESTAMPTZ,
      amount_paid DECIMAL(15,2) DEFAULT 0,
      balance_due DECIMAL(15,2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_deal_id ON invoices(deal_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date)`);

  await query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID REFERENCES invoices(id),
      payment_link_id UUID REFERENCES payment_links(id),
      client_id UUID REFERENCES clients(id),
      transaction_type VARCHAR(50) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      processor VARCHAR(50) NOT NULL,
      processor_transaction_id VARCHAR(255),
      processor_fee DECIMAL(10,2),
      net_amount DECIMAL(15,2),
      payment_method VARCHAR(50),
      card_brand VARCHAR(50),
      last_4_digits VARCHAR(4),
      status VARCHAR(50) DEFAULT 'pending',
      failure_reason TEXT,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON transactions(invoice_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC)`);

  await query(`
    CREATE TABLE IF NOT EXISTS commissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      deal_id UUID REFERENCES deals(id) NOT NULL,
      client_id UUID REFERENCES clients(id),
      commission_type VARCHAR(50) NOT NULL,
      deal_value DECIMAL(15,2) NOT NULL,
      commission_percentage DECIMAL(5,2),
      commission_amount DECIMAL(15,2) NOT NULL,
      rule_applied VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      trigger_event VARCHAR(100),
      triggered_at TIMESTAMPTZ,
      payout_date DATE,
      payout_method VARCHAR(50),
      payout_reference VARCHAR(255),
      paid_at TIMESTAMPTZ,
      voided_at TIMESTAMPTZ,
      void_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_commissions_deal_id ON commissions(deal_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_commissions_payout_date ON commissions(payout_date)`);

  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID REFERENCES clients(id) NOT NULL,
      project_name VARCHAR(255) NOT NULL,
      project_type VARCHAR(100),
      description TEXT,
      milestones JSONB,
      deliverables_list JSONB,
      status VARCHAR(100) DEFAULT 'not_started',
      current_milestone VARCHAR(255),
      start_date DATE,
      due_date DATE,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`);

  await query(`
    CREATE TABLE IF NOT EXISTS files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      filename VARCHAR(500) NOT NULL,
      original_filename VARCHAR(500),
      file_type VARCHAR(100),
      mime_type VARCHAR(100),
      file_size BIGINT,
      storage_provider VARCHAR(50) DEFAULT 's3',
      storage_path VARCHAR(1000),
      storage_url VARCHAR(1000),
      visibility VARCHAR(50) DEFAULT 'private',
      uploaded_by_id UUID REFERENCES users(id),
      description TEXT,
      tags TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_files_lead_id ON files(lead_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_files_deal_id ON files(deal_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_files_client_id ON files(client_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_files_type ON files(file_type)`);

  await query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referred_by_client_id UUID REFERENCES clients(id) NOT NULL,
      company_name VARCHAR(255) NOT NULL,
      contact_name VARCHAR(255),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      notes TEXT,
      status VARCHAR(100) DEFAULT 'submitted',
      lead_id UUID REFERENCES leads(id),
      deal_id UUID REFERENCES deals(id),
      reward_type VARCHAR(100),
      reward_amount DECIMAL(10,2),
      reward_status VARCHAR(50) DEFAULT 'pending',
      reward_paid_at TIMESTAMPTZ,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      contacted_at TIMESTAMPTZ,
      converted_at TIMESTAMPTZ
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_referrals_referred_by ON referrals(referred_by_client_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_referrals_lead_id ON referrals(lead_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS sequences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      sequence_type VARCHAR(100),
      trigger_event VARCHAR(255),
      trigger_delay_days INT DEFAULT 0,
      steps JSONB,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sequence_enrollments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sequence_id UUID REFERENCES sequences(id) NOT NULL,
      lead_id UUID REFERENCES leads(id),
      deal_id UUID REFERENCES deals(id),
      client_id UUID REFERENCES clients(id),
      current_step INT DEFAULT 0,
      next_send_at TIMESTAMPTZ,
      status VARCHAR(50) DEFAULT 'active',
      enrolled_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_seq_enrollments_sequence ON sequence_enrollments(sequence_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_seq_enrollments_lead ON sequence_enrollments(lead_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_seq_enrollments_next_send ON sequence_enrollments(next_send_at)`);

  await query(`
    CREATE TABLE IF NOT EXISTS portal_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID REFERENCES clients(id) NOT NULL,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_leads_va_open_score ON leads(assigned_va_id, stage, icp_score DESC) WHERE stage NOT IN ('lost', 'converted')`);
  await query(`CREATE INDEX IF NOT EXISTS idx_deals_closer_stage ON deals(assigned_closer_id, stage, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_overdue ON invoices(status, due_date) WHERE status NOT IN ('paid', 'voided')`);
  await query(`CREATE INDEX IF NOT EXISTS idx_commissions_pending_user ON commissions(user_id, status) WHERE status = 'pending'`);
}
