import { query } from '../config/database';

export async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS onboarding_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      token VARCHAR(64) UNIQUE NOT NULL,
      created_by_id UUID NOT NULL REFERENCES users(id),
      expires_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_onboarding_links_token ON onboarding_links(token)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_onboarding_links_client ON onboarding_links(client_id)`);

  await query(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS business_description TEXT,
      ADD COLUMN IF NOT EXISTS business_hours TEXT,
      ADD COLUMN IF NOT EXISTS social_facebook VARCHAR(500),
      ADD COLUMN IF NOT EXISTS social_instagram VARCHAR(500),
      ADD COLUMN IF NOT EXISTS social_linkedin VARCHAR(500),
      ADD COLUMN IF NOT EXISTS social_tiktok VARCHAR(500),
      ADD COLUMN IF NOT EXISTS social_youtube VARCHAR(500),
      ADD COLUMN IF NOT EXISTS social_twitter VARCHAR(500),
      ADD COLUMN IF NOT EXISTS existing_website VARCHAR(500),
      ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS color_preferences TEXT,
      ADD COLUMN IF NOT EXISTS content_tone TEXT,
      ADD COLUMN IF NOT EXISTS inspirations TEXT,
      ADD COLUMN IF NOT EXISTS additional_notes TEXT
  `);
}
