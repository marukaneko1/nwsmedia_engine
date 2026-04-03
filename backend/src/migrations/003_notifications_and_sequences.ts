import { query } from '../config/database';

export async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      link VARCHAR(500),
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);`);

  await query(`
    CREATE TABLE IF NOT EXISTS sequences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      sequence_type VARCHAR(50) NOT NULL,
      steps JSONB NOT NULL DEFAULT '[]',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sequence_enrollments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sequence_id UUID NOT NULL REFERENCES sequences(id),
      lead_id UUID REFERENCES leads(id),
      deal_id UUID REFERENCES deals(id),
      current_step INT DEFAULT 0,
      status VARCHAR(30) DEFAULT 'active',
      next_send_at TIMESTAMPTZ,
      enrolled_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_enrollments_next ON sequence_enrollments(status, next_send_at);`);

  await query(`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      url VARCHAR(500) NOT NULL,
      events TEXT[] NOT NULL DEFAULT '{}',
      secret VARCHAR(255),
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS proposal_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      services JSONB NOT NULL DEFAULT '[]',
      total NUMERIC(12,2) DEFAULT 0,
      timeline VARCHAR(100),
      description TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}
