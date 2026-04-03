import { query } from '../config/database';

export async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(500) NOT NULL,
      type VARCHAR(50) DEFAULT 'contract'
        CHECK (type IN ('contract', 'proposal', 'agreement', 'nda', 'custom')),
      status VARCHAR(30) DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'viewed', 'partially_signed', 'completed', 'declined', 'expired', 'voided')),
      content JSONB NOT NULL DEFAULT '{}',
      file_path VARCHAR(1000),
      created_by_id UUID NOT NULL REFERENCES users(id),
      deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
      client_email VARCHAR(255),
      client_name VARCHAR(255),
      expires_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS document_signers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'signer',
      order_num INT DEFAULT 1,
      status VARCHAR(30) DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'declined')),
      token VARCHAR(255) UNIQUE NOT NULL,
      signature_data TEXT,
      signed_at TIMESTAMPTZ,
      viewed_at TIMESTAMPTZ,
      ip_address VARCHAR(45),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS document_fields (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      signer_id UUID REFERENCES document_signers(id) ON DELETE CASCADE,
      type VARCHAR(30) NOT NULL
        CHECK (type IN ('signature', 'initials', 'date', 'text', 'checkbox', 'name', 'email', 'company')),
      label VARCHAR(255),
      page INT DEFAULT 1,
      x FLOAT NOT NULL,
      y FLOAT NOT NULL,
      width FLOAT DEFAULT 200,
      height FLOAT DEFAULT 50,
      required BOOLEAN DEFAULT TRUE,
      value TEXT,
      filled_at TIMESTAMPTZ
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS document_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      action VARCHAR(50) NOT NULL,
      actor_name VARCHAR(255),
      actor_email VARCHAR(255),
      ip_address VARCHAR(45),
      details TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
