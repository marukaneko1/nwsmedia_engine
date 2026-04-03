import { query } from '../config/database';

export async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS user_activity_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      session_id VARCHAR(255),
      action VARCHAR(100) NOT NULL,
      method VARCHAR(10),
      endpoint VARCHAR(500),
      page_url VARCHAR(500),
      ip_address VARCHAR(45),
      city VARCHAR(100),
      region VARCHAR(100),
      country VARCHAR(100),
      country_code VARCHAR(10),
      latitude DECIMAL(10, 6),
      longitude DECIMAL(10, 6),
      user_agent TEXT,
      device_type VARCHAR(50),
      browser VARCHAR(100),
      os VARCHAR(100),
      status_code INTEGER,
      response_time_ms INTEGER,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_ual_user_id ON user_activity_log(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ual_created_at ON user_activity_log(created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ual_action ON user_activity_log(action)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ual_ip_address ON user_activity_log(ip_address)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ual_session_id ON user_activity_log(session_id)`);
}
