import { query } from '../config/database';

export async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      clock_out TIMESTAMPTZ,
      duration_minutes INT,
      activity_type VARCHAR(30) NOT NULL DEFAULT 'other'
        CHECK (activity_type IN ('cold_calls', 'follow_ups', 'meetings', 'admin_tasks', 'training', 'break', 'other')),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id, clock_in DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(clock_in)`);

  await query(`
    CREATE TABLE IF NOT EXISTS schedule_overrides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      start_time TIME,
      end_time TIME,
      reason VARCHAR(50) DEFAULT 'custom'
        CHECK (reason IN ('pto', 'sick', 'holiday', 'custom', 'half_day')),
      notes TEXT,
      created_by_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, date)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_schedule_overrides_user_date ON schedule_overrides(user_id, date)`);
}
