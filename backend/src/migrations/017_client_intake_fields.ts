import { query } from '../config/database';

export async function up() {
  // New columns on existing clients table
  await query(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS revenue_range VARCHAR(100),
      ADD COLUMN IF NOT EXISTS team_size VARCHAR(100),
      ADD COLUMN IF NOT EXISTS looking_for TEXT
  `);

  // Standalone intake links (reusable, no client_id required)
  await query(`
    CREATE TABLE IF NOT EXISTS client_intake_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token VARCHAR(64) UNIQUE NOT NULL,
      label VARCHAR(255),
      created_by_id UUID NOT NULL REFERENCES users(id),
      is_active BOOLEAN DEFAULT TRUE,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_client_intake_links_token ON client_intake_links(token)`);

  // Each submission from an intake link
  await query(`
    CREATE TABLE IF NOT EXISTS client_intake_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      intake_link_id UUID NOT NULL REFERENCES client_intake_links(id) ON DELETE CASCADE,
      client_name VARCHAR(255) NOT NULL,
      business_name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      website VARCHAR(500),
      revenue_range VARCHAR(100),
      team_size VARCHAR(100),
      looking_for TEXT,
      status VARCHAR(50) DEFAULT 'new',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_client_intake_subs_link ON client_intake_submissions(intake_link_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_client_intake_subs_status ON client_intake_submissions(status)`);
}
