import { query } from '../config/database';

export async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS training_materials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(50) NOT NULL DEFAULT 'general'
        CHECK (category IN ('onboarding', 'sales', 'operations', 'tools', 'policies', 'general')),
      file_url VARCHAR(500) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(100),
      file_size INT,
      target_roles TEXT[] NOT NULL DEFAULT '{}',
      sort_order INT DEFAULT 0,
      required BOOLEAN DEFAULT FALSE,
      created_by_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_training_materials_roles ON training_materials USING GIN(target_roles)`);

  await query(`
    CREATE TABLE IF NOT EXISTS training_completions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      material_id UUID NOT NULL REFERENCES training_materials(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(material_id, user_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_training_completions_user ON training_completions(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_training_completions_material ON training_completions(material_id)`);
}
