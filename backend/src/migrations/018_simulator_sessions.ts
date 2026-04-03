import pool from '../config/database';

export async function up(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS simulator_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      niche TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
      prospect_name TEXT NOT NULL,
      prospect_title TEXT NOT NULL,
      transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
      scores JSONB,
      overall_score INTEGER,
      would_have_booked BOOLEAN,
      duration_seconds INTEGER,
      turn_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_simulator_sessions_user ON simulator_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_simulator_sessions_created ON simulator_sessions(created_at DESC);
  `);
}
