import { query } from '../config/database';

export async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS invite_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token VARCHAR(64) UNIQUE NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('va', 'closer', 'ops')),
      email VARCHAR(255),
      label VARCHAR(255),
      created_by_id UUID NOT NULL REFERENCES users(id),
      used_by_id UUID REFERENCES users(id),
      used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_invite_links_token ON invite_links(token)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_invite_links_created_by ON invite_links(created_by_id)`);
}
