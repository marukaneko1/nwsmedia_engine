import { query } from '../config/database';

export async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS project_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      author_id UUID NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      note_type VARCHAR(50) DEFAULT 'general',
      pinned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_project_notes_client ON project_notes(client_id, created_at DESC)`);

  await query(`
    CREATE TABLE IF NOT EXISTS project_milestones (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      due_date DATE,
      completed_at TIMESTAMPTZ,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_project_milestones_client ON project_milestones(client_id, sort_order)`);

  await query(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS handoff_notes TEXT,
      ADD COLUMN IF NOT EXISTS project_brief TEXT,
      ADD COLUMN IF NOT EXISTS project_goals JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS target_audience TEXT,
      ADD COLUMN IF NOT EXISTS brand_guidelines TEXT,
      ADD COLUMN IF NOT EXISTS competitors TEXT,
      ADD COLUMN IF NOT EXISTS special_requirements TEXT,
      ADD COLUMN IF NOT EXISTS handed_off_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS handed_off_by UUID REFERENCES users(id)
  `);
}
