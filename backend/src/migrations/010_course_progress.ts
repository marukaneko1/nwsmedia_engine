import { query } from '../config/database';

export async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS training_course_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id VARCHAR(100) NOT NULL,
      progress JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, course_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_course_progress_user ON training_course_progress(user_id)`);
}
